import type { Conditions, Pfz, Alert } from "./types";

export const mockConditions: Conditions = { sst: 28.1, chlorophyll: 0.74, wave_height: 0.8, wind_speed: 14, wind_direction: "SW", visibility: 9.2, tide: "Rising" };
export const userLocation = { latitude: 18.93, longitude: 72.9, label: "Mumbai Harbour • 18.93°N, 72.90°E" };

export const pfzData: Pfz[] = [
  { id: "PFZ-001", distance_km: 32, direction: "SW", sst: 27.8, chlorophyll: 0.92, productivity: "HIGH", confidence: 91, lat: 18.8, lng: 72.6 },
  { id: "PFZ-002", distance_km: 21, direction: "NW", sst: 28.3, chlorophyll: 0.81, productivity: "HIGH", confidence: 84, lat: 19.02, lng: 72.72 },
  { id: "PFZ-003", distance_km: 34, direction: "S", sst: 28.0, chlorophyll: 0.76, productivity: "MEDIUM", confidence: 72, lat: 18.62, lng: 72.8 },
];

export const alerts: Alert[] = [
  { id: "ALT-001", severity: "warning", type: "strong_wind", title: "Increasing wind expected", location: "Eastern offshore region", valid_until: "18:00", issued_at: "06:30 IST", description: "Wind intensity 18–22 kts expected post-noon. Small craft advisory.", source: "INCOIS • IMD", },
  { id: "ALT-002", severity: "info", type: "fishing_advisory", title: "Favourable fishing conditions", location: "Southwest offshore region", valid_until: "Tomorrow 06:00", issued_at: "05:00 IST", description: "High chlorophyll convergence detected southwest of current position. Confidence 91%.", source: "PFZ Advisory" },
  { id: "ALT-003", severity: "info", type: "high_waves", title: "Moderate swell — southern sector", location: "Arabian Sea • 120km SW", valid_until: "14:00 IST", issued_at: "04:00 IST", description: "Wave height 1.8–2.1m, period 8s. Avoid open crossing before 14:00.", source: "INCOIS Wave Model" },
  { id: "ALT-004", severity: "warning", type: "lightning", title: "Isolated lightning cells", location: "Western offshore • 45km W", valid_until: "11:00 IST", issued_at: "07:15 IST", description: "Lightning density 4–6 strokes/hr. Radar echo building.", source: "IMD Lightning" },
];

export const forecast = [
  { day: "Today", wind: 14, wave: 0.8, sst: 28.1, risk: "LOW" },
  { day: "Tomorrow", wind: 18, wave: 1.2, sst: 27.9, risk: "MEDIUM" },
  { day: "Wed", wind: 22, wave: 1.8, sst: 27.6, risk: "MEDIUM" },
  { day: "Thu", wind: 11, wave: 0.6, sst: 28.3, risk: "LOW" },
];

export const sstHistory = [
  { date: "Apr 06", value: 27.4 }, { date: "Apr 10", value: 27.6 }, { date: "Apr 14", value: 27.9 }, { date: "Apr 18", value: 28.0 }, { date: "Apr 22", value: 28.1 }, { date: "Apr 26", value: 27.8 }, { date: "May 01", value: 28.1 },
];
export const chlHistory = [
  { date: "Apr 06", value: 0.62 }, { date: "Apr 10", value: 0.68 }, { date: "Apr 14", value: 0.71 }, { date: "Apr 18", value: 0.74 }, { date: "Apr 22", value: 0.72 }, { date: "Apr 26", value: 0.79 }, { date: "May 01", value: 0.74 },
];
export const waveForecast = Array.from({ length: 24 }, (_, i) => ({ h: `${String(i).padStart(2, "0")}:00`, v: 0.6 + Math.sin(i / 4) * 0.4 + (i > 14 ? 0.6 : 0) }));
export const windForecast = Array.from({ length: 24 }, (_, i) => ({ h: `${String(i).padStart(2, "0")}:00`, v: 12 + Math.cos(i / 3) * 4 + (i > 14 ? 6 : 0) }));

// Mock services — api-ready interfaces
export const marineService = {
  getConditions: async () => mockConditions,
  getPFZ: async () => pfzData,
  getAlerts: async () => alerts,
};
export const weatherService = { getForecast: async () => forecast };
export const pfzService = { list: async () => pfzData };
export const alertService = { list: async () => alerts };
export const geospatialService = { getLocation: async () => userLocation };
export const aiService = {
  async query(q: string) {
    // tiny heuristic
    const lower = q.toLowerCase();
    if (lower.includes("pfz") || lower.includes("fishing")) return { answer: "Nearest PFZ is PFZ-001, 18.4 km NE (91% confidence, 0.92 mg/m³ chlorophyll, SST 27.8°C). Productivity HIGH. Recommendation: depart before 11:00 to avoid wind build-up.", pfz: pfzData[0] };
    if (lower.includes("safe") || lower.includes("tomorrow")) return { answer: "Tomorrow morning: MODERATE risk. Wind 18 kts, wave 1.2m. Nearshore safe until ~11:00, offshore MEDIUM after noon due to wind increase (ALT-001). Prefer northern sector.", risk: "MEDIUM" };
    if (lower.includes("cyclone") || lower.includes("alert")) return { answer: "No cyclone warning. 2 Warnings (strong wind, lightning) + 2 Info. Strong wind advisory eastern offshore valid until 18:00.", alerts: alerts.slice(0, 2) };
    if (lower.includes("sst") || lower.includes("temperature")) return { answer: "Current SST 28.1°C (+0.4°C trend). Warmest anomaly NE zone (PFZ-001). Chlorophyll 0.74 mg/m³ — productive.", sst: 28.1 };
    return { answer: "Conditions favourable nearshore today (LOW RISK, wave 0.8m, tide rising). High-productivity zone NE at 18.4km. Wind will intensify later — plan return before afternoon.", pfz: pfzData[0] };
  }
};
