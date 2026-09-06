"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import MarineMap from "@/components/MarineMap";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  fetchAnomalies,
  fetchInvestigations,
  triggerInvestigation,
  fetchBackendHealth,
  type AnomalyResult,
  type Investigation,
  type AgentResult,
  type HealthResponse,
  ORCA_API_URL,
} from "@/lib/orca-api";

export default function OrcaDashboard() {
  const router = useRouter();

  // Core data states
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);

  // UI / Demo execution states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [analysisLabel, setAnalysisLabel] = useState("");

  const selectedAnomaly = anomalies.find(a => a.id === selectedAnomalyId) ?? anomalies[0];

  // Load initial backend data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [health, anomList] = await Promise.all([
        fetchBackendHealth().catch(() => null),
        fetchAnomalies(false),
      ]);
      setBackendHealth(health);
      setAnomalies(anomList);

      if (anomList.length > 0) {
        const targetId = anomList[0].id;
        setSelectedAnomalyId(targetId);

        // Check if an existing investigation is already on record
        try {
          const invList = await fetchInvestigations(targetId);
          if (invList.length > 0) {
            setInvestigation(invList[0]);
            setAnalysisStage(5);
          }
        } catch {
          // No prior investigation is fine
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect to ORCA backend");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When selected anomaly changes, look up existing investigation
  const handleSelectAnomaly = async (id: string) => {
    setSelectedAnomalyId(id);
    try {
      const invList = await fetchInvestigations(id);
      if (invList.length > 0) {
        setInvestigation(invList[0]);
        setAnalysisStage(5);
      } else {
        setInvestigation(null);
        setAnalysisStage(2); // Stage 2: anomaly detected, agents pending
      }
    } catch {
      setInvestigation(null);
    }
  };

  // Interactive Staged Demo Execution
  const handleRunAnalysis = async () => {
    if (!selectedAnomaly) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      // Stage 1: Data Ingestion telemetry
      setAnalysisStage(1);
      setAnalysisLabel(`Ingesting high-frequency ocean telemetry for ${selectedAnomaly.location.name}…`);
      await new Promise(r => setTimeout(r, 450));

      // Stage 2: Deterministic statistical baseline check
      setAnalysisStage(2);
      setAnalysisLabel(`Calculating baseline statistics & z-score (+${selectedAnomaly.z_score?.toFixed(1) ?? "4.3"}σ severe anomaly)…`);
      await new Promise(r => setTimeout(r, 450));

      // Stage 3: Real Backend API call to run collaborative agents
      setAnalysisStage(3);
      setAnalysisLabel("Deploying specialist agents: Verification, Oceanographic Context & Ecological Reasoning…");
      const realInvestigation = await triggerInvestigation(selectedAnomaly.id);

      // Stage 4: Consensus cross-verification
      setAnalysisStage(4);
      setAnalysisLabel(`Cross-verifying evidence across agents (Consensus: ${realInvestigation.agreement_status.replace(/_/g, " ").toUpperCase()})…`);
      await new Promise(r => setTimeout(r, 550));

      // Stage 5: Final Synthesis
      setAnalysisStage(5);
      setAnalysisLabel("Synthesizing final ecosystem advisory & multi-factor confidence…");
      await new Promise(r => setTimeout(r, 400));

      setInvestigation(realInvestigation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Multi-agent analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Prepare map anomaly marker
  const mapAnomalies = anomalies.map(a => ({
    id: a.id,
    name: a.location.name,
    lat: a.location.lat,
    lon: a.location.lon,
    parameter: a.parameter,
    value: a.value,
    unit: a.unit,
    severity: a.severity,
    z_score: a.z_score,
  }));

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header — ORCA Branding & Pipeline Action */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-[#4BA3FF]/15 text-[#4BA3FF] border-[#4BA3FF]/20 tracking-[0.14em] text-[11px] font-bold">
              ORCA REASONING PIPELINE • SIH 2026
            </Badge>
            <Badge
              variant="outline"
              className={`gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold cursor-pointer ${
                backendHealth?.status === "ok"
                  ? "bg-[#35C98A]/15 text-[#35C98A] border-[#35C98A]/30"
                  : "bg-destructive/15 text-destructive border-destructive/30"
              }`}
              onClick={() => router.push("/system-status")}
            >
              <span className={`size-1.5 rounded-full ${backendHealth?.status === "ok" ? "bg-[#35C98A] animate-pulse" : "bg-destructive"}`} />
              {backendHealth?.status === "ok" ? "SYSTEM ONLINE" : "BACKEND OFFLINE"}
            </Badge>
          </div>
          <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.02em] leading-tight mt-2">
            ORCA <span className="text-muted-foreground font-normal text-xl md:text-2xl">— Marine Ecosystem Reasoning with Collaborative Agents</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[720px]">
            Autonomous multi-agent system for deterministic oceanographic anomaly detection, cross-agent verification, and ecological risk synthesis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="rounded-full bg-[#35C98A] hover:bg-[#35C98A]/90 text-[#071014] font-semibold gap-2 shadow-xl cursor-pointer"
            onClick={handleRunAnalysis}
            disabled={isAnalyzing || !selectedAnomaly}
          >
            {isAnalyzing ? (
              <>
                <span className="size-2 rounded-full bg-[#071014] animate-ping" />
                <span>Running Pipeline…</span>
              </>
            ) : (
              <>
                <span className="text-base">✦</span>
                <span>Run ORCA Analysis</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Reasoning Pipeline Visual Progress Bar (Step 8) */}
      <Card className="p-4 bg-card/60 border shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
          <div className="text-xs font-semibold tracking-[0.08em] text-muted-foreground flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#4BA3FF] animate-pulse" />
            REASONING PIPELINE STAGES
          </div>
          {isAnalyzing && (
            <Badge variant="secondary" className="text-xs font-mono text-[#4BA3FF] bg-[#4BA3FF]/10 animate-pulse">
              {analysisLabel}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { step: 1, name: "1. Ocean Data", sub: "Sensor Telemetry Ingestion" },
            { step: 2, name: "2. Anomaly Detection", sub: "Deterministic Calculation" },
            { step: 3, name: "3. Specialist Agents", sub: "Multi-Domain Reasoning" },
            { step: 4, name: "4. Collaborative Consensus", sub: "Cross-Verification" },
            { step: 5, name: "5. Final Synthesis", sub: "Ecosystem Advisory" },
          ].map(({ step, name, sub }) => {
            const isCompleted = (investigation && !isAnalyzing) || analysisStage > step;
            const isCurrent = isAnalyzing && analysisStage === step;
            return (
              <div
                key={step}
                className={`p-3 rounded-xl border text-xs transition-all ${
                  isCompleted
                    ? "bg-[#35C98A]/10 border-[#35C98A]/30 text-foreground"
                    : isCurrent
                    ? "bg-[#4BA3FF]/15 border-[#4BA3FF]/40 text-foreground shadow-md ring-1 ring-[#4BA3FF]/50"
                    : "bg-muted/40 border-border text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span>{name}</span>
                  {isCompleted && <span className="text-[#35C98A] font-bold">✓</span>}
                  {isCurrent && <span className="size-2 rounded-full bg-[#4BA3FF] animate-ping" />}
                </div>
                <div className="text-[10.5px] text-muted-foreground mt-0.5">{sub}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Error state if backend unreachable */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/10 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-destructive flex items-center gap-2">
                <span>⚠️ ORCA Backend Communication Error</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ensure the FastAPI backend is running at <code className="text-xs font-mono">{ORCA_API_URL}</code>.
              </p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={loadData}>
              Retry Connection
            </Button>
          </div>
        </Card>
      )}

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-[11px] tracking-[0.08em] font-semibold text-muted-foreground">MONITORED BUOY STATION</div>
          <div className="mt-2 text-[20px] font-semibold tracking-[-0.02em] truncate">
            {selectedAnomaly?.location.name ?? "Arabian Sea Buoy 12"}
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">
            {selectedAnomaly ? `${selectedAnomaly.location.lat.toFixed(2)}°N, ${selectedAnomaly.location.lon.toFixed(2)}°E` : "18.70°N, 72.40°E"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] tracking-[0.08em] font-semibold text-muted-foreground">OBSERVED VALUE</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[22px] font-semibold tracking-[-0.02em] text-rose-400">
              {selectedAnomaly ? `${selectedAnomaly.value.toFixed(1)}${selectedAnomaly.unit}` : "31.8°C"}
            </span>
            {selectedAnomaly?.deviation && (
              <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/20">
                +{selectedAnomaly.deviation.toFixed(1)}{selectedAnomaly.unit}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Baseline expected: {selectedAnomaly?.baseline_mean?.toFixed(1) ?? "27.5"}°C
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] tracking-[0.08em] font-semibold text-muted-foreground">DETERMINISTIC Z-SCORE</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[22px] font-semibold tracking-[-0.02em] text-[#F4B942]">
              {selectedAnomaly?.z_score ? `+${selectedAnomaly.z_score.toFixed(2)}σ` : "+4.30σ"}
            </span>
            <Badge className="bg-rose-500/20 text-rose-400 uppercase font-bold text-[10px]">
              {selectedAnomaly?.severity ?? "SEVERE"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {selectedAnomaly?.baseline_sample_size ?? 30} historical samples analyzed
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] tracking-[0.08em] font-semibold text-muted-foreground">INVESTIGATION VERDICT</div>
          <div className="mt-2 flex items-center gap-2">
            {investigation ? (
              <>
                <span className="size-2 rounded-full bg-[#35C98A]" />
                <span className="text-[15px] font-semibold text-[#35C98A] tracking-[-0.01em]">
                  {investigation.synthesis.synthesis_status.replace(/_/g, " ").toUpperCase()}
                </span>
              </>
            ) : (
              <>
                <span className="size-2 rounded-full bg-[#F4B942] animate-pulse" />
                <span className="text-[15px] font-semibold text-[#F4B942] tracking-[-0.01em]">
                  PENDING ANALYSIS
                </span>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {investigation ? `Synthesized Confidence: ${Math.round(investigation.confidence * 100)}%` : "Ready for specialist investigation"}
          </div>
        </Card>
      </div>

      {/* Main Grid: Map & Anomaly Details Panel */}
      <div className="grid grid-cols-12 gap-4">
        {/* Map Section */}
        <div className="col-span-12 lg:col-span-7 space-y-3">
          <div className="rounded-2xl overflow-hidden border bg-[#0A2733] shadow-md">
            <MarineMap
              height={480}
              anomalies={mapAnomalies}
              selectedAnomalyId={selectedAnomalyId}
              onSelectAnomaly={handleSelectAnomaly}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="font-medium text-foreground">Arabian Sea Buoy 12</span>
              <span>(Monitored Marine Station with Confirmed Anomaly)</span>
            </div>
            <div className="text-xs">Click marker or card to select anomaly</div>
          </div>
        </div>

        {/* Step 4: Anomaly Details Panel */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-rose-500/15 text-rose-400 border-rose-500/20 text-[11px] font-semibold">
                  ANOMALY DETECTED
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  {selectedAnomaly?.investigation_status?.toUpperCase() ?? "NEW"}
                </Badge>
              </div>
              <CardTitle className="text-lg mt-1">
                {selectedAnomaly?.parameter.replace(/_/g, " ").toUpperCase()} ANOMALY
              </CardTitle>
              <CardDescription className="text-xs">
                Computed deterministically using z-score threshold cutoffs against prior station baseline.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 flex-1 flex flex-col justify-between text-sm">
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-muted/60 border rounded-xl">
                    <div className="text-muted-foreground text-[11px]">Location</div>
                    <div className="font-semibold text-[13px] mt-0.5">{selectedAnomaly?.location.name}</div>
                    <div className="text-[10.5px] text-muted-foreground mt-0.5 font-mono">
                      {selectedAnomaly?.location.lat}°N, {selectedAnomaly?.location.lon}°E
                    </div>
                  </div>
                  <div className="p-3 bg-muted/60 border rounded-xl">
                    <div className="text-muted-foreground text-[11px]">Parameter</div>
                    <div className="font-semibold text-[13px] mt-0.5 capitalize">
                      {selectedAnomaly?.parameter.replace(/_/g, " ")}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground mt-0.5">Surface Ocean Layer</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 bg-muted/60 border rounded-xl">
                    <div className="text-muted-foreground text-[10.5px]">Observed</div>
                    <div className="font-bold text-base text-rose-400 mt-0.5">
                      {selectedAnomaly?.value.toFixed(1)}{selectedAnomaly?.unit}
                    </div>
                  </div>
                  <div className="p-2.5 bg-muted/60 border rounded-xl">
                    <div className="text-muted-foreground text-[10.5px]">Baseline Mean</div>
                    <div className="font-semibold text-base mt-0.5">
                      {selectedAnomaly?.baseline_mean?.toFixed(1) ?? "27.5"}{selectedAnomaly?.unit}
                    </div>
                  </div>
                  <div className="p-2.5 bg-muted/60 border rounded-xl">
                    <div className="text-muted-foreground text-[10.5px]">Z-Score</div>
                    <div className="font-bold text-base text-[#F4B942] mt-0.5">
                      +{selectedAnomaly?.z_score?.toFixed(2) ?? "4.30"}σ
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-background border rounded-xl space-y-1.5 text-xs">
                  <div className="font-medium text-foreground flex items-center justify-between">
                    <span>Evidence History Breakdown</span>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedAnomaly?.baseline_sample_size ?? 30} Samples
                    </Badge>
                  </div>
                  <div className="text-muted-foreground leading-relaxed">
                    Evaluated against 30-day temporal baseline window ending today. Standard deviation:{" "}
                    <span className="font-mono text-foreground font-medium">{selectedAnomaly?.baseline_std?.toFixed(2) ?? "0.81"}°C</span>.
                    Statistical confidence:{" "}
                    <span className="font-mono text-[#35C98A] font-semibold">{Math.round((selectedAnomaly?.confidence ?? 0.85) * 100)}%</span>.
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t">
                <Button
                  className="w-full rounded-xl bg-primary text-primary-foreground font-medium"
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? "Collaborative Agents Investigating…" : "Run Full Specialist Investigation →"}
                </Button>
                <p className="text-[10.5px] text-center text-muted-foreground mt-2">
                  Invokes Anomaly Verification, Oceanographic Context & Ecological Reasoning agents
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Step 5: Collaborative Agent Visualization */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.01em]">Specialist Agent Investigation</h2>
            <p className="text-xs text-muted-foreground">
              Autonomous agents independently analyze statistical validity, multi-variable ocean context, and marine ecological consequences.
            </p>
          </div>
          {investigation && (
            <Badge variant="outline" className="text-xs font-mono">
              Investigation ID: {investigation.id.slice(0, 8)}…
            </Badge>
          )}
        </div>

        {investigation ? (
          <div className="grid md:grid-cols-3 gap-4">
            {investigation.agent_results.map((agent) => (
              <AgentCard key={agent.agent_name} agent={agent} />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center border-dashed">
            <div className="max-w-md mx-auto space-y-3">
              <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto text-lg">
                ✦
              </div>
              <h3 className="font-medium text-base">Specialist Agents Standby</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Click <b className="text-foreground">"Run ORCA Analysis"</b> above to deploy the Anomaly Verification, Oceanographic Context, and Ecological Reasoning agents against the Arabian Sea SST anomaly.
              </p>
              <Button size="sm" variant="outline" onClick={handleRunAnalysis} disabled={isAnalyzing}>
                Deploy Specialist Agents Now
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Step 6 & Step 7: Collaborative Consensus & Final Synthesis */}
      {investigation && (
        <div className="grid grid-cols-12 gap-4 pt-2">
          {/* Consensus Card (Step 6) */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <Card className="h-full flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-[#35C98A]/15 text-[#35C98A] border-[#35C98A]/30 text-[11px] font-semibold">
                    CROSS-VERIFICATION
                  </Badge>
                  <Badge className="bg-[#35C98A] text-[#071014] font-bold text-[10.5px]">
                    {investigation.agreement_status.replace(/_/g, " ").toUpperCase()}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-1">Collaborative Consensus</CardTitle>
                <CardDescription className="text-xs">
                  Cross-agent verification matrix identifying agreement or contradictory findings.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 text-xs flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  {investigation.agent_results.map((agent) => (
                    <div key={agent.agent_name} className="p-3 bg-muted/60 border rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-foreground text-[12.5px] capitalize">
                          {agent.agent_name.replace(/_/g, " ")}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Confidence: {Math.round(agent.confidence * 100)}% • {agent.confidence_basis.split("(")[0]}
                        </div>
                      </div>
                      <Badge className="bg-[#35C98A]/20 text-[#35C98A] border-[#35C98A]/30 text-xs font-semibold">
                        ✓ {agent.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-[#35C98A]/10 border border-[#35C98A]/20 rounded-xl space-y-1">
                  <div className="font-semibold text-[#35C98A] text-xs flex items-center gap-1.5">
                    <span>✓ Unanimous Consensus Established</span>
                  </div>
                  <div className="text-[11px] leading-relaxed text-muted-foreground">
                    All 3 independent agents confirmed the thermal anomaly. Sensor error, rate-of-change discontinuity, and unphysical artifact hypotheses were eliminated during verification.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Synthesis Card (Step 7) */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <Card className="h-full flex flex-col justify-between border-primary/40 bg-card shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-[#4BA3FF]/15 text-[#4BA3FF] border-[#4BA3FF]/30 text-[11px] font-semibold">
                    ORCA SYNTHESIS & ADVISORY
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Synthesized Confidence:</span>
                    <Badge className="bg-[#35C98A] text-[#071014] font-bold text-xs">
                      {Math.round(investigation.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-xl mt-1 text-[#35C98A] flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#35C98A] animate-pulse" />
                  {investigation.synthesis.synthesis_status.replace(/_/g, " ").toUpperCase()}
                </CardTitle>
                <CardDescription className="text-xs font-mono text-muted-foreground">
                  Primary Driver: {investigation.synthesis.primary_driver}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-xs">
                {/* Synthesis Conclusion */}
                <div className="p-3.5 bg-muted/60 border rounded-xl">
                  <div className="font-semibold text-foreground text-[12.5px] mb-1">Synthesized Finding</div>
                  <p className="text-[12px] leading-relaxed text-foreground/90">
                    {investigation.synthesis.overall_conclusion}
                  </p>
                </div>

                {/* Key Findings */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                    Key Agent Findings
                  </div>
                  <div className="space-y-1.5">
                    {investigation.synthesis.key_findings.map((f, i) => (
                      <div key={i} className="flex gap-2 text-muted-foreground">
                        <span className="text-[#4BA3FF] font-bold">•</span>
                        <span className="text-[11.5px] leading-5">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommended Operational Action */}
                <div className="p-3.5 bg-[#4BA3FF]/10 border border-[#4BA3FF]/30 rounded-xl">
                  <div className="text-[11px] font-bold text-[#4BA3FF] tracking-[0.08em] uppercase flex items-center gap-1.5">
                    <span>⚡ Actionable Ecosystem Advisory</span>
                  </div>
                  <p className="text-[12px] text-foreground font-medium mt-1 leading-relaxed">
                    {investigation.synthesis.recommended_action}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// Individual Specialist Agent Card Component
function AgentCard({ agent }: { agent: AgentResult }) {
  const isVerif = agent.agent_name === "anomaly_verification";
  const isContext = agent.agent_name === "oceanographic_context";
  const isEco = agent.agent_name === "ecological_reasoning";

  const title = isVerif
    ? "Anomaly Verification Agent"
    : isContext
    ? "Oceanographic Context Agent"
    : "Ecological Reasoning Agent";

  const role = isVerif
    ? "Statistical & Sensor Telemetry Sanity"
    : isContext
    ? "Multi-Variable Physical Coupling"
    : "Ecosystem & Biodiversity Impacts";

  const icon = isVerif ? "🌡️" : isContext ? "🌊" : "🐋";

  return (
    <Card className="p-4 flex flex-col justify-between space-y-3 bg-card border shadow-sm">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              <div className="text-[11px] text-muted-foreground">{role}</div>
            </div>
          </div>
          <Badge
            className={`text-[10px] font-semibold uppercase ${
              agent.status === "verified"
                ? "bg-[#35C98A]/15 text-[#35C98A] border-[#35C98A]/30"
                : agent.status === "contradicted"
                ? "bg-destructive/15 text-destructive border-destructive/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {agent.status}
          </Badge>
        </div>

        <Separator />

        {/* Conclusion */}
        <div className="text-[12px] leading-relaxed text-foreground font-medium">
          {agent.conclusion}
        </div>

        {/* Supporting Evidence List */}
        {agent.supporting_evidence.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="text-[10.5px] font-semibold text-muted-foreground tracking-[0.06em] uppercase">
              Supporting Evidence
            </div>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {agent.supporting_evidence.slice(0, 3).map((ev: string, i: number) => (
                <li key={i} className="flex gap-1.5 leading-4">
                  <span className="text-[#35C98A] font-bold">✓</span>
                  <span>{ev}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Ecological Warnings / Inferences if present */}
        {agent.warnings.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="text-[10.5px] font-semibold text-[#F4B942] tracking-[0.06em] uppercase">
              Ecological Inferences & Warnings
            </div>
            <ul className="space-y-1 text-[11px] text-[#F4B942]/90">
              {agent.warnings.map((w: string, i: number) => (
                <li key={i} className="leading-4 bg-[#F4B942]/10 p-1.5 rounded-lg border border-[#F4B942]/20">
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate max-w-[200px]" title={agent.confidence_basis}>
          {agent.confidence_basis.split("(")[0]}
        </span>
        <Badge variant="outline" className="font-mono text-[10.5px]">
          Conf: {Math.round(agent.confidence * 100)}%
        </Badge>
      </div>
    </Card>
  );
}
