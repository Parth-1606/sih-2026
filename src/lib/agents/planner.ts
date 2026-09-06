// ORCA 8-agent collaborative workflow (PDF §3 layers 4–5).
// Planner → Marine Data → Weather/Hazard → Ocean Analytics → Geospatial →
// Marine Route → Risk → Explanation → Visualisation. Every step records
// verdict, evidence, sources, timestamps and rules for the trace panel.
import type { LiveMarine } from "@/lib/marine-api";
import type { DataMode, NormalizedRecord } from "../marine/schema";
import {
  adaptEezDemo, adaptErddap, adaptMpaCurated,
  adaptOpenMeteo, adaptPfz, adaptPortsLive, adaptUnavailable,
} from "../marine/adapters";
import { assessRisk, VESSELS, type RiskResult, type VesselProfile } from "../marine/risk";
import { haversineKm, pointInPolygon } from "../marine/geo";
import { CURATED_MPAS } from "../marine-zones";
import { DEFAULT_SCENARIO, DEMO_PFZ, SCENARIOS, demoImdAlerts, demoOsfRecords } from "../marine/fixtures";
import { planMarineRoutes, type MarineRouteOption } from "../marine/router";
import { detectLang, t, type Lang } from "../marine/i18n";

export type AgentName =
  | "marine-data" | "ocean-analytics" | "weather-hazard" | "geospatial"
  | "route" | "risk" | "explanation" | "visualization";

export const AGENT_LABELS: Record<AgentName, string> = {
  "marine-data": "Marine Data Agent",
  "ocean-analytics": "Ocean Analytics Agent",
  "weather-hazard": "Weather & Hazard Agent",
  "geospatial": "Geospatial Agent",
  "route": "Marine Route Agent",
  "risk": "Risk Assessment Agent",
  "explanation": "Explanation Agent",
  "visualization": "Visualisation Agent",
};

export interface AgentSource {
  name: string;
  url?: string;
  at?: string;
  mode?: DataMode;
}

export interface AgentResult {
  agent: AgentName;
  label: string;
  verdict: string;
  detail: string;
  confidence: number;
  sources: AgentSource[];
  evidence: string[];
  rulesTriggered: string[];
  dataTimes: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export interface Intent {
  type: "pfz" | "safety" | "weather" | "alerts" | "chlorophyll" | "route" | "avoid" | "general";
  location: { lat: number; lng: number; label: string };
  vessel: VesselProfile;
  when?: string;
  raw: string;
}

export interface PlanTrace {
  query: string;
  intent: Intent;
  agentsRun: AgentName[];
  answer: string;
  results: AgentResult[];
  sources: AgentSource[];
  live: boolean;
  generatedAt: string;
  language: Lang;
  risk?: RiskResult;
  routes?: MarineRouteOption[];
}

export interface Conversation {
  location: { lat: number; lng: number; label: string };
  vessel: VesselProfile;
  route?: MarineRouteOption[];
  feature?: string;
  forecastDay: number;
  language: Lang;
}

export const freshConversation = (): Conversation => ({
  location: { lat: DEFAULT_SCENARIO.lat, lng: DEFAULT_SCENARIO.lng, label: DEFAULT_SCENARIO.harbour },
  vessel: VESSELS.small,
  forecastDay: 0,
  language: "en",
});

function findPlace(q: string): { lat: number; lng: number; label: string } | null {
  const lower = q.toLowerCase();
  for (const s of SCENARIOS) {
    if (lower.includes(s.harbour.toLowerCase()) || lower.includes(s.id)) {
      return { lat: s.lat, lng: s.lng, label: s.harbour };
    }
  }
  const pfz = DEMO_PFZ.find(p => lower.includes(p.id.toLowerCase()));
  if (pfz) return { lat: pfz.lat, lng: pfz.lng, label: pfz.id };
  const m = q.match(/(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[3]), label: `${m[1]}, ${m[3]}` };
  return null;
}

function findVessel(q: string, fallback: VesselProfile): VesselProfile {
  const lower = q.toLowerCase();
  if (/trawler/.test(lower)) return VESSELS.trawler;
  if (/research/.test(lower)) return VESSELS.research;
  if (/small|boat|craft|dunghy|dinghy/.test(lower)) return VESSELS.small;
  return fallback;
}

export function detectIntent(query: string, conv: Conversation): Intent {
  const q = query.toLowerCase();
  const vessel = findVessel(q, conv.vessel);
  const location = findPlace(query) ?? conv.location;
  let when: string | undefined;
  if (/tomorrow/.test(q)) when = "tomorrow morning";
  else if (/today/.test(q)) when = "today";
  else if (/(\d+)\s*hours?\s*earlier/.test(q)) when = `${q.match(/(\d+)\s*hours?\s*earlier/)?.[1]}h earlier`;
  else if (/(\d+)\s*hours?\s*later/.test(q)) when = `${q.match(/(\d+)\s*hours?\s*later/)?.[1]}h later`;

  let type: Intent["type"] = "general";
  if (/safest route|route to|show me.*route|plan.*route|navigate/.test(q)) type = "route";
  else if (/avoid|boundar|restrict|eez|danger.*zone|which zones/.test(q)) type = "avoid";
  else if (/pfz|fishing zone|where.*fish|nearest.*zone|catch/.test(q)) type = "pfz";
  else if (/safe|sail|venture|go out|leave.*earlier|leave.*later/.test(q)) type = "safety";
  else if (/tide|weather|wind|wave|condition/.test(q)) type = "weather";
  else if (/cyclone|alert|warning|lightning|storm|tsunami/.test(q)) type = "alerts";
  else if (/chlorophyll|high.*chloro|sst|temperature|productiv/.test(q)) type = "chlorophyll";

  return { type, location, vessel, when, raw: query };
}

interface Ctx {
  intent: Intent;
  lang: Lang;
  marine: LiveMarine | null;
  records: NormalizedRecord[];
}

function srcOf(r: NormalizedRecord): AgentSource {
  return { name: r.source.name, url: r.source.url, at: r.source.retrievedAt, mode: r.dataMode };
}

async function marineDataAgent(ctx: Ctx): Promise<AgentResult> {
  const { marine, records } = await adaptOpenMeteo(ctx.intent.location.lat, ctx.intent.location.lng, ctx.intent.location.label);
  ctx.marine = marine;
  ctx.records.push(...records);
  if (!marine) {
    return {
      agent: "marine-data", label: AGENT_LABELS["marine-data"],
      verdict: "Live ocean feed unreachable — Demo reference values in use",
      detail: "Open-Meteo request failed; downstream agents run on labelled Demo data.",
      confidence: 35, sources: [{ name: "Open-Meteo (unreachable)", url: "https://open-meteo.com", mode: "unavailable" }],
      evidence: [], rulesTriggered: ["R0: missing live data → cap confidence, label Demo"], dataTimes: [],
    };
  }
  return {
    agent: "marine-data", label: AGENT_LABELS["marine-data"],
    verdict: `SST ${marine.sst.toFixed(1)}°C • wave ${marine.waveHeight.toFixed(1)}m/${marine.wavePeriod.toFixed(0)}s • current ${marine.currentVelocity} m/s`,
    detail: `Buoy ${marine.time} IST. Wind ${marine.windSpeedKn} kts ${marine.windCompass}, visibility ${marine.visibilityKm} km.`,
    confidence: 88, sources: records.map(srcOf),
    evidence: [`SST ${marine.sst.toFixed(1)}°C`, `wave ${marine.waveHeight.toFixed(1)} m`, `wind ${marine.windSpeedKn} kts ${marine.windCompass}`],
    rulesTriggered: [], dataTimes: [marine.time], data: marine,
  };
}

async function oceanAnalyticsAgent(ctx: Ctx): Promise<AgentResult> {
  const erddap = await adaptErddap(ctx.intent.location.lat, ctx.intent.location.lng, ctx.intent.location.label);
  const pfz = await adaptPfz();
  ctx.records.push(...erddap, ...pfz);
  const chl = erddap.find(r => r.id === "erddap-chl");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chlVal = (chl?.data as any)?.meanChl as number | null;
  const osf = demoOsfRecords();
  ctx.records.push(...osf);
  const productive = chlVal != null && chlVal > 0.5;
  const verdict = chlVal == null
    ? "Satellite chlorophyll unavailable (monsoon cloud) — SST-only assessment"
    : productive
      ? `HIGH productivity likely — chlorophyll ${chlVal.toFixed(2)} mg/m³ with SST in the PFZ window`
      : `MODERATE — chlorophyll ${chlVal.toFixed(2)} mg/m³ below the 0.5 bloom threshold`;
  return {
    agent: "ocean-analytics", label: AGENT_LABELS["ocean-analytics"], verdict,
    detail: `MODIS-Aqua 21-day mean vs INCOIS PFZ logic (SST + chlorophyll fronts). Demo PFZ positions mirror the INCOIS advisory shape until WebGIS nodes sync.`,
    confidence: chlVal != null ? 80 : 55,
    sources: [...erddap.map(srcOf), ...pfz.filter(r => !r.isMock).map(srcOf)],
    evidence: chlVal != null ? [`chlorophyll ${chlVal.toFixed(2)} mg/m³ (21-day mean)`] : ["chlorophyll: no valid pixels"],
    rulesTriggered: productive ? ["P1: chl > 0.5 + SST 26–30°C → HIGH productivity"] : [],
    dataTimes: chl?.observedAt ? [chl.observedAt] : [],
    data: { chl: chlVal },
  };
}

async function weatherHazardAgent(ctx: Ctx): Promise<AgentResult> {
  const demo = demoImdAlerts();
  ctx.records.push(...demo);
  const m = ctx.marine;
  const f = m?.forecast?.[1];
  const lines = [
    ...(m ? [`wind ${m.windSpeedKn} kts ${m.windCompass}`, `wave ${m.waveHeight.toFixed(1)} m`, `visibility ${m.visibilityKm} km`] : ["live wind/wave: unavailable"]),
    `Demo IMD: strong-wind watch (18–22 kts) + lightning cells W offshore`,
  ];
  return {
    agent: "weather-hazard", label: AGENT_LABELS["weather-hazard"],
    verdict: m ? `Now ${m.windSpeedKn} kts • tomorrow ${f ? `${f.wind} kts / ${f.wave} m, risk ${f.risk}` : "n/a"} • 2 Demo hazard advisories` : "Live weather unavailable — Demo advisories only",
    detail: lines.join(" • "),
    confidence: m ? 85 : 45,
    sources: [
      ...(m ? [{ name: "Open-Meteo Forecast", url: "https://open-meteo.com", mode: "live" as DataMode }] : []),
      ...demo.map(srcOf),
    ],
    evidence: lines,
    rulesTriggered: (m && m.windSpeedKn >= 17) || demo.length ? ["H1: wind ≥17 kts or active advisory → flag caution"] : [],
    dataTimes: m ? [m.time] : [],
    data: { forecast: m?.forecast },
  };
}

async function geospatialAgent(ctx: Ctx): Promise<AgentResult> {
  const ports = await adaptPortsLive();
  const mpas = adaptMpaCurated();
  const eez = adaptEezDemo();
  ctx.records.push(...ports, ...mpas, ...eez);
  const { location } = ctx.intent;
  const hits = CURATED_MPAS.filter(z => pointInPolygon(location.lat, location.lng, z.polygon as [number, number][]));
  const near = CURATED_MPAS.map(z => ({
    z, d: Math.min(...z.polygon.map(([la, ln]) => Math.hypot((location.lat - la) * 111, (location.lng - ln) * 111))),
  })).sort((a, b) => a.d - b.d)[0];
  const livePorts = ports.filter(p => !p.isMock).length;
  return {
    agent: "geospatial", label: AGENT_LABELS["geospatial"],
    verdict: hits.length
      ? `INSIDE restricted zone: ${hits.map(h => h.name).join(", ")}`
      : `${ports.length} ports indexed (${livePorts} live OSM) • nearest restricted zone ${near.z.name.split(" (")[0]} ≈${near.d.toFixed(0)} km`,
    detail: `Point-in-polygon over ${CURATED_MPAS.length} MPA boxes + simplified EEZ line. Full VLIZ/WDPA polygons plug in unchanged.`,
    confidence: 78,
    sources: [...ports.slice(0, 1).map(srcOf), ...mpas.slice(0, 1).map(srcOf)],
    evidence: hits.length ? [`inside: ${hits.map(h => h.name).join(", ")}`] : [`MPA clearance ≈${near.d.toFixed(0)} km`],
    rulesTriggered: hits.length ? ["G1: inside restricted polygon → hard geofence alert"] : [],
    dataTimes: [],
    data: { inside: hits.map(h => h.name), ports: ports.slice(0, 6) },
  };
}

async function routeAgent(ctx: Ctx, destName?: string): Promise<AgentResult> {
  const dest = destName
    ? DEMO_PFZ.find(p => p.id.toLowerCase() === destName.toLowerCase())
    : DEMO_PFZ[0];
  if (!dest) {
    return {
      agent: "route", label: AGENT_LABELS["route"], verdict: "No destination resolved",
      detail: "Name a harbour or PFZ (e.g. PFZ-001).", confidence: 30, sources: [], evidence: [],
      rulesTriggered: [], dataTimes: [],
    };
  }
  const { direct, safe } = planMarineRoutes({
    from: { lat: ctx.intent.location.lat, lng: ctx.intent.location.lng, name: ctx.intent.location.label },
    to: { lat: dest.lat, lng: dest.lng, name: dest.id },
    vessel: ctx.intent.vessel, departLabel: ctx.intent.when ?? "now",
    safety: "cautious",
    liveWindKts: ctx.marine?.windSpeedKn, liveWaveM: ctx.marine?.waveHeight,
  });
  return {
    agent: "route", label: AGENT_LABELS["route"],
    verdict: `2 water-only options to ${dest.id}: direct ${direct.distanceKm} km / safe ${safe.distanceKm} km (${safe.risk.recommendation})`,
    detail: safe.explanation,
    confidence: 76,
    sources: [{ name: "ORCA marine router (demo bathymetry + MPA boxes)", mode: "demo" as DataMode }],
    evidence: [
      `direct ${direct.distanceKm} km, ${direct.durationMin} min, min depth ${direct.minDepthM} m`,
      `safe ${safe.distanceKm} km, ${safe.durationMin} min, min depth ${safe.minDepthM} m`,
      ...(safe.mpaConflicts.length ? [`conflicts avoided: ${safe.mpaConflicts.join("; ")}`] : ["no MPA conflicts"]),
    ],
    rulesTriggered: safe.eezCrossing ? ["G2: route crosses EEZ line"] : [],
    dataTimes: [],
    data: { direct, safe, destId: dest.id },
  };
}

async function riskAgent(ctx: Ctx, routeInfo?: { minDepth: number | null; clearance: number | null; eez: boolean }): Promise<AgentResult> {
  const m = ctx.marine;
  const demo = ctx.records.find(r => r.id === "demo-imd-002");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lightning = !!((demo?.data as any)?.lightning ?? false);
  const risk = assessRisk({
    windKts: m?.windSpeedKn ?? 14,
    waveM: m?.waveHeight ?? 0.8,
    wavePeriodS: m?.wavePeriod,
    lightning,
    visibilityKm: m?.visibilityKm,
    vessel: ctx.intent.vessel,
    minDepthOnRouteM: routeInfo?.minDepth ?? undefined,
    mpaIntrusionKm: routeInfo?.clearance ?? undefined,
    eezCrossing: routeInfo?.eez,
    forecastConfidence: 72,
    forecastWindow: ctx.intent.when ?? "now",
  });
  const L = ctx.lang;
  return {
    agent: "risk", label: AGENT_LABELS["risk"],
    verdict: `${t(L, `risk.${risk.level}`)} — ${t(L, `rec.${risk.recommendation}`)} (${ctx.intent.vessel.label})`,
    detail: risk.thresholdsExceeded.length ? risk.thresholdsExceeded.join(" • ") : "All core factors within vessel limits.",
    confidence: risk.confidence,
    sources: [{ name: "ORCA risk engine (vessel thresholds)", mode: "demo" as DataMode }],
    evidence: [...risk.thresholdsExceeded, ...risk.supporters],
    rulesTriggered: risk.thresholdsExceeded.map(x => `T: ${x}`),
    dataTimes: m ? [m.time] : [],
    data: { risk },
  };
}

function explanationAgent(ctx: Ctx, settled: AgentResult[], lang: Lang): AgentResult {
  const by = (n: AgentName) => settled.find(r => r.agent === n);
  const core = ["marine-data", "ocean-analytics", "weather-hazard", "geospatial", "route", "risk"]
    .map(n => by(n as AgentName)).filter(Boolean) as AgentResult[];
  const conf = Math.round(settled.reduce((s, r) => s + r.confidence, 0) / Math.max(1, settled.length));
  const liveCount = ctx.records.filter(r => r.dataMode === "live").length;
  const demoCount = ctx.records.filter(r => r.dataMode === "demo").length;
  const hi = lang === "hi";
  const lines = core.map(r => `• **${t(lang, `agent.${r.agent}`)}**: ${r.verdict}`);
  const answer = hi
    ? `${lines.join("\n")}\n\nसमग्र विश्वास ${conf}%। ${liveCount} लाइव और ${demoCount} डेमो रिकॉर्ड इस्तेमाल हुए। अनिश्चितता: उपग्रह क्लोरोफिल 21-दिन का औसत है; आधिकारिक INCOIS/IMD सलाह को प्राथमिकता दें।`
    : `${lines.join("\n")}\n\nOverall confidence ${conf}%. Grounded on ${liveCount} Live and ${demoCount} Demo records. Uncertainty: satellite chlorophyll is a 21-day mean; official INCOIS/IMD advisories take precedence.`;
  return {
    agent: "explanation", label: AGENT_LABELS["explanation"],
    verdict: `Synthesised ${core.length} agent reports at ${conf}% confidence`,
    detail: answer, confidence: conf,
    sources: [],
    evidence: core.flatMap(r => r.evidence).slice(0, 8),
    rulesTriggered: [], dataTimes: [],
  };
}

const ROUTE_FOR: Record<Intent["type"], AgentName[]> = {
  pfz: ["marine-data", "ocean-analytics", "geospatial", "risk", "explanation", "visualization"],
  safety: ["marine-data", "weather-hazard", "risk", "explanation", "visualization"],
  weather: ["marine-data", "weather-hazard", "explanation", "visualization"],
  alerts: ["weather-hazard", "risk", "explanation", "visualization"],
  chlorophyll: ["ocean-analytics", "marine-data", "explanation", "visualization"],
  route: ["marine-data", "weather-hazard", "geospatial", "route", "risk", "explanation", "visualization"],
  avoid: ["geospatial", "risk", "explanation", "visualization"],
  general: ["marine-data", "ocean-analytics", "weather-hazard", "risk", "explanation"],
};

export async function askPlanner(query: string, conv?: Conversation): Promise<PlanTrace> {
  const c: Conversation = conv ?? freshConversation();
  const lang: Lang = c.language === "en" ? detectLang(query) : c.language;
  const intent = detectIntent(query, c);
  const agents = ROUTE_FOR[intent.type];
  const ctx: Ctx = { intent, lang, marine: null, records: [...adaptUnavailable()] };

  const settled: AgentResult[] = [];
  const run = async (a: AgentName, fn: () => Promise<AgentResult>) => {
    try {
      settled.push(await fn());
    } catch (e) {
      settled.push({
        agent: a, label: AGENT_LABELS[a], verdict: "Agent unavailable", detail: String(e),
        confidence: 0, sources: [], evidence: [], rulesTriggered: [], dataTimes: [],
      });
    }
  };

  // Planner: marine data first (grounds everything), then the rest in parallel.
  await run("marine-data", () => marineDataAgent(ctx));
  const destMatch = query.match(/pfz-?\d+/i)?.[0];
  await Promise.all(agents.filter(a => a !== "marine-data" && a !== "explanation" && a !== "visualization").map(a => {
    if (a === "ocean-analytics") return run(a, () => oceanAnalyticsAgent(ctx));
    if (a === "weather-hazard") return run(a, () => weatherHazardAgent(ctx));
    if (a === "geospatial") return run(a, () => geospatialAgent(ctx));
    if (a === "route") return run(a, () => routeAgent(ctx, destMatch ?? undefined));
    if (a === "risk") {
      return run(a, async () => {
        const rt = settled.find(r => r.agent === "route");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const safe = (rt?.data as any)?.safe;
        return riskAgent(ctx, safe ? { minDepth: safe.minDepthM, clearance: safe.mpaClearanceKm, eez: safe.eezCrossing } : undefined);
      });
    }
    return Promise.resolve();
  }));

  const expl = explanationAgent(ctx, settled, lang);
  settled.push(expl);
  const viz: AgentResult = {
    agent: "visualization", label: AGENT_LABELS["visualization"],
    verdict: "Map layers, charts and evidence panels updated",
    detail: "PFZ + ports + restricted-zone + route overlays refreshed with source labels.",
    confidence: 95, sources: [], evidence: [], rulesTriggered: [], dataTimes: [],
  };
  settled.push(viz);

  const order = (a: AgentResult) => agents.indexOf(a.agent);
  settled.sort((x, y) => order(x) - order(y));

  const sources = [...ctx.records.map(srcOf), ...settled.flatMap(r => r.sources)]
    .filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i);
  const riskData = settled.find(r => r.agent === "risk")?.data?.risk as RiskResult | undefined;
  const routeData = settled.find(r => r.agent === "route")?.data;
  return {
    query, intent, agentsRun: agents, answer: expl.detail, results: settled,
    sources, live: !!ctx.marine, generatedAt: new Date().toISOString(), language: lang,
    risk: riskData,
    routes: routeData ? [routeData.direct, routeData.safe] : undefined,
  };
}

// Keep the location name in sync for UI chips.
export function nearHarbourName(lat: number, lng: number): string {
  let best = SCENARIOS[0];
  let bd = Infinity;
  for (const s of SCENARIOS) {
    const d = haversineKm(lat, lng, s.lat, s.lng);
    if (d < bd) { bd = d; best = s; }
  }
  return best.harbour;
}
