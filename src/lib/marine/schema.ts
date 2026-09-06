// ORCA normalized data schema (PDF §2–3).
// EVERY record from any adapter carries source metadata + a data-mode flag.
// Nothing simulated may ever be presented as Live.
export type DataMode = "live" | "demo" | "forecast" | "unavailable";

export interface SourceMeta {
  name: string;
  url: string;
  retrievedAt: string; // ISO
  validFrom?: string;
  validTo?: string;
}

export type Geometry =
  | { type: "Point"; coordinates: [number, number] } // [lng, lat]
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "LineString"; coordinates: [number, number][] };

export interface NormalizedRecord<T = unknown> {
  id: string;
  kind:
    | "pfz" | "sst" | "chlorophyll" | "salinity" | "current"
    | "wind" | "wave" | "tide" | "rain" | "lightning" | "cyclone" | "alert"
    | "port" | "eez" | "mpa" | "bathymetry" | "route" | "vessel-activity";
  dataMode: DataMode;
  /** true when the values are simulated/curated rather than observed */
  isMock: boolean;
  source: SourceMeta;
  observedAt?: string;
  validFrom?: string;
  validTo?: string;
  geometry?: Geometry;
  location?: { lat: number; lng: number; label: string };
  units: Record<string, string>;
  /** 0–100 where applicable */
  confidence?: number;
  quality?: string;
  data: T;
}

export const DATA_MODE_LABEL: Record<DataMode, string> = {
  live: "Live",
  demo: "Demo data",
  forecast: "Forecast",
  unavailable: "Unavailable",
};

export function nowISO(): string {
  return new Date().toISOString();
}
