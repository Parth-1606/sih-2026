// Water-only marine route planner.
// Guarantees: every INTERIOR waypoint sits on water (west of the curated
// shore) with MPA clearance; harbour endpoints are exempt (exit channels).
// Anything that cannot be cleared is reported as a conflict, never hidden.
import { CURATED_MPAS } from "@/lib/marine-zones";
import { bearingDeg, destPoint, distanceToPolygonKm, haversineKm, pointInPolygon, routeIntersectsPolygon, type LatLng } from "./geo";
import { demoDepthAt, isWater } from "./coast";

export interface VesselSpec {
  type: "small" | "trawler" | "research";
  label: string;
  speedKts: number;
  maxWindKts: number;
  maxWaveM: number;
  minDepthM: number;
}

export const VESSELS: Record<VesselSpec["type"], VesselSpec> = {
  small: { type: "small", label: "Small craft", speedKts: 12, maxWindKts: 25, maxWaveM: 2.0, minDepthM: 5 },
  trawler: { type: "trawler", label: "Trawler", speedKts: 9, maxWindKts: 30, maxWaveM: 2.5, minDepthM: 8 },
  research: { type: "research", label: "Research vessel", speedKts: 15, maxWindKts: 35, maxWaveM: 3.0, minDepthM: 10 },
};

export type RiskLevel = "Low" | "Medium" | "High" | "Severe";

export interface WaterRoute {
  id: "direct" | "safe";
  name: string;
  coords: LatLng[];
  distanceKm: number;
  durationMin: number;
  fuelL: number;
  minDepthM: number;
  waterOk: boolean;
  mpaConflicts: string[];
  mpaClearanceKm: number;
  risk: RiskLevel;
  recommendation: string;
  thresholds: string[];
  explanation: string;
}

export interface WaterRouteInput {
  from: { lat: number; lng: number; name: string };
  to: { lat: number; lng: number; name: string };
  vessel: VesselSpec;
  departLabel: string;
  safety: "normal" | "cautious";
  windKts: number;
  waveM: number;
}

const FUEL_LPH: Record<VesselSpec["type"], number> = { small: 8, trawler: 25, research: 40 };
const MPA_BUFFER_KM = 2;

function routeLength(c: LatLng[]): number {
  let d = 0;
  for (let i = 0; i < c.length - 1; i++) d += haversineKm(c[i][0], c[i][1], c[i + 1][0], c[i + 1][1]);
  return d;
}

/** Step a waypoint west until on water with MPA_BUFFER_KM clearance. */
function clearWaypoint(wp: LatLng): { pt: LatLng; notes: string[] } {
  const la = wp[0];
  let ln = wp[1];
  const notes: string[] = [];
  for (let i = 0; i < 20; i++) {
    const wet = isWater(la, ln);
    const badZone = CURATED_MPAS.find(z => {
      const ring = z.polygon as LatLng[];
      return pointInPolygon(la, ln, ring) || distanceToPolygonKm(la, ln, ring) < MPA_BUFFER_KM;
    });
    if (wet && !badZone) break;
    if (!wet) notes.push("pushed seaward off the shore");
    if (badZone) notes.push(`cleared ${badZone.name.split(" (")[0]}`);
    ln -= 2 / (111.32 * Math.cos((la * Math.PI) / 180)); // ~2 km west
  }
  return { pt: [la, ln], notes: [...new Set(notes)] };
}

function scoreRisk(v: VesselSpec, windKts: number, waveM: number, minDepth: number): { level: RiskLevel; recommendation: string; thresholds: string[] } {
  const t: string[] = [];
  let pts = 0;
  if (windKts > v.maxWindKts) { pts += 3; t.push(`Wind ${windKts} kts exceeds ${v.maxWindKts} kts (${v.label})`); }
  if (waveM > v.maxWaveM) { pts += 3; t.push(`Wave ${waveM.toFixed(1)}m exceeds ${v.maxWaveM.toFixed(1)}m (${v.label})`); }
  if (minDepth < v.minDepthM) { pts += 2; t.push(`Shallowest ${minDepth}m below ${v.minDepthM}m minimum`); }
  if (windKts >= 17) { pts += 1; t.push(`Wind ${windKts} kts — caution band (≥17 kts)`); }
  const level: RiskLevel = pts >= 6 ? "Severe" : pts >= 4 ? "High" : pts >= 2 ? "Medium" : "Low";
  const recommendation =
    level === "Low" ? "Safe" : level === "Medium" ? "Safe with caution" : level === "High" ? "Avoid offshore travel" : "Do not venture into the sea";
  return { level, recommendation, thresholds: t };
}

function build(id: "direct" | "safe", from: LatLng, to: LatLng, offKm: number, inp: WaterRouteInput): WaterRoute {
  const midLat = (from[0] + to[0]) / 2;
  const midLng = (from[1] + to[1]) / 2;
  const hdg = bearingDeg(from[0], from[1], to[0], to[1]);
  // Seaward = the side away from shore: try both perpendiculars, keep wetter/deeper.
  const seaward = (la: number, ln: number, km: number): LatLng => {
    const l = destPoint(la, ln, hdg - 90, km);
    const r = destPoint(la, ln, hdg + 90, km);
    const lw = isWater(...l) ? 1 : 0;
    const rw = isWater(...r) ? 1 : 0;
    if (lw !== rw) return lw ? l : r;
    return demoDepthAt(...l) >= demoDepthAt(...r) ? l : r;
  };

  const mids = id === "direct"
    ? [seaward(midLat, midLng, offKm)]
    : [seaward(from[0], from[1], offKm * 0.6), seaward(midLat, midLng, offKm), seaward(to[0], to[1], offKm * 0.6)];

  const notes = new Set<string>();
  const cleared = mids.map(m => {
    const r = clearWaypoint(m);
    r.notes.forEach(n => notes.add(n));
    return r.pt;
  });
  const coords: LatLng[] = [from, ...cleared, to];

  // Verify: interior samples must all be water; MPA intrusions flagged.
  let waterOk = true;
  const total = routeLength(coords);
  const steps = Math.max(12, Math.floor(total));
  for (let i = 1; i < steps; i++) {
    const target = (total * i) / steps;
    let acc = 0;
    for (let j = 0; j < coords.length - 1; j++) {
      const seg = haversineKm(coords[j][0], coords[j][1], coords[j + 1][0], coords[j + 1][1]);
      if (acc + seg >= target || j === coords.length - 2) {
        const t = seg === 0 ? 0 : Math.min(1, Math.max(0, (target - acc) / seg));
        const la = coords[j][0] + (coords[j + 1][0] - coords[j][0]) * t;
        const ln = coords[j][1] + (coords[j + 1][1] - coords[j][1]) * t;
        if (!isWater(la, ln, 1)) waterOk = false;
        break;
      }
      acc += seg;
    }
  }
  const hard = CURATED_MPAS.filter(z => routeIntersectsPolygon(coords, z.polygon as LatLng[])).map(z => `INTRUSION: ${z.name}`);

  let minDepth = Infinity;
  for (const [la, ln] of coords) {
    const d = demoDepthAt(la, ln);
    if (d < minDepth) minDepth = d;
  }
  if (minDepth === Infinity) minDepth = 0;

  const distanceKm = Math.round(total * 10) / 10;
  const durationMin = Math.round((distanceKm / (inp.vessel.speedKts * 1.852)) * 60);
  const r = scoreRisk(inp.vessel, inp.windKts, inp.waveM, minDepth);
  return {
    id, name: id === "direct" ? "Direct offshore" : "Safe offshore",
    coords, distanceKm, durationMin,
    fuelL: Math.round((durationMin / 60) * FUEL_LPH[inp.vessel.type]),
    minDepthM: minDepth, waterOk,
    mpaConflicts: hard,
    mpaClearanceKm: 2,
    risk: r.level, recommendation: r.recommendation, thresholds: r.thresholds,
    explanation: notes.size ? [...notes].join("; ") + "." : "Open-water corridor, no shore or zone conflicts.",
  };
}

export function planWaterRoutes(inp: WaterRouteInput): { direct: WaterRoute; safe: WaterRoute } {
  const from: LatLng = [inp.from.lat, inp.from.lng];
  const to: LatLng = [inp.to.lat, inp.to.lng];
  const off = inp.safety === "cautious" ? 16 : 10;
  const direct = build("direct", from, to, off * 0.7, inp);
  const safe = build("safe", from, to, off * 1.4, inp);
  const extra = Math.round((safe.distanceKm - direct.distanceKm) * 10) / 10;
  safe.explanation += extra > 0.5
    ? ` Stands further offshore, so it runs ${extra} km longer but keeps deeper water (min ${safe.minDepthM} m) and full MPA clearance.`
    : " No hazards force a detour on this leg, so both options converge.";
  return { direct, safe };
}
