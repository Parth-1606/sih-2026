// Pure geospatial helpers (no dependencies). All coords [lat, lng] unless noted.

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const y = Math.sin(((bLng - aLng) * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180);
  const x =
    Math.cos((aLat * Math.PI) / 180) * Math.sin((bLat * Math.PI) / 180) -
    Math.sin((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.cos(((bLng - aLng) * Math.PI) / 180);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function compass16(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

/** Destination point given start, bearing (deg) and distance (km). */
export function destPoint(lat: number, lng: number, bearing: number, km: number): [number, number] {
  const R = 6371;
  const d = km / R;
  const br = (bearing * Math.PI) / 180;
  const la1 = (lat * Math.PI) / 180;
  const lo1 = (lng * Math.PI) / 180;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br));
  const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [(la2 * 180) / Math.PI, (((lo2 * 180) / Math.PI + 540) % 360) - 180];
}

export type LatLng = [number, number];

/** Ray-casting point-in-polygon. Polygon as [lat, lng] ring. */
export function pointInPolygon(lat: number, lng: number, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = [poly[i][0], poly[i][1]];
    const [xj, yj] = [poly[j][0], poly[j][1]];
    if (yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDistKm(pLat: number, pLng: number, a: LatLng, b: LatLng): number {
  // Equirectangular approximation — fine for km-scale demo checks.
  const kx = Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
  const dx = (b[1] - a[1]) * kx;
  const dy = b[0] - a[0];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : (((pLng - a[1]) * kx * dx + (pLat - a[0]) * dy) / len2);
  t = Math.max(0, Math.min(1, t));
  const dLat = (pLat - (a[0] + t * dy)) * 111.32;
  const dLng = (pLng - (a[1] + t * dx)) * 111.32;
  return Math.hypot(dLat, dLng);
}

/** Minimum distance from a point to a polygon ring (km). */
export function distanceToPolygonKm(lat: number, lng: number, poly: LatLng[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const d = segDistKm(lat, lng, poly[i], poly[(i + 1) % poly.length]);
    if (d < best) best = d;
  }
  return best;
}

function segsCross(a1: LatLng, a2: LatLng, b1: LatLng, b2: LatLng): boolean {
  const d = (p: LatLng, q: LatLng, r: LatLng) =>
    (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  const d1 = d(b1, b2, a1);
  const d2 = d(b1, b2, a2);
  const d3 = d(a1, a2, b1);
  const d4 = d(a1, a2, b2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True if any route segment touches/crosses the polygon ring. */
export function routeIntersectsPolygon(route: LatLng[], poly: LatLng[]): boolean {
  if (route.some(([la, ln]) => pointInPolygon(la, ln, poly))) return true;
  for (let i = 0; i < route.length - 1; i++) {
    for (let j = 0; j < poly.length; j++) {
      if (segsCross(route[i], route[i + 1], poly[j], poly[(j + 1) % poly.length])) return true;
    }
  }
  return false;
}

/** True if any route segment crosses a boundary polyline. */
export function routeCrossesLine(route: LatLng[], line: LatLng[]): boolean {
  for (let i = 0; i < route.length - 1; i++) {
    for (let j = 0; j < line.length - 1; j++) {
      if (segsCross(route[i], route[i + 1], line[j], line[j + 1])) return true;
    }
  }
  return false;
}
