// ORCA collaborative-agent layer (PDF §3 layers 4–5).
// In-app TypeScript implementation of the architecture's agent team:
// a planner routes each query to specialist agents that read the live
// ingestion routes, then synthesises one explainable answer with sources.
// Maps to LangGraph/CrewAI + Ollama/vLLM in the full deployment.
import { fetchLiveMarine, type LiveMarine } from "@/lib/marine-api";
import { CURATED_MPAS } from "@/lib/marine-zones";

export type AgentName =
  | "marine-data"
  | "ocean-analytics"
  | "weather-intel"
  | "geospatial"
  | "risk"
  | "visualization";

export interface AgentSource {
  name: string;
  url?: string;
}

export interface AgentResult {
  agent: AgentName;
  label: string;
  verdict: string;
  detail: string;
  confidence: number; // 0-100
  sources: AgentSource[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export interface PlanTrace {
  query: string;
  agentsRun: AgentName[];
  answer: string;
  results: AgentResult[];
  sources: AgentSource[];
  live: boolean;
  generatedAt: string;
}

async function getJSON<T>(url: string, timeoutMs = 20000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

async function liveMarineSafe(): Promise<LiveMarine | null> {
  try {
    return await fetchLiveMarine();
  } catch {
    return null;
  }
}

const SRC = {
  openMeteo: { name: "Open-Meteo Marine + Forecast API", url: "https://open-meteo.com" },
  erddap: { name: "NASA MODIS-Aqua chlorophyll (ERDDAP)", url: "https://coastwatch.pfeg.noaa.gov/erddap" },
  osm: { name: "OpenStreetMap (Overpass)", url: "https://www.openstreetmap.org" },
  incois: { name: "INCOIS PFZ Advisory", url: "https://incois.gov.in/MarineFisheries/PfzAdvisory" },
};

async function marineDataAgent(): Promise<AgentResult> {
  const m = await liveMarineSafe();
  if (!m) {
    return {
      agent: "marine-data", label: "Marine Data Discovery", verdict: "OFFLINE — using onboard climatology",
      detail: "Live ocean feed unreachable; falling back to regional reference values (SST 28.1°C, wave 0.8m).",
      confidence: 40, sources: [SRC.openMeteo],
    };
  }
  return {
    agent: "marine-data", label: "Marine Data Discovery",
    verdict: `SST ${m.sst.toFixed(1)}°C • wave ${m.waveHeight.toFixed(1)}m / ${m.wavePeriod.toFixed(0)}s • current ${m.currentVelocity} m/s`,
    detail: `Offshore buoy (Arabian Sea): sea-surface temperature ${m.sst.toFixed(1)}°C, wave height ${m.waveHeight.toFixed(1)}m period ${m.wavePeriod.toFixed(1)}s from ${m.waveDirection}°, surface current ${m.currentVelocity} m/s. Observed ${m.time} IST.`,
    confidence: 88, sources: [SRC.openMeteo], data: m,
  };
}

async function oceanAnalyticsAgent(m: LiveMarine | null): Promise<AgentResult> {
  let chl: number | null = null;
  let chlWhen = "";
  try {
    const c = await getJSON<{ meanChl: number | null; windowEnd: string }>("/api/ocean/chlorophyll?lat=18.7&lng=72.4");
    chl = c.meanChl;
    chlWhen = c.windowEnd?.slice(0, 10) ?? "";
  } catch { /* satellite gap */ }
  const productive = chl != null && chl > 0.5;
  const sstOk = m ? m.sst > 26 && m.sst < 30 : true;
  const verdict = productive && sstOk
    ? `HIGH productivity likely — chlorophyll ${chl!.toFixed(2)} mg/m³ with SST in the PFZ window`
    : chl == null
      ? "Satellite chlorophyll unavailable (monsoon cloud) — SST-only assessment"
      : `MODERATE — chlorophyll ${chl.toFixed(2)} mg/m³ below the 0.5 bloom threshold`;
  return {
    agent: "ocean-analytics", label: "Ocean Analytics (SST / Chlorophyll / PFZ)",
    verdict, detail: `MODIS-Aqua 21-day mean chlorophyll ${chl != null ? chl.toFixed(2) + " mg/m³" : "n/a"} (window ending ${chlWhen || "n/a"}). INCOIS derives PFZ from exactly these two fronts — SST + chlorophyll. Recommendation aligns with PFZ-001 NE (mock position pending INCOIS WebGIS sync).`,
    confidence: chl != null ? 82 : 55, sources: [SRC.erddap, SRC.incois], data: { chl, chlWhen },
  };
}

async function weatherIntelAgent(m: LiveMarine | null): Promise<AgentResult> {
  if (!m) {
    return {
      agent: "weather-intel", label: "Weather Intelligence", verdict: "OFFLINE — reference winds only",
      detail: "Live wind feed unreachable.", confidence: 40, sources: [SRC.openMeteo],
    };
  }
  const f = m.forecast[1];
  return {
    agent: "weather-intel", label: "Weather Intelligence",
    verdict: `Now ${m.windSpeedKn} kts ${m.windCompass} • visibility ${m.visibilityKm} km • tomorrow ${f ? `${f.wind} kts / ${f.wave}m seas` : "n/a"}`,
    detail: `Current: wind ${m.windSpeedKn} kts from ${m.windDirectionDeg}° (${m.windCompass}), visibility ${m.visibilityKm} km, air ${m.airTemp}°C. Outlook (${f?.day}): max wind ${f?.wind} kts, max wave ${f?.wave}m, risk ${f?.risk}.`,
    confidence: 90, sources: [SRC.openMeteo], data: m.forecast,
  };
}

async function geospatialAgent(): Promise<AgentResult> {
  let ports: { name: string; lat: number; lng: number }[] = [];
  let src = "Curated major-port fallback";
  try {
    const p = await getJSON<{ ports: { name: string; lat: number; lng: number }[] }>("/api/geo/ports?s=15.5&w=72&n=20&e=74.5");
    if (p.ports?.length) { ports = p.ports; src = "OpenStreetMap via Overpass"; }
  } catch { /* fallback below */ }
  if (!ports.length) {
    const { CURATED_PORTS } = await import("@/lib/marine-zones");
    ports = CURATED_PORTS;
  }
  const mpaHit = CURATED_MPAS.map(z => z.name).join("; ");
  return {
    agent: "geospatial", label: "Geospatial Reasoning (routing & geofencing)",
    verdict: `${ports.length} ports/harbours indexed • ${CURATED_MPAS.length} restricted zones monitored`,
    detail: `Nearest refuge: Mumbai / Nhava Sheva complex. Restricted polygons active: ${mpaHit}. Full EEZ polygons (VLIZ) and WDPA boundaries plug in here once API tokens are provisioned.`,
    confidence: 75, sources: [{ name: src, url: "https://www.openstreetmap.org" }], data: { ports: ports.slice(0, 8) },
  };
}

async function riskAgent(m: LiveMarine | null): Promise<AgentResult> {
  const wind = m?.windSpeedKn ?? 14;
  const wave = m?.waveHeight ?? 0.8;
  const level = wind >= 28 || wave >= 2.5 ? "HIGH" : wind >= 17 || wave >= 1.25 ? "MEDIUM" : "LOW";
  return {
    agent: "risk", label: "Risk Assessment",
    verdict: `${level} risk — wind ${wind} kts, wave ${wave.toFixed(1)}m vs small-craft limits (25 kts / 2m)`,
    detail: level === "LOW"
      ? "Inside safe envelope for nearshore craft. Re-check if wind exceeds 22 kts or swell passes 1.8m. Machine-readable SACHET CAP ingestion lands here when the feed endpoint is provisioned."
      : "Outside comfort envelope — advise daylight nearshore ops only, life-jackets mandatory, file a float plan.",
    confidence: m ? 86 : 50,
    sources: [SRC.openMeteo, { name: "NDMA SACHET (CAP) — endpoint pending", url: "https://sachet.ndma.gov.in" }],
  };
}

function visualizationAgent(): AgentResult {
  return {
    agent: "visualization", label: "Visualization & Reporting",
    verdict: "Map centered on PFZ-001 sector with live overlays",
    detail: "Suggested view: Ocean basemap + PFZ + ports + restricted-zone layers at zoom 9. Inspector shows per-zone SST, chlorophyll and confidence.",
    confidence: 95, sources: [], data: { focus: { lat: 18.62, lng: 74.0 } },
  };
}

const AGENT_FNS: Record<AgentName, (m: LiveMarine | null) => Promise<AgentResult>> = {
  "marine-data": () => marineDataAgent(),
  "ocean-analytics": m => oceanAnalyticsAgent(m),
  "weather-intel": m => weatherIntelAgent(m),
  "geospatial": () => geospatialAgent(),
  "risk": m => riskAgent(m),
  "visualization": () => Promise.resolve(visualizationAgent()),
};

function route(query: string): AgentName[] {
  const q = query.toLowerCase();
  const want = new Set<AgentName>();
  if (/pfz|fish|chlorophyll|sst|temperature|zone|catch/.test(q)) { want.add("ocean-analytics"); want.add("marine-data"); want.add("visualization"); }
  if (/safe|sail|tomorrow|weather|wind|wave|go out|trip/.test(q)) { want.add("weather-intel"); want.add("risk"); want.add("marine-data"); }
  if (/cyclone|alert|warning|danger|tsunami|lightning|storm/.test(q)) { want.add("risk"); want.add("weather-intel"); }
  if (/rout|port|boundary|eez|restrict|geofence|harbour|harbor|distance|navigate/.test(q)) { want.add("geospatial"); want.add("visualization"); }
  if (/map|show|where/.test(q)) want.add("visualization");
  if (want.size === 0) ["marine-data", "ocean-analytics", "weather-intel", "risk"].forEach(a => want.add(a as AgentName));
  // Planner always grounds on live ocean data + always proposes a view.
  want.add("marine-data");
  if (!/map|show|where|rout|port/.test(q)) want.add("visualization");
  return [...want];
}

export async function askPlanner(query: string): Promise<PlanTrace> {
  const agents = route(query);
  const marine = await liveMarineSafe();
  const settled = await Promise.all(
    agents.map(async a => {
      try {
        return await AGENT_FNS[a](marine);
      } catch (e) {
        return {
          agent: a, label: a, verdict: "Agent unavailable", detail: String(e),
          confidence: 0, sources: [],
        } as AgentResult;
      }
    })
  );
  const by = (n: AgentName) => settled.find(r => r.agent === n);
  const parts = settled.map(r => `**${r.label}** — ${r.verdict}`);
  const conf = Math.round(settled.reduce((s, r) => s + r.confidence, 0) / Math.max(1, settled.length));
  const answer =
    `${parts.join("\n")}\n\nOverall confidence ${conf}%. ` +
    (by("risk") ? `Safety: ${by("risk")!.verdict.split("—")[0].trim()}. ` : "") +
    (marine ? `All figures live as of ${marine.time} IST; satellite chlorophyll is a 21-day mean (cloud-aware).` : `Live feeds unreachable — values are reference climatology.`);
  const sources = settled.flatMap(r => r.sources).filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i);
  return { query, agentsRun: agents, answer, results: settled, sources, live: !!marine, generatedAt: new Date().toISOString() };
}
