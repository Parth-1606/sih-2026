// Curated fallback geography — real, well-known coordinates used when the
// live source (Overpass/VLIZ) is unreachable. Always labeled as curated in
// responses so demo data is never mistaken for a live feed.

export interface CuratedPort {
  name: string;
  lat: number;
  lng: number;
  kind: "major" | "minor";
}

export const CURATED_PORTS: CuratedPort[] = [
  { name: "Mumbai Port", lat: 18.94, lng: 72.94, kind: "major" },
  { name: "Nhava Sheva (JNPT)", lat: 18.95, lng: 73.02, kind: "major" },
  { name: "Ratnagiri", lat: 16.99, lng: 73.27, kind: "minor" },
  { name: "Mormugao (Goa)", lat: 15.41, lng: 73.79, kind: "major" },
  { name: "Kochi", lat: 9.97, lng: 76.24, kind: "major" },
  { name: "Chennai", lat: 13.1, lng: 80.29, kind: "major" },
];

export interface MarineProtectedArea {
  name: string;
  polygon: [number, number][]; // [lat, lng]
  note: string;
}

// Simplified bounding boxes of real MPAs (full WDPA polygons need the
// Protected Planet API token — PDF §2.3). Boxes are conservative.
export const CURATED_MPAS: MarineProtectedArea[] = [
  {
    name: "Malvan Marine Sanctuary (restricted)",
    polygon: [
      [16.12, 73.36],
      [16.12, 73.5],
      [15.98, 73.5],
      [15.98, 73.36],
    ],
    note: "No-fishing core zone — geofence alert",
  },
  {
    name: "Gulf of Kachchh Marine NP (restricted)",
    polygon: [
      [22.6, 69.5],
      [22.6, 69.95],
      [22.35, 69.95],
      [22.35, 69.5],
    ],
    note: "Marine National Park — restricted",
  },
];
