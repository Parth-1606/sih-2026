"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { mockConditions, pfzData, alerts, userLocation } from "@/lib/mock";
import { askPlanner, freshConversation, type Conversation, type PlanTrace } from "@/lib/agents/planner";
import { LANGS, storeLang, type Lang } from "@/lib/marine/i18n";
import DataBadge from "@/components/DataBadge";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Msg = { role: "user" | "assistant" | "tool" | "evidence" | "map" | "alert" | "trace"; text: string; meta?: any };
const SUGGESTED = [
  "Where is the nearest Potential Fishing Zone today?",
  "Is it safe to venture into the sea tomorrow morning?",
  "What if I leave two hours earlier?",
  "What are the tide, weather, wind, and wave conditions near Mumbai Harbour?",
  "Are there any lightning or cyclone alerts in my area?",
  "Which regions have high chlorophyll and favourable SST?",
  "Show me the safest route to PFZ-001.",
  "Which zones should I avoid because of boundaries or hazardous conditions?",
];
const AGENT_STEPS = ["interpreting_request", "planning", "querying_weather", "querying_ocean_data", "performing_geospatial_analysis", "assessing_risk", "synthesizing_answer"];

function AssistantInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState(0);
  const [traceOpen, setTraceOpen] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string>("PFZ-001");
  const [conv, setConv] = useState<Conversation>(() => freshConversation());
  const [lang, setLang] = useState<Lang>("en");
  const listRef = useRef<HTMLDivElement>(null);

  const pickLang = (l: Lang) => {
    setLang(l);
    storeLang(l);
    setConv(c => ({ ...c, language: l }));
  };

  const send = async (q: string) => {
    if (!q.trim()) return;
    setMessages(m => [...m, { role: "user", text: q }]);
    setInput("");
    setProcessing(true);
    setStep(0);
    for (let i = 0; i < AGENT_STEPS.length; i++) { setStep(i); await new Promise(r => setTimeout(r, 220)); }
    let trace: PlanTrace;
    try {
      trace = await askPlanner(q, { ...conv, language: lang });
    } catch (e) {
      trace = {
        query: q,
        intent: { type: "general", location: { lat: userLocation.latitude, lng: userLocation.longitude, label: userLocation.label }, vessel: { type: "small", label: "Small craft", speedKts: 12, maxWindKts: 25, maxWaveM: 2, minDepthM: 5 }, raw: q },
        agentsRun: [], answer: `Agent team unreachable (${String(e)}). Showing onboard reference: nearest PFZ PFZ-001, 32 km SW, confidence 91%.`,
        results: [], sources: [], live: false, generatedAt: new Date().toISOString(), language: lang,
      };
    }
    // Preserve conversational context: location, vessel, route, language.
    setConv(c => ({
      ...c,
      location: trace.intent.location ?? c.location,
      vessel: trace.intent.vessel ?? c.vessel,
      route: trace.routes ?? c.route,
      language: trace.language ?? c.language,
    }));
    if (trace.language && trace.language !== lang) setLang(trace.language);
    const srcLine = trace.sources.length
      ? trace.sources.map(s => s.name).join(" • ")
      : "onboard reference";
    setMessages(m => [...m,
      { role: "assistant", text: trace.answer, meta: trace },
      { role: "trace", text: "Agent trace", meta: trace },
      { role: "evidence", text: `Evidence — ${srcLine} ${trace.live ? "• LIVE" : "• OFFLINE"}` },
      { role: "map" as const, text: "PFZ-001 — 32km SW • View on map" },
    ]);
    setProcessing(false);
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (initial) send(initial); }, [initial]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, processing]);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col min-w-0 border-r">
        {messages.length === 0 && !processing && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="size-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg"><span className="text-xl">✦</span></div>
            <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.02em]">What do you need to know about the ocean?</h2>
            <p className="text-sm text-muted-foreground mt-1">Ask about fishing zones, weather, sea conditions, routes or safety.</p>
            <div className="mt-6 grid gap-2 w-full max-w-[560px]">
              {SUGGESTED.map(q => (
                <Card key={q} className="p-0 cursor-pointer hover:ring-foreground/10 transition-all" onClick={() => send(q)}>
                  <CardContent className="p-3 text-sm text-left">“{q}”</CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        {(messages.length > 0 || processing) && (
          <div ref={listRef} className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`${m.role === "user" ? "ml-auto bg-primary text-primary-foreground max-w-[78%]" : m.role === "assistant" ? "bg-card border max-w-[86%]" : m.role === "trace" ? "bg-transparent border border-dashed max-w-[86%]" : m.role === "evidence" ? "bg-muted border max-w-[86%]" : m.role === "map" ? "bg-[#F2C94C] text-[#071014] max-w-[86%] cursor-pointer" : "bg-[#F4B942]/15 border border-[#F4B942]/20 max-w-[86%]"} rounded-2xl px-4 py-3 text-[13.5px] leading-6`}>
                {m.role === "assistant" && <Badge variant="outline" className="mb-1 text-[11px]">DIRECT ANSWER • {m.meta?.live ? "LIVE" : "OFFLINE"} • {m.meta?.agentsRun?.length ?? 0} AGENTS</Badge>}
                {m.role === "trace" && <Badge variant="secondary" className="mb-2 text-[11px]">COLLABORATIVE TRACE • PLANNER ROUTED {m.meta?.agentsRun?.length ?? 0} AGENTS</Badge>}
                {m.role === "evidence" && <Badge variant="secondary" className="mb-1 text-[11px]">EVIDENCE</Badge>}
                {m.role === "map" && <Badge className="mb-1 bg-[#071014] text-white hover:bg-[#071014]">↗ MAP RESULT</Badge>}
                {m.role === "trace" && m.meta ? (
                  <div className="space-y-2">
                    <div className="text-xs"><span className="text-muted-foreground">{m.meta.language === "hi" ? "पहचाना गया इरादा" : "Intent detected"}: </span><span className="font-mono">{m.meta.intent?.type}</span>
                      {m.meta.intent?.location && <span className="text-muted-foreground"> • {m.meta.intent.location.label}</span>}
                      {m.meta.intent?.vessel && <span className="text-muted-foreground"> • {m.meta.intent.vessel.label}</span>}
                      {m.meta.intent?.when && <span className="text-muted-foreground"> • {m.meta.intent.when}</span>}
                    </div>
                    {(m.meta as PlanTrace).results.map(r => (
                      <div key={r.agent} className="rounded-xl bg-card border p-2.5 text-xs">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-[#35C98A]" />{r.label}
                          <Badge variant="outline" className="ml-auto text-[10px]">{r.confidence}%</Badge>
                        </div>
                        <div className="mt-1 text-muted-foreground leading-5">{r.verdict}</div>
                        {r.evidence.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {r.evidence.slice(0, 3).map((e, j) => <div key={j} className="text-muted-foreground">▪ {e}</div>)}
                          </div>
                        )}
                        {r.rulesTriggered.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {r.rulesTriggered.slice(0, 3).map((t, j) => <Badge key={j} variant="outline" className="text-[10px] bg-[#F4B942]/10 text-[#F4B942] border-[#F4B942]/25">{t}</Badge>)}
                          </div>
                        )}
                        {r.sources.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                            {r.sources.map((s, j) => (
                              <span key={j} className="inline-flex items-center gap-1">
                                {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-[10px] underline text-[#4BA3FF]">{s.name}</a> : <span className="text-[10px] text-muted-foreground">{s.name}</span>}
                                {s.mode && <DataBadge mode={s.mode} lang={m.meta.language} />}
                              </span>
                            ))}
                            {r.dataTimes.length > 0 && <span className="text-[10px] text-muted-foreground">• {r.dataTimes[0]}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                    {m.meta.risk && (
                      <div className="rounded-xl border p-2.5 text-xs bg-card">
                        <div className="font-semibold flex items-center gap-2">Risk — {m.meta.risk.level}
                          <Badge className="ml-auto bg-[#4BA3FF] text-[#071014] hover:bg-[#4BA3FF]">{m.meta.risk.recommendation}</Badge>
                        </div>
                        <div className="mt-1 text-muted-foreground">{m.meta.risk.disclaimer}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="whitespace-pre-line">{m.text}</div>
                )}
                {m.role === "map" && <div onClick={() => router.push("/map")} className="mt-2 text-xs font-semibold underline cursor-pointer">Open map →</div>}
              </motion.div>
            ))}
            {processing && (
              <Card className="max-w-[86%]">
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-xs tracking-[0.08em] text-muted-foreground flex items-center gap-2"><span className="size-2 bg-[#4BA3FF] rounded-full animate-pulse" /> AGENT ACTIVITY</CardTitle>
                  <Button variant="ghost" size="xs" onClick={() => setTraceOpen(v => !v)}>{traceOpen ? "Hide" : "Show"}</Button>
                </CardHeader>
                <CardContent>
                  <AnimatePresence>
                    {traceOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="space-y-1.5">
                          {AGENT_STEPS.map((s, idx) => (
                            <Badge key={s} variant={idx <= step ? "default" : "outline"} className={`w-full justify-start gap-2 py-1.5 ${idx <= step ? "" : "bg-muted text-muted-foreground"}`}>
                              <span className={`size-1.5 rounded-full ${idx < step ? "bg-[#35C98A]" : idx === step ? "bg-[#4BA3FF] animate-pulse" : "bg-muted-foreground/30"}`} />
                              {s.replace(/_/g, " ")}
                              {idx < step && <span className="ml-auto">✓</span>}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">Querying weather • ocean • geospatial — synthesizing answer…</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        <div className="p-3 md:p-4 border-t bg-card">
          <div className="flex items-center gap-1.5 max-w-[760px] mx-auto mb-2 overflow-auto">
            {LANGS.map(l => (
              <Badge
                key={l.code}
                variant={lang === l.code ? "default" : "outline"}
                className={`cursor-pointer whitespace-nowrap ${l.ready ? "" : "opacity-50"}`}
                title={l.ready ? l.label : `${l.label} — coming soon`}
                onClick={() => l.ready && pickLang(l.code)}
              >{l.label}</Badge>
            ))}
            <span className="text-[10px] text-muted-foreground ml-1 whitespace-nowrap">• replies follow your language</span>
          </div>
          <div className="flex items-center gap-2 max-w-[760px] mx-auto">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full bg-muted border">
              <span className="text-muted-foreground">⌖</span>
              <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send(input)} placeholder="Ask anything about marine conditions…" className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-6 p-0" />
              <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => alert("Voice — coming soon")}>🎙</Button>
              <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => alert(`Location: ${userLocation.label}`)}>◎</Button>
            </div>
            <Button size="icon" className="rounded-full" onClick={() => send(input)}>↑</Button>
          </div>
          <div className="text-[11px] text-center text-muted-foreground mt-2">Enter to send • Evidence + map actions in every answer</div>
        </div>
      </div>

      <div className="w-full lg:w-[340px] shrink-0 bg-sidebar text-sidebar-foreground border-t lg:border-t-0 lg:border-l p-4 space-y-4 overflow-auto">
        <Card>
          <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">CURRENT LOCATION</CardTitle></CardHeader>
          <CardContent>
            <div className="font-medium text-sm">{userLocation.label}</div>
            <div className="text-xs text-muted-foreground">{mockConditions.tide} tide • Visibility {mockConditions.visibility} km</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">CURRENT CONDITIONS</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted border rounded-xl p-2.5"><div className="text-muted-foreground">SST</div><div className="text-sm font-semibold">{mockConditions.sst}°C</div></div>
            <div className="bg-muted border rounded-xl p-2.5"><div className="text-muted-foreground">Wave</div><div className="text-sm font-semibold">{mockConditions.wave_height}m</div></div>
            <div className="bg-muted border rounded-xl p-2.5"><div className="text-muted-foreground">Chlorophyll</div><div className="text-sm font-semibold">{mockConditions.chlorophyll}</div></div>
            <div className="bg-muted border rounded-xl p-2.5"><div className="text-muted-foreground">Wind</div><div className="text-sm font-semibold">{mockConditions.wind_speed} kts {mockConditions.wind_direction}</div></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">ACTIVE ALERTS</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.slice(0, 2).map(a => (
              <div key={a.id} className="rounded-xl bg-muted border p-3 text-xs">
                <div className="font-medium flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${a.severity === "warning" ? "bg-[#F4B942]" : "bg-[#4BA3FF]"}`} />{a.title}</div>
                <div className="text-muted-foreground">{a.location}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">SELECTED MAP AREA</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)} className="w-full bg-background border rounded-xl px-2 py-1.5 text-sm outline-none">
              {pfzData.map(p => <option key={p.id} value={p.id}>{p.id} — {p.distance_km}km {p.direction}</option>)}
            </select>
            <div className="text-xs text-muted-foreground">SST 27.8°C • Chlorophyll 0.92 • Confidence 91% • Tap to focus map</div>
            <Button size="sm" className="w-full rounded-full" onClick={() => router.push("/map")}>Focus on map</Button>
          </CardContent>
        </Card>
        <div className="text-xs text-muted-foreground p-2">Agent team: planner + marine-data, ocean-analytics, weather-intel, geospatial, risk, visualization • Sources: Open-Meteo, NASA ERDDAP, OSM, INCOIS</div>
      </div>
    </div>
  );
}
export default function AssistantPage() {
  return <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading assistant…</div>}><AssistantInner /></Suspense>;
}
