# ORCA — Marine EcOsystem Reasoning with Collaborative Agents (SIH26176)

Agentic-AI marine intelligence demo for fishermen and marine stakeholders:
Potential Fishing Zones, sea-safety assessment, hazard/geofence alerts and
water-only safe-route planning. Dark mission-control UI, no redesign.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3001 (3000 is often taken)
npm test           # vitest: risk, geofence, router, adapter-schema tests
npm run build
```

Copy `.env.example` to `.env.local` only if you want Google Maps mode
(`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`). Everything else is keyless.

## Data sources

Open, no registration: Open-Meteo (marine+forecast), NASA MODIS-Aqua &
JPL MUR SST via NOAA ERDDAP, INCOIS advisory validity, OSM/Overpass ports,
Esri/OSM/CARTO tiles. See **Data Sources** page (`/sources`) for the full
Live / Demo data / Unavailable directory — nothing simulated is labelled Live.

Seeded scenario: **Mumbai Harbour (18.93°N, 72.90°E)** with offshore Demo
PFZs. Other harbours (Alibaug → Paradip) via map search or the assistant.

## Architecture

```
open APIs ──┐
INCOIS page ─┼─▶ Next.js API routes (/api/…) + TTL disk cache (.data/)
ERDDAP ─────┘   (demo stand-in for Airflow + PostGIS/MinIO)
        │
        ▼
src/lib/marine/adapters.ts ──▶ NormalizedRecord[] (source, timestamps,
  PFZ · OSF · SST/chl · alerts · ports · EEZ · MPA · bathymetry   units, confidence, isMock/dataMode)
        │
        ▼
src/lib/agents/planner.ts ──▶ 8 agents: planner, marine-data,
  ocean-analytics, weather-hazard, geospatial, route, risk,
  explanation, visualization → answer + trace
        │
        ▼
React UI (Next.js + Leaflet, Google optional): dashboard, map,
assistant + How-produced panel, alerts, water-only routes, analytics
```

Cross-cutting: `risk.ts` (vessel thresholds), `geo.ts` (GeoJSON math),
`router.ts` (water-only routing), `i18n.ts` (EN/HI + registry), `schema.ts`.

Full doc: `ARCHITECTURE.md`.
