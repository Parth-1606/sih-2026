// Real route planning: Open-Meteo geocoding for endpoints + OSRM public
// server (OpenStreetMap road network) for true geometry with turn-by-turn
// steps. Geodesic interpolation is the honest fallback, labeled as such.
import { searchPlaces } from "./marine-api";
import { userLocation } from "./mock";

export interface RoutePoint {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteStep {
  instruction: string;
  distanceKm: number;
}

export interface RouteResult {
  coords: [number, number][]; // [lat, lng]
  distanceKm: number;
  durationMin: number;
  steps: RouteStep[];
  source: "OSRM (OpenStreetMap road network)" | "Geodesic fallback (OSRM unreachable)";
}

export async function resolvePlace(text: string): Promise<RoutePoint> {
  const t = text.trim();
  if (!t) throw new Error("Empty location");
  if (/my location/i.test(t)) {
    return { name: `My Location (${userLocation.latitude},${userLocation.longitude})`, lat: userLocation.latitude, lng: userLocation.longitude };
  }
  const m = t.match(/(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)/);
  if (m) return { name: t, lat: parseFloat(m[1]), lng: parseFloat(m[3]) };
  const r = await searchPlaces(t);
  if (!r.length) throw new Error(`Could not find "${t}" — try "City" or "lat,lng"`);
  return { name: r[0].name, lat: r[0].lat, lng: r[0].lng };
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function synthStep(s: { maneuver?: { type?: string; modifier?: string; instruction?: string }; name?: string }): string {
  if (s.maneuver?.instruction) return s.maneuver.instruction;
  const t = (s.maneuver?.type ?? "continue").replace(/_/g, " ");
  const mod = s.maneuver?.modifier ? ` ${s.maneuver.modifier}` : "";
  const road = s.name ? ` onto ${s.name}` : "";
  return `${t.charAt(0).toUpperCase() + t.slice(1)}${mod}${road}`;
}

export async function fetchRoadRoute(a: RoutePoint, b: RoutePoint): Promise<RouteResult> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}` +
    `?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const j = await res.json();
  if (j.code !== "Ok" || !j.routes?.length) throw new Error("OSRM returned no route");
  const r = j.routes[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coords: [number, number][] = r.geometry.coordinates.map((c: any) => [c[1], c[0]]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: RouteStep[] = r.legs.flatMap((leg: any) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    leg.steps.map((s: any) => ({ instruction: synthStep(s), distanceKm: Math.round(s.distance / 100) / 10 }))
  );
  return {
    coords,
    distanceKm: Math.round((r.distance / 1000) * 10) / 10,
    durationMin: Math.round(r.duration / 60),
    steps,
    source: "OSRM (OpenStreetMap road network)",
  };
}

export function geodesicRoute(a: RoutePoint, b: RoutePoint, vesselKts = 12): RouteResult {
  const N = 32;
  const coords: [number, number][] = Array.from({ length: N + 1 }, (_, i) => [
    a.lat + ((b.lat - a.lat) * i) / N,
    a.lng + ((b.lng - a.lng) * i) / N,
  ]);
  const d = haversineKm(a.lat, a.lng, b.lat, b.lng);
  return {
    coords,
    distanceKm: Math.round(d * 10) / 10,
    durationMin: Math.round((d / (vesselKts * 1.852)) * 60),
    steps: [{ instruction: `Head directly from ${a.name} to ${b.name} (great-circle, no road network)`, distanceKm: Math.round(d * 10) / 10 }],
    source: "Geodesic fallback (OSRM unreachable)",
  };
}

export function boundsOf(coords: [number, number][]) {
  let s = 90, w = 180, n = -90, e = -180;
  for (const [lat, lng] of coords) {
    if (lat < s) s = lat;
    if (lat > n) n = lat;
    if (lng < w) w = lng;
    if (lng > e) e = lng;
  }
  const pad = 0.15;
  return { s: s - pad, w: w - pad, n: n + pad, e: e + pad };
}
