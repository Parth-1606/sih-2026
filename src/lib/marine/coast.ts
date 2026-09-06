// Curated Maharashtra/Goa coastline + demo bathymetry.
// The coast polyline lets the router prove every interior waypoint is on
// WATER (west of the shore). Coverage ≈ 15.5–19.6°N; outside that band the
// router falls back to generic offshore push and says so.
import type { LatLng } from "./geo";

// [lat, lng] tracing the shore northward. Simplified — not for navigation.
const COAST: LatLng[] = [
  [15.5, 73.75], [15.8, 73.65], [16.2, 73.45], [16.6, 73.3],
  [17.0, 73.15], [17.3, 73.1], [17.7, 73.05], [18.0, 72.95],
  [18.3, 72.9], [18.55, 72.85], [18.75, 72.83], [18.95, 72.88],
  [19.2, 72.8], [19.6, 72.75],
];

export function coastLngAt(lat: number): number | null {
  if (lat < COAST[0][0] || lat > COAST[COAST.length - 1][0]) return null;
  for (let i = 0; i < COAST.length - 1; i++) {
    const [la1, ln1] = COAST[i];
    const [la2, ln2] = COAST[i + 1];
    if (lat >= la1 && lat <= la2) {
      const t = la2 === la1 ? 0 : (lat - la1) / (la2 - la1);
      return ln1 + (ln2 - ln1) * t;
    }
  }
  return null;
}

/** True when the point is on the water side (west) of the shore + margin. */
export function isWater(lat: number, lng: number, marginKm = 2): boolean {
  const shore = coastLngAt(lat);
  if (shore == null) return true; // outside curated band — assume water, flagged by caller
  const marginDeg = marginKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return lng < shore - marginDeg;
}

/** Demo depth: grows with distance west of the shore. Labelled Demo. */
export function demoDepthAt(lat: number, lng: number): number {
  const shore = coastLngAt(lat);
  const offKm = shore == null ? 20 : Math.max(0, (shore - lng) * 111.32 * Math.cos((lat * Math.PI) / 180));
  return Math.round(Math.min(80, 6 + offKm * 1.1));
}
