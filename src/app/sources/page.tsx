"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DataBadge from "@/components/DataBadge";
import type { DataMode } from "@/lib/marine/schema";

interface Row {
  dataset: string;
  provides: string;
  status: DataMode;
  link: string;
  note: string;
}

const ROWS: Row[] = [
  { dataset: "Open-Meteo Marine + Forecast", provides: "Wave height/period/direction, SST, wind, visibility, 4-day forecast", status: "live", link: "https://open-meteo.com", note: "No key. Buoy point offshore; models, not observations." },
  { dataset: "NASA MODIS-Aqua chlorophyll (ERDDAP)", provides: "21-day mean chlorophyll-a, 4 km", status: "live", link: "https://coastwatch.pfeg.noaa.gov/erddap", note: "No login. Science-quality lags ~3 months; monsoon cloud gaps." },
  { dataset: "JPL MUR SST (ERDDAP)", provides: "Satellite SST cross-check", status: "live", link: "https://coastwatch.pfeg.noaa.gov/erddap", note: "No login." },
  { dataset: "INCOIS PFZ validity", provides: "Advisory forecast date + sector links", status: "live", link: "https://incois.gov.in/MarineFisheries/PfzAdvisory", note: "Per-sector lat/long text loads in site JS — linked, not scraped." },
  { dataset: "OpenStreetMap ports/harbours", provides: "Seamarks + ferry terminals near the coast", status: "live", link: "https://www.openstreetmap.org", note: "Via Overpass; curated fallback if unreachable. ODbL attribution." },
  { dataset: "Esri Ocean / OSM / CARTO basemaps", provides: "Map tiles + place-name overlays", status: "live", link: "https://www.openstreetmap.org/copyright", note: "Free tile use; attribution shown on map." },
  { dataset: "Demo PFZ positions", provides: "PFZ-001…003 (INCOIS advisory shape)", status: "demo", link: "https://incois.gov.in/MarineFisheries/PfzAdvisory", note: "Simulated until INCOIS WebGIS nodes sync." },
  { dataset: "Demo Ocean State Forecast", provides: "Tide, currents, swell, salinity", status: "demo", link: "https://incois.gov.in/portal/osf/osf.jsp", note: "INCOIS OSF shape, simulated values." },
  { dataset: "Demo IMD / SACHET alerts", provides: "Strong-wind + lightning advisories", status: "demo", link: "https://sachet.ndma.gov.in", note: "IMD/CAP field shapes, simulated content." },
  { dataset: "Curated MPA boxes", provides: "Malvan + Gulf of Kachchh restricted zones", status: "demo", link: "https://www.protectedplanet.net", note: "Simplified boxes, not legal boundaries." },
  { dataset: "Simplified EEZ line", provides: "West-coast EEZ outer limit (coarse)", status: "demo", link: "https://www.marineregions.org", note: "Not for navigation." },
  { dataset: "Demo bathymetry", provides: "Depth-from-coast model for routing", status: "demo", link: "https://www.gebco.net", note: "Replace with GEBCO grid." },
  { dataset: "Demo tide / current curves", provides: "Analytics time-series", status: "demo", link: "", note: "Harmonic-style simulation." },
  { dataset: "ISRO MOSDAC products", provides: "Chlorophyll OC2/OC4, SST, currents", status: "unavailable", link: "https://www.mosdac.gov.in", note: "Needs free MOSDAC SSO registration." },
  { dataset: "Copernicus Marine (CMEMS)", provides: "Physics + biogeochemistry forecasts", status: "unavailable", link: "https://marine.copernicus.eu", note: "Needs free Copernicus registration." },
  { dataset: "NDMA SACHET CAP feed", provides: "Machine-readable multi-hazard alerts", status: "unavailable", link: "https://sachet.ndma.gov.in", note: "Needs agency endpoint identifier." },
  { dataset: "Global Fishing Watch AIS", provides: "Vessel activity enrichment", status: "unavailable", link: "https://globalfishingwatch.org", note: "Needs API token (optional)." },
  { dataset: "Bhuvan Geoportal", provides: "Indian coastline GIS layers", status: "unavailable", link: "https://bhuvan-app1.nrsc.gov.in", note: "Needs registration for WMS/WFS." },
];

export default function SourcesPage() {
  return (
    <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Data Sources & Attribution</h1>
      <p className="text-sm text-muted-foreground mt-1">Every figure in ORCA traces to one of these rows. Nothing simulated is ever labelled Live.</p>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">SOURCE DIRECTORY</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {ROWS.map(r => (
            <div key={r.dataset} className="rounded-xl border p-3 text-sm flex flex-wrap items-center gap-2">
              <div className="min-w-[220px] flex-1">
                <div className="font-medium">{r.dataset}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{r.provides}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{r.note}</div>
              </div>
              <DataBadge mode={r.status} />
              {r.link && <a href={r.link} target="_blank" rel="noreferrer" className="text-xs underline text-[#4BA3FF]">source ↗</a>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">DEMO MODE — WHAT IS SIMULATED?</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p><Badge variant="secondary" className="mr-1">Demo data</Badge> PFZ positions, OSF tide/currents/swell, IMD-style alerts, MPA boxes, EEZ line, bathymetry and tide curves are realistic fixtures in the exact INCOIS/WDPA/GEBCO record shapes. They exist so routing, geofencing and risk logic can be evaluated today.</p>
          <p><Badge variant="secondary" className="mr-1">Live</Badge> Open-Meteo model fields, MODIS-Aqua chlorophyll, MUR SST, INCOIS validity dates and OSM ports stream from open endpoints with timestamps.</p>
          <p><Badge variant="secondary" className="mr-1">Unavailable</Badge> MOSDAC, CMEMS, SACHET CAP, GFW and Bhuvan activate with free registrations/tokens — the schema and UI slots are ready.</p>
          <p className="text-foreground font-medium">Seeded scenario: Mumbai Harbour (18.93°N, 72.90°E). Switch harbours via map search — Alibaug, Ratnagiri, Goa, Kochi, Chennai, Visakhapatnam, Paradip.</p>
        </CardContent>
      </Card>
    </div>
  );
}
