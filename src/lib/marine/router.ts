// Water-only marine route generator (replaces road routing entirely).
// Strategy: push the corridor seaward of the coast, detour around
// restricted polygons, enforce vessel minimum depth, and score the result
// with the transparent risk engine. Limitations are stated, not hidden.
import { assessRisk, VESSELS, type RiskResult, type VesselProfile } from "./risk";
import { bearingDeg, destPoint, distanceToPolygonKm, haversineKm, pointInPolygon, routeCrossesLine, routeIntersectsPolygon, type LatLng } from "./geo";
import { DEMO_EEZ_LINE, demoDepthAt } from "./fixtures";
import { CURATED_MPAS } from "@/lib/marine-zones";

export interface MarineRouteInput {
  from: { lat: number; lng: number; name: string };
  to: { lat: number; lng: number; name: string };
  vessel: VesselProfile;
  departLabel: string;
  safety: "cautious" | "normal";
  liveWindKts?: number;
  liveWaveM?: number;
  liveLightning?: boolean;
}

export interface MarineRouteOption {
  id: "direct" | "safe";
  name: string;
  coords: LatLng[];
  distanceKm: number;
  durationMin: number;
  fuelL: number;
  minDepthM: number;
  mpaConflicts: string[];
  mpaClearanceKm: number;
  eezCrossing: boolean;
  exposure: { windKts: number; waveM: number };
  risk: RiskResult;
  explanation: string;
}

const FUEL_L_PER_HR: Record<VesselProfile["type"], number> = { small: 8, trawler: 25, research: 40 };
const MPA_BUFFER_KM = 2;

function routeLength(coords: LatLng[]): number {
  let d = 0;
  for (let i = 0; i < coords.length - 1; i++) d += haversineKm(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  return d;
}

function mpaRings(): LatLng[][] {
  return CURATED_MPAS.map(z => z.polygon as LatLng[]);
}

/** Push a waypoint out of every MPA (+buffer) by stepping away from the ring centroid. */
function clearMpas(wp: LatLng): { pt: LatLng; conflicts: string[] } {
  let [la, ln] = wp;
  const conflicts: string[] = [];
  for (const z of CURATED_MPAS) {
    const ring = z.polygon as LatLng[];
    for (let tries = 0; tries < 12; tries++) {
      const inside = pointInPolygon(la, ln, ring);
      const near = distanceToPolygonKm(la, ln, ring);
      if (!inside && near >= MPA_BUFFER_KM) break;
      conflicts.push(z.name);
      const cLa = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      const cLn = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      const away = bearingDeg(cLa, cLn, la, ln);
      [la, ln] = destPoint(la, ln, away, 2);
    }
  }
  return { pt: [la, ln], conflicts: [...new Set(conflicts)] };
}

/** Seaward side = the perpendicular offset with deeper demo water. */
function seawardMid(a: LatLng, b: LatLng, distKm: number): LatLng {
  const hdg = bearingDeg(a[0], a[1], b[0], b[1]);
  const mid: LatLng = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const left = destPoint(mid[0], mid[1], hdg - 90, distKm);
  const right = destPoint(mid[0], mid[1], hdg + 90, distKm);
  return demoDepthAt(...left).depthM >= demoDepthAt(...right).depthM ? left : right;
}

function sampleDepths(coords: LatLng[]): { min: number; clearance: number } {
  let min = Infinity;
  let clearance = Infinity;
  const total = routeLength(coords);
  const steps = Math.max(8, Math.floor(total / 2));
  for (let i = 0; i <= steps; i++) {
    // walk the polyline by fraction
    const target = (total * i) / steps;
    let acc = 0;
    for (let j = 0; j < coords.length - 1; j++) {
      const seg = haversineKm(coords[j][0], coords[j][1], coords[j + 1][0], coords[j + 1][1]);
      if (acc + seg >= target || j === coords.length - 2) {
        const t = seg === 0 ? 0 : Math.min(1, Math.max(0, (target - acc) / seg));
        const la = coords[j][0] + (coords[j + 1][0] - coords[j][0]) * t;
        const ln = coords[j][1] + (coords[j + 1][1] - coords[j][1]) * t;
        const { depthM } = demoDepthAt(la, ln);
        if (depthM < min) min = depthM;
        for (const ring of mpaRings()) {
          const d = pointInPolygon(la, ln, ring) ? 0 : distanceToPolygonKm(la, ln, ring);
          if (d < clearance) clearance = d;
        }
        break;
      }
      acc += seg;
    }
  }
  return { min: min === Infinity ? 0 : min, clearance: clearance === Infinity ? 99 : clearance };
}

function buildOption(
  id: "direct" | "safe", from: LatLng, to: LatLng, offKm: number, inp: MarineRouteInput,
): MarineRouteOption {
  const mid = seawardMid(from, to, offKm);
  let coords: LatLng[] = id === "direct" ? [from, mid, to] : [from, seawardMid(from, mid, offKm * 0.7), mid, seawardMid(mid, to, offKm * 0.7), to];
  const conflicts = new Set<string>();
  coords = coords.map((c, i) => {
    if (i === 0 || i === coords.length - 1) return c; // harbour endpoints stay
    const r = clearMpas(c);
    r.conflicts.forEach(x => conflicts.add(x));
    return r.pt;
  });
  // Final sweep: any segment still inside an MPA is a hard conflict (flagged, not hidden).
  const hard = CURATED_MPAS.filter(z => routeIntersectsPolygon(coords, z.polygon as LatLng[])).map(z => z.name);
  hard.forEach(x => conflicts.add(`INTRUSION: ${x}`));

  const { min, clearance } = sampleDepths(coords);
  const distanceKm = Math.round(routeLength(coords) * 10) / 10;
  const durationMin = Math.round((distanceKm / (inp.vessel.speedKts * 1.852)) * 60);
  const fuelL = Math.round((durationMin / 60) * FUEL_L_PER_HR[inp.vessel.type]);
  const eezCrossing = routeCrossesLine(coords, DEMO_EEZ_LINE);
  const windKts = inp.liveWindKts ?? 14;
  const waveM = inp.liveWaveM ?? 0.8;
  const risk = assessRisk({
    windKts, waveM, lightning: inp.liveLightning ?? false,
    vessel: inp.vessel, routeKm: distanceKm, minDepthOnRouteM: min,
    mpaIntrusionKm: clearance >= 99 ? null : clearance, eezCrossing,
    forecastWindow: inp.departLabel,
  });
  return {
    id, name: id === "direct" ? "Direct offshore" : "Safe offshore",
    coords, distanceKm, durationMin, fuelL, minDepthM: min,
    mpaConflicts: [...conflicts], mpaClearanceKm: Math.round(clearance * 10) / 10,
    eezCrossing, exposure: { windKts, waveM }, risk,
    explanation: "",
  };
}

export function planMarineRoutes(inp: MarineRouteInput): { direct: MarineRouteOption; safe: MarineRouteOption } {
  const from: LatLng = [inp.from.lat, inp.from.lng];
  const to: LatLng = [inp.to.lat, inp.to.lng];
  const off = inp.safety === "cautious" ? 14 : 9;
  const direct = buildOption("direct", from, to, off * 0.7, inp);
  const safe = buildOption("safe", from, to, off * 1.5, inp);
  const extra = Math.round((safe.distanceKm - direct.distanceKm) * 10) / 10;
  const avoided = safe.mpaConflicts.filter(c => !c.startsWith("INTRUSION"));
  safe.explanation =
    extra > 0.5
      ? `The safe route is ${extra} km longer because it stands ${Math.round(off * 1.5)} km offshore and skirts ${avoided.length ? avoided.join("; ") : "sensitive areas"}, keeping ≥${MPA_BUFFER_KM} km MPA clearance and deeper water (min ${safe.minDepthM} m vs ${direct.minDepthM} m).`
      : "Both options converge — no hazards force a detour on this leg.";
  direct.explanation = `Shortest water corridor (${direct.distanceKm} km). ${direct.mpaConflicts.length ? "Caution: " + direct.mpaConflicts.join("; ") + "." : "No restricted-zone conflicts."}`;
  return { direct, safe };
}

export { VESSELS };
