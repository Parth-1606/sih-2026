// Seeded coastal-India demo scenarios + clearly-labelled Demo fixtures.
// Live adapters override these wherever a real feed exists; anything still
// coming from here is ALWAYS presented with dataMode: "demo".
import type { NormalizedRecord } from "./schema";
import { nowISO } from "./schema";

export interface Scenario {
  id: string;
  harbour: string;
  state: string;
  lat: number;
  lng: number;
  buoy: { lat: number; lng: number };
}

export const SCENARIOS: Scenario[] = [
  { id: "mumbai", harbour: "Mumbai Harbour", state: "Maharashtra", lat: 18.93, lng: 72.9, buoy: { lat: 18.7, lng: 72.4 } },
  { id: "alibaug", harbour: "Alibaug", state: "Maharashtra", lat: 18.64, lng: 72.87, buoy: { lat: 18.55, lng: 72.45 } },
  { id: "ratnagiri", harbour: "Ratnagiri", state: "Maharashtra", lat: 16.98, lng: 73.27, buoy: { lat: 16.85, lng: 72.9 } },
  { id: "goa", harbour: "Mormugao (Goa)", state: "Goa", lat: 15.4, lng: 73.79, buoy: { lat: 15.3, lng: 73.4 } },
  { id: "kochi", harbour: "Kochi", state: "Kerala", lat: 9.96, lng: 76.2, buoy: { lat: 9.85, lng: 75.85 } },
  { id: "chennai", harbour: "Chennai", state: "Tamil Nadu", lat: 13.1, lng: 80.29, buoy: { lat: 13.15, lng: 80.55 } },
  { id: "vizag", harbour: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.68, lng: 83.27, buoy: { lat: 17.7, lng: 83.55 } },
  { id: "paradip", harbour: "Paradip", state: "Odisha", lat: 20.26, lng: 86.66, buoy: { lat: 20.2, lng: 86.95 } },
];

export const DEFAULT_SCENARIO = SCENARIOS[0];

// Demo PFZ set offshore Mumbai Harbour (positions consistent with the
// INCOIS advisory format: lat/long + distance/direction from landing centre).
export interface DemoPfz {
  id: string; lat: number; lng: number;
  distanceKm: number; direction: string;
  sst: number; chlorophyll: number; productivity: "HIGH" | "MEDIUM" | "LOW";
  confidence: number; depthM: number;
}

export const DEMO_PFZ: DemoPfz[] = [
  { id: "PFZ-001", lat: 18.8, lng: 72.6, distanceKm: 32, direction: "SW", sst: 27.8, chlorophyll: 0.92, productivity: "HIGH", confidence: 91, depthM: 28 },
  { id: "PFZ-002", lat: 19.02, lng: 72.72, distanceKm: 21, direction: "NW", sst: 28.3, chlorophyll: 0.81, productivity: "HIGH", confidence: 84, depthM: 22 },
  { id: "PFZ-003", lat: 18.62, lng: 72.8, distanceKm: 34, direction: "S", sst: 28.0, chlorophyll: 0.76, productivity: "MEDIUM", confidence: 72, depthM: 31 },
];

const DEMO_SRC = (name: string, url: string) => ({
  name, url, retrievedAt: nowISO(),
});

// Demo Ocean State Forecast (INCOIS OSF shape, simulated values).
export function demoOsfRecords(): NormalizedRecord[] {
  const t = nowISO();
  const mk = <T>(id: string, kind: NormalizedRecord["kind"], data: T, units: Record<string, string>, extra = {}): NormalizedRecord<T> => ({
    id, kind, dataMode: "demo", isMock: true,
    source: DEMO_SRC("Demo Ocean State Forecast (INCOIS OSF shape)", "https://incois.gov.in/portal/osf/osf.jsp"),
    observedAt: t,
    validFrom: t,
    validTo: new Date(Date.now() + 5 * 86400 * 1000).toISOString(),
    location: { lat: 18.7, lng: 72.4, label: "Offshore Mumbai" },
    units, quality: "simulated — replace with INCOIS OSF feed", data, ...extra,
  });
  return [
    mk("osf-tide", "tide",
      { state: "Rising", nextHigh: "14:20 IST", nextLow: "02:40 IST", rangeM: 2.1 },
      { rangeM: "m" }),
    mk("osf-current", "current",
      { speedMs: 0.32, directionDeg: 215, direction: "SW" },
      { speedMs: "m/s", directionDeg: "°" }),
    mk("osf-swell", "wave",
      { swellM: 1.1, swellDirDeg: 230, swellPeriodS: 9 },
      { swellM: "m", swellDirDeg: "°", swellPeriodS: "s" }),
    mk("osf-salinity", "salinity",
      { psu: 35.6 },
      { psu: "PSU" }),
  ];
}

// Demo IMD-style alerts (shape matches IMD/SACHET CAP fields).
export function demoImdAlerts(): NormalizedRecord[] {
  const t = nowISO();
  return [
    {
      id: "demo-imd-001", kind: "alert", dataMode: "demo", isMock: true,
      source: DEMO_SRC("Demo IMD advisory (shape of IMD cyclone bulletin)", "https://mausam.imd.gov.in"),
      observedAt: t, validFrom: t, validTo: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
      location: { lat: 18.6, lng: 72.6, label: "Eastern offshore" },
      units: {}, quality: "simulated",
      data: {
        severity: "warning", type: "strong_wind", title: "Increasing wind expected",
        description: "Wind 18–22 kts expected post-noon. Small craft advisory.",
        cycloneKm: null, lightning: false,
      },
    },
    {
      id: "demo-imd-002", kind: "alert", dataMode: "demo", isMock: true,
      source: DEMO_SRC("Demo SACHET CAP record (shape of NDMA CAP-XML)", "https://sachet.ndma.gov.in"),
      observedAt: t, validFrom: t, validTo: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
      location: { lat: 18.4, lng: 72.7, label: "Western offshore" },
      units: {}, quality: "simulated",
      data: {
        severity: "warning", type: "lightning", title: "Isolated lightning cells",
        description: "Lightning density 4–6 strokes/hr. Radar echo building.",
        cycloneKm: null, lightning: true,
      },
    },
  ];
}

// Simplified India west-coast EEZ outer limit (Demo — coarse polyline traced
// for demo geofencing, NOT for navigation; full VLIZ polygons need download).
export const DEMO_EEZ_LINE: [number, number][] = [
  [23.6, 65.4], [21.5, 66.2], [19.0, 67.8], [16.5, 69.2],
  [14.0, 70.8], [11.0, 72.8], [8.5, 74.2], [7.0, 75.5],
];

// Demo bathymetry: depth grows with distance from coastal anchors.
const COAST_ANCHORS: [number, number][] = [
  [18.93, 72.9], [18.64, 72.87], [16.98, 73.27], [15.4, 73.79],
  [9.96, 76.2], [13.1, 80.29], [17.68, 83.27], [20.26, 86.66],
];

export function demoDepthAt(lat: number, lng: number): { depthM: number; record: NormalizedRecord<{ depthM: number }> } {
  let best = Infinity;
  for (const [a, b] of COAST_ANCHORS) {
    const dLat = (lat - a) * 111.32;
    const dLng = (lng - b) * 111.32 * Math.cos((a * Math.PI) / 180);
    const d = Math.hypot(dLat, dLng);
    if (d < best) best = d;
  }
  const depthM = Math.round(Math.min(80, 6 + best * 1.1));
  return {
    depthM,
    record: {
      id: `depth-${lat.toFixed(2)}-${lng.toFixed(2)}`, kind: "bathymetry",
      dataMode: "demo", isMock: true,
      source: DEMO_SRC("Demo bathymetry (GEBCO shape, modelled)", "https://www.gebco.net"),
      observedAt: nowISO(),
      location: { lat, lng, label: `${lat.toFixed(2)}, ${lng.toFixed(2)}` },
      units: { depthM: "m" }, quality: "modelled from coastal distance — replace with GEBCO grid",
      data: { depthM },
    },
  };
}

// Demo 24h tide curve (harmonic-style, simulated).
export function demoTideSeries(): { time: string; heightM: number }[] {
  const out: { time: string; heightM: number }[] = [];
  const start = Date.now() - 6 * 3600 * 1000;
  for (let i = 0; i < 25; i++) {
    const t = start + i * 3600 * 1000;
    out.push({
      time: new Date(t).toISOString(),
      heightM: Math.round((1.1 + 0.9 * Math.sin(i / 3.1) + 0.25 * Math.sin(i / 1.3)) * 100) / 100,
    });
  }
  return out;
}
