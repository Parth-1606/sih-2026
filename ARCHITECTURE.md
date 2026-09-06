# ORCA Architecture (SIH26176 — ISRO)

```
┌─ EXTERNAL OPEN DATA ─────────────────────────────────────────┐
│ Live (no key): Open-Meteo · NASA ERDDAP · INCOIS page · OSM  │
│ Demo fixtures: PFZ · OSF · IMD alerts · MPA · EEZ · GEBCO    │
│ Unavailable (needs token): MOSDAC · CMEMS · SACHET · GFW     │
└──────────────────────────┬─────────────────────────────────┘
                           │ fetch (browser + API routes)
┌─ INGESTION + CACHE ──────▼─────────────────────────────────┐
│ src/app/api/… (ocean, geo, advisories) + src/lib/cache.ts   │
│ TTL disk cache in .data/ = demo stand-in for Airflow +      │
│ MinIO (raw) + PostgreSQL/PostGIS/TimescaleDB (structured)   │
└──────────────────────────┬─────────────────────────────────┘
                           │ NormalizedRecord[] (schema.ts)
┌─ ADAPTERS ───────────────▼─────────────────────────────────┐
│ src/lib/marine/adapters.ts — one fn per dataset family.     │
│ Never throws: failures become `unavailable` records. Demo   │
│ records carry isMock:true + dataMode:"demo".                │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌─ 8-AGENT WORKFLOW ───────▼─────────────────────────────────┐
│ planner.ts: intent → route agents → parallel run → risk →   │
│ explanation → trace {intent, steps, sources, timestamps,    │
│ evidence, rules, confidence}. Optional local LLM later.     │
└──────┬───────────────────────────────┬─────────────────────┘
       │ risk.ts (vessel thresholds)   │ geo.ts + router.ts
       │ Safe/…/Do-not-venture        │ water-only routes,
       ▼                               ▼  geofences, EEZ
┌─ REACT UI (Next.js + Leaflet) ─────────────────────────────┐
│ dashboard · map (layers/legends/opacity/timeline) ·         │
│ assistant (context, EN/HI, How-produced) · alerts ·         │
│ marine routes (compare/animate/recalc) · analytics · sources│
└────────────────────────────────────────────────────────────┘
```

## Deploying the full PDF stack later

| Demo piece | Production replacement | Touch points |
|---|---|---|
| API routes + `.data/` cache | Airflow DAGs + MinIO + PostGIS | `src/app/api/*`, `cache.ts` only |
| In-app agents (`planner.ts`) | LangGraph/CrewAI service | keep `AgentResult`/`PlanTrace` shapes |
| Heuristic intent | Llama 3 / Qwen via Ollama + Bhashini | `detectIntent`, `i18n.ts` |
| Demo fixtures | MOSDAC/CMEMS/SACHET/GFW tokens | `adapters.ts` + `.env` |
| Simplified EEZ/MPA | VLIZ + WDPA polygons | `marine-zones.ts`, `fixtures.ts` |

UI consumes only `NormalizedRecord` and `PlanTrace` — sources can be
swapped without touching a single page.
