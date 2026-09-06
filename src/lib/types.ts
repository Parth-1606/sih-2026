export type Severity = "safe" | "warning" | "danger" | "info" | "critical";
export type AlertType = "cyclone" | "lightning" | "high_waves" | "strong_wind" | "geofence" | "fishing_advisory";
export interface Pfz {
  id: string; distance_km: number; direction: string; sst: number; chlorophyll: number; productivity: "HIGH" | "MEDIUM" | "LOW"; confidence: number;
  lat?: number; lng?: number;
}
export interface Alert {
  id: string; severity: Severity; type: AlertType; title: string; location: string; issued_at?: string; valid_until?: string; description?: string; source?: string;
}
export interface Conditions {
  sst: number; chlorophyll: number; wave_height: number; wind_speed: number; wind_direction: string; visibility: number; tide: string;
}
export interface MarineMapLayer { id: string; label: string; enabled: boolean }
