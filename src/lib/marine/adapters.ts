// Source adapters — one module per PDF §2 dataset family.
// Every adapter returns NormalizedRecord[] and NEVER throws: on failure it
// returns an `unavailable` record so the UI can show gaps honestly instead
// of silently substituting mock values.
import type { DataMode, NormalizedRecord } from "./schema";
import { nowISO } from "./schema";
import { fetchLiveMarine, type LiveMarine } from "@/lib/marine-api";
import { DEMO_EEZ_LINE, DEMO_PFZ, demoDepthAt, demoImdAlerts, demoOsfRecords, type DemoPfz } from "./fixtures";
import { CURATED_MPAS, CURATED_PORTS } from "@/lib/marine-zones";

async function j<T>(url: string, ms = 25000): Promise<T> {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function unavail(kind: NormalizedRecord["kind"], name: string, url: string, note: string): NormalizedRecord {
  return {
    id: `unavail-${kind}`, kind, dataMode: "unavailable", isMock: false,
    source: { name, url, retrievedAt: nowISO() },
    units: {}, quality: note, data: null,
  };
}

// ---- Live: Open-Meteo model (wind/wave/SST/visibility) ----
export async function adaptOpenMeteo(lat: number, lng: number, label: string): Promise<{ marine: LiveMarine | null; records: NormalizedRecord[] }> {
  try {
    const m = await fetchLiveMarine();
    const t = nowISO();
    const rec = <T>(id: string, kind: NormalizedRecord["kind"], data: T, units: Record<string, string>): NormalizedRecord<T> => ({
      id, kind, dataMode: "live", isMock: false,
      source: { name: "Open-Meteo Marine + Forecast", url: "https://open-meteo.com", retrievedAt: t },
      observedAt: t, location: { lat, lng, label }, units, data,
    });
    return {
      marine: m,
      records: [
        rec("om-sst", "sst", { value: m.sst }, { value: "°C" }),
        rec("om-wave", "wave", { heightM: m.waveHeight, directionDeg: m.waveDirection, periodS: m.wavePeriod }, { heightM: "m", directionDeg: "°", periodS: "s" }),
        rec("om-wind", "wind", { speedKts: m.windSpeedKn, directionDeg: m.windDirectionDeg, visibilityKm: m.visibilityKm }, { speedKts: "kts", directionDeg: "°", visibilityKm: "km" }),
      ],
    };
  } catch {
    return { marine: null, records: [unavail("wind", "Open-Meteo Marine + Forecast", "https://open-meteo.com", "fetch failed — showing Demo fallbacks elsewhere")] };
  }
}

// ---- Live: NASA ERDDAP chlorophyll + MUR SST ----
export async function adaptErddap(lat: number, lng: number, label: string): Promise<NormalizedRecord[]> {
  const out: NormalizedRecord[] = [];
  try {
    const c = await j<{ meanChl: number | null; maxChl: number | null; pixels: number; windowEnd: string }>("/api/ocean/chlorophyll?lat=18.7&lng=72.4");
    out.push({
      id: "erddap-chl", kind: "chlorophyll", dataMode: c.meanChl != null ? "live" : "unavailable", isMock: false,
      source: { name: "NASA MODIS-Aqua R2022 (ERDDAP)", url: "https://coastwatch.pfeg.noaa.gov/erddap", retrievedAt: nowISO(), validTo: c.windowEnd },
      observedAt: c.windowEnd, location: { lat, lng, label }, units: { meanChl: "mg/m³" },
      quality: `${c.pixels} valid pixels, 21-day cloud-aware mean`, data: c,
    });
  } catch {
    out.push(unavail("chlorophyll", "NASA MODIS-Aqua (ERDDAP)", "https://coastwatch.pfeg.noaa.gov/erddap", "fetch failed"));
  }
  try {
    const s = await j<{ sstC: number | null; time: string }>("/api/ocean/sst-sat?lat=18.7&lng=72.4");
    out.push({
      id: "mur-sst", kind: "sst", dataMode: s.sstC != null ? "live" : "unavailable", isMock: false,
      source: { name: "JPL MUR SST (ERDDAP)", url: "https://coastwatch.pfeg.noaa.gov/erddap", retrievedAt: nowISO() },
      observedAt: s.time, location: { lat, lng, label }, units: { sstC: "°C" }, data: s,
    });
  } catch {
    out.push(unavail("sst", "JPL MUR SST (ERDDAP)", "https://coastwatch.pfeg.noaa.gov/erddap", "fetch failed"));
  }
  return out;
}

// ---- PFZ: INCOIS live validity + Demo positions (INCOIS shape) ----
export async function adaptPfz(): Promise<NormalizedRecord[]> {
  const out: NormalizedRecord[] = [];
  try {
    const s = await j<{ forecastDate: string; validUpto: string }>("/api/advisories/incois");
    out.push({
      id: "incois-validity", kind: "pfz", dataMode: "live", isMock: false,
      source: { name: "INCOIS PFZ Advisory validity", url: "https://incois.gov.in/MarineFisheries/PfzAdvisory", retrievedAt: nowISO(), validTo: s.validUpto },
      units: {}, data: s,
    });
  } catch {
    out.push(unavail("pfz", "INCOIS PFZ Advisory", "https://incois.gov.in/MarineFisheries/PfzAdvisory", "portal unreachable"));
  }
  const t = nowISO();
  for (const p of DEMO_PFZ) {
    out.push({
      id: p.id, kind: "pfz", dataMode: "demo", isMock: true,
      source: { name: "Demo PFZ (INCOIS advisory shape)", url: "https://incois.gov.in/MarineFisheries/PfzAdvisory", retrievedAt: t },
      location: { lat: p.lat, lng: p.lng, label: `${p.id} — ${p.distanceKm} km ${p.direction} of Mumbai Harbour` },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      units: { distanceKm: "km", sst: "°C", chlorophyll: "mg/m³", depthM: "m" },
      confidence: p.confidence, quality: "simulated position — replace with INCOIS WebGIS nodes",
      data: p satisfies DemoPfz as unknown as Record<string, unknown>,
    });
  }
  return out;
}

// ---- Demo fixtures, honestly labelled ----
export function adaptOsfDemo(): NormalizedRecord[] {
  return demoOsfRecords();
}

export function adaptImdDemo(): NormalizedRecord[] {
  return demoImdAlerts();
}

export function adaptMpaCurated(): NormalizedRecord[] {
  return CURATED_MPAS.map((z, i) => ({
    id: `mpa-${i}`, kind: "mpa" as const, dataMode: "demo" as DataMode, isMock: true,
    source: { name: "Curated MPA boxes (WDPA shape pending API token)", url: "https://www.protectedplanet.net", retrievedAt: nowISO() },
    geometry: { type: "Polygon", coordinates: [z.polygon.map(([la, ln]) => [ln, la])] },
    units: {}, quality: "simplified bounding boxes, not legal boundaries",
    data: { name: z.name, note: z.note },
  }));
}

export function adaptEezDemo(): NormalizedRecord[] {
  return [{
    id: "eez-west", kind: "eez", dataMode: "demo", isMock: true,
    source: { name: "Simplified EEZ line (VLIZ shape pending download)", url: "https://www.marineregions.org", retrievedAt: nowISO() },
    geometry: { type: "LineString", coordinates: DEMO_EEZ_LINE.map(([la, ln]) => [ln, la]) },
    units: {}, quality: "coarse demo line — not for navigation",
    data: { name: "India west-coast EEZ outer limit (simplified)" },
  }];
}

export function adaptGebcoDemo(lat: number, lng: number): NormalizedRecord {
  return demoDepthAt(lat, lng).record;
}

export async function adaptPortsLive(): Promise<NormalizedRecord[]> {
  try {
    const p = await j<{ ports: { name: string; lat: number; lng: number }[]; source: string }>("/api/geo/ports?s=15.5&w=72&n=20&e=74.5");
    const demo = p.source.includes("fallback");
    return p.ports.map((pt, i) => ({
      id: `port-${i}`, kind: "port" as const, dataMode: (demo ? "demo" : "live") as DataMode, isMock: demo,
      source: { name: p.source, url: "https://www.openstreetmap.org", retrievedAt: nowISO() },
      location: { lat: pt.lat, lng: pt.lng, label: pt.name },
      geometry: { type: "Point", coordinates: [pt.lng, pt.lat] },
      units: {}, data: pt,
    }));
  } catch {
    return CURATED_PORTS.map((pt, i) => ({
      id: `port-c-${i}`, kind: "port" as const, dataMode: "demo" as DataMode, isMock: true,
      source: { name: "Curated major ports", url: "https://www.openstreetmap.org", retrievedAt: nowISO() },
      location: { lat: pt.lat, lng: pt.lng, label: pt.name },
      geometry: { type: "Point", coordinates: [pt.lng, pt.lat] },
      units: {}, data: pt,
    }));
  }
}

// ---- Explicitly unavailable (needs keys/tokens the user doesn't have yet) ----
export function adaptUnavailable(): NormalizedRecord[] {
  const t = nowISO();
  const u = (id: string, kind: NormalizedRecord["kind"], name: string, url: string, note: string): NormalizedRecord => ({
    id, kind, dataMode: "unavailable", isMock: false,
    source: { name, url, retrievedAt: t }, units: {}, quality: note, data: null,
  });
  return [
    u("mosdac", "sst", "ISRO MOSDAC ocean products", "https://www.mosdac.gov.in", "needs free MOSDAC SSO registration"),
    u("cmems", "current", "Copernicus Marine (CMEMS)", "https://marine.copernicus.eu", "needs free Copernicus registration"),
    u("sachet", "alert", "NDMA SACHET CAP feed", "https://sachet.ndma.gov.in", "needs agency endpoint identifier"),
    u("gfw", "vessel-activity", "Global Fishing Watch AIS", "https://globalfishingwatch.org", "needs API token — optional enrichment"),
    u("bhuvan", "port", "Bhuvan Geoportal layers", "https://bhuvan-app1.nrsc.gov.in", "needs registration for WMS/WFS layers"),
  ];
}
