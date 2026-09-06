// Transparent vessel-specific risk model.
// Every rule, threshold and contribution is exposed so the UI can show
// exactly WHY a verdict was reached — no black boxes.
export type RiskLevel = "Low" | "Medium" | "High" | "Severe";
export type Recommendation =
  | "Safe"
  | "Safe with caution"
  | "Avoid offshore travel"
  | "Do not venture into the sea";

export interface VesselProfile {
  type: "small" | "trawler" | "research";
  label: string;
  speedKts: number;
  maxWindKts: number;
  maxWaveM: number;
  minDepthM: number;
}

export const VESSELS: Record<VesselProfile["type"], VesselProfile> = {
  small: { type: "small", label: "Small craft", speedKts: 12, maxWindKts: 25, maxWaveM: 2.0, minDepthM: 5 },
  trawler: { type: "trawler", label: "Trawler", speedKts: 9, maxWindKts: 30, maxWaveM: 2.5, minDepthM: 8 },
  research: { type: "research", label: "Research vessel", speedKts: 15, maxWindKts: 35, maxWaveM: 3.0, minDepthM: 10 },
};

export interface RiskInput {
  windKts: number;
  gustKts?: number;
  waveM: number;
  wavePeriodS?: number;
  swellM?: number;
  lightning: boolean;
  cycloneKm?: number | null;
  visibilityKm?: number;
  rainMmHr?: number;
  vessel: VesselProfile;
  routeKm?: number;
  minDepthOnRouteM?: number;
  mpaIntrusionKm?: number | null; // distance to nearest restricted zone (null = none nearby)
  eezCrossing?: boolean;
  forecastConfidence?: number; // 0-100
  forecastWindow?: string;
}

export interface RiskFactor {
  factor: string;
  value: string;
  threshold: string;
  exceeded: boolean;
  points: number;
  supports: boolean;
}

export interface RiskResult {
  level: RiskLevel;
  recommendation: Recommendation;
  score: number;
  factors: RiskFactor[];
  supporters: string[];
  thresholdsExceeded: string[];
  confidence: number;
  vessel: string;
  disclaimer: string;
}

export const RISK_DISCLAIMER =
  "Advisory only — official INCOIS/IMD marine advisories and port authority instructions take precedence. Never venture out against a live government warning.";

export function assessRisk(inp: RiskInput): RiskResult {
  const v = inp.vessel;
  const F: RiskFactor[] = [];
  const fx = (
    factor: string, value: string, threshold: string,
    exceeded: boolean, points: number, supports = false,
  ) => F.push({ factor, value, threshold, exceeded, points, supports });

  fx("Wind speed", `${inp.windKts} kts`, `≤ ${v.maxWindKts} kts (${v.label})`, inp.windKts > v.maxWindKts, 3);
  if (inp.gustKts != null) fx("Wind gusts", `${inp.gustKts} kts`, `≤ ${v.maxWindKts + 10} kts`, inp.gustKts > v.maxWindKts + 10, 1);
  fx("Wave height", `${inp.waveM.toFixed(1)} m`, `≤ ${v.maxWaveM.toFixed(1)} m (${v.label})`, inp.waveM > v.maxWaveM, 3);
  if (inp.wavePeriodS != null) fx("Wave period", `${inp.wavePeriodS.toFixed(0)} s`, `≥ 6 s (short chop is worse)`, inp.wavePeriodS < 6, 1);
  if (inp.swellM != null) fx("Swell", `${inp.swellM.toFixed(1)} m`, `≤ 2.0 m`, inp.swellM > 2.0, 1);
  fx("Lightning", inp.lightning ? "cells nearby" : "none detected", "none within 30 km", inp.lightning, 2);
  if (inp.cycloneKm != null) {
    fx("Cyclone distance", `${Math.round(inp.cycloneKm)} km`, `> 300 km`, inp.cycloneKm < 300, inp.cycloneKm < 150 ? 4 : 2);
  }
  if (inp.visibilityKm != null) fx("Visibility", `${inp.visibilityKm.toFixed(1)} km`, `≥ 2 km`, inp.visibilityKm < 2, 1);
  if (inp.rainMmHr != null) fx("Rainfall", `${inp.rainMmHr.toFixed(1)} mm/hr`, `< 8 mm/hr`, inp.rainMmHr >= 8, 1);
  if (inp.minDepthOnRouteM != null) {
    fx("Shallowest depth on route", `${inp.minDepthOnRouteM.toFixed(0)} m`, `≥ ${v.minDepthM} m (${v.label})`, inp.minDepthOnRouteM < v.minDepthM, 2);
  }
  if (inp.mpaIntrusionKm != null) {
    fx("Restricted-zone proximity", `${inp.mpaIntrusionKm.toFixed(1)} km`, `≥ 2 km clearance`, inp.mpaIntrusionKm < 2, 1);
  }
  if (inp.eezCrossing) fx("EEZ / boundary crossing", "crosses boundary line", "stay inside EEZ", true, 1);

  // Supporting (safe) conditions are the non-exceeded core factors.
  const supporters = F.filter(f => !f.exceeded && ["Wind speed", "Wave height", "Lightning"].includes(f.factor))
    .map(f => `${f.factor} ${f.value} — within limits`);

  let score = F.reduce((s, f) => s + (f.exceeded ? f.points : 0), 0);
  // Hard rules that dominate the score.
  if (inp.lightning) score = Math.max(score, 2);
  if (inp.cycloneKm != null && inp.cycloneKm < 150) score = Math.max(score, 6);
  if (inp.waveM > v.maxWaveM || inp.windKts > v.maxWindKts) score = Math.max(score, 6);

  const level: RiskLevel = score >= 6 ? "Severe" : score >= 4 ? "High" : score >= 2 ? "Medium" : "Low";
  const recommendation: Recommendation =
    level === "Low" ? "Safe"
    : level === "Medium" ? "Safe with caution"
    : level === "High" ? "Avoid offshore travel"
    : "Do not venture into the sea";

  const thresholdsExceeded = F.filter(f => f.exceeded).map(f => `${f.factor}: ${f.value} (limit ${f.threshold})`);
  const confidence = Math.max(35, Math.min(95, inp.forecastConfidence ?? 70));

  return {
    level, recommendation, score,
    factors: F, supporters, thresholdsExceeded, confidence,
    vessel: v.label, disclaimer: RISK_DISCLAIMER,
  };
}
