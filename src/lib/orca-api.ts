// Client for the ORCA FastAPI backend.
// Provides type-safe contracts for observations, deterministic anomalies,
// and collaborative multi-agent investigations.

export const ORCA_API_URL = process.env.NEXT_PUBLIC_ORCA_API_URL ?? "http://localhost:8000";

export interface HealthResponse {
  status: string;
  service: string;
  environment: string;
  time: string;
}

export interface Location {
  name: string;
  lat: number;
  lon: number;
}

export interface Observation {
  id: string;
  parameter: string;
  value: number;
  unit: string;
  location: Location;
  timestamp: string;
  source: string;
}

export type AnomalySeverity = "normal" | "moderate" | "severe" | "insufficient_data";
export type InvestigationStatus = "new" | "under_review" | "confirmed" | "rejected" | "needs_investigation";

export interface ConfidenceBreakdown {
  sample_size_factor: number;
  deviation_strength_factor: number;
}

export interface HistoricalPoint {
  timestamp: string;
  value: number;
}

export interface Evidence {
  baseline_sample_size: number;
  historical_points: HistoricalPoint[];
  data_source: string;
}

export interface AnomalyResult {
  id: string;
  observation_id: string;
  parameter: string;
  value: number;
  unit: string;
  location: Location;
  timestamp: string;
  baseline_mean: number | null;
  baseline_std: number | null;
  baseline_sample_size: number;
  z_score: number | null;
  deviation: number | null;
  severity: AnomalySeverity;
  confidence: number;
  confidence_breakdown: ConfidenceBreakdown;
  evidence: Evidence;
  investigation_status: InvestigationStatus | null;
  evaluated_at: string;
}

export type AgentStatus = "verified" | "contradicted" | "inconclusive" | "insufficient_evidence";
export type AgreementStatus = "unanimous_agreement" | "majority_agreement" | "disagreement" | "insufficient_evidence";
export type SynthesisStatus = "confirmed_anomaly" | "suspected_sensor_glitch" | "requires_further_data" | "benign_deviation";

export interface AgentResult {
  agent_name: string;
  status: AgentStatus;
  conclusion: string;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  evidence_ids: string[];
  confidence: number;
  confidence_basis: string;
  timestamp: string;
  warnings: string[];
}

export interface SynthesisResult {
  synthesis_status: SynthesisStatus;
  agreement_status: AgreementStatus;
  overall_conclusion: string;
  recommended_action: string;
  confidence: number;
  confidence_breakdown: Record<string, number>;
  primary_driver: string;
  key_findings: string[];
}

export interface Investigation {
  id: string;
  anomaly_id: string;
  anomaly: AnomalyResult;
  status: InvestigationStatus;
  agreement_status: AgreementStatus;
  agent_results: AgentResult[];
  synthesis: SynthesisResult;
  confidence: number;
  created_at: string;
  completed_at: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${ORCA_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) {
        errorDetail = errJson.detail;
      }
    } catch {
      // ignore
    }
    throw new Error(`ORCA API error (${path}): ${errorDetail}`);
  }

  return res.json();
}

export async function fetchBackendHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export async function fetchAnomalies(includeNormal = false): Promise<AnomalyResult[]> {
  return request<AnomalyResult[]>(`/api/anomalies?include_normal=${includeNormal}`);
}

export async function fetchAnomaly(anomalyId: string): Promise<AnomalyResult> {
  return request<AnomalyResult>(`/api/anomalies/${anomalyId}`);
}

export async function fetchObservations(parameter?: string): Promise<Observation[]> {
  const query = parameter ? `?parameter=${encodeURIComponent(parameter)}` : "";
  return request<Observation[]>(`/api/observations${query}`);
}

export async function triggerInvestigation(anomalyId: string): Promise<Investigation> {
  return request<Investigation>("/api/investigations", {
    method: "POST",
    body: JSON.stringify({ anomaly_id: anomalyId }),
  });
}

export async function fetchInvestigations(anomalyId?: string): Promise<Investigation[]> {
  const query = anomalyId ? `?anomaly_id=${encodeURIComponent(anomalyId)}` : "";
  return request<Investigation[]>(`/api/investigations${query}`);
}

export async function fetchInvestigation(investigationId: string): Promise<Investigation> {
  return request<Investigation>(`/api/investigations/${investigationId}`);
}
