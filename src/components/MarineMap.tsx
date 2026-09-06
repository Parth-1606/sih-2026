"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { userLocation } from "@/lib/mock";
import DataBadge from "@/components/DataBadge";
import type { DrawnRoute, FitBox, LayerId, MapCenter, StyleMode } from "./LeafletBase";

// Client-only: Leaflet/Google touch `window` at import time, so never SSR them.
const LeafletBase = dynamic(() => import("./LeafletBase"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 z-0 flex items-center justify-center text-sm text-white/60 bg-[#0A2733]">
      Loading real map…
    </div>
  ),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GoogleBase = dynamic<any>(() => import("./GoogleBase"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 z-0 flex items-center justify-center text-sm text-white/60 bg-[#0A2733]">
      Loading Google Maps…
    </div>
  ),
});

export const LAYERS: { id: LayerId; label: string; defaultOn: boolean }[] = [
  { id: "pfz", label: "Potential Fishing Zones", defaultOn: true },
  { id: "sst", label: "Sea Surface Temperature", defaultOn: false },
  { id: "chlorophyll", label: "Chlorophyll", defaultOn: false },
  { id: "weather", label: "Weather", defaultOn: false },
  { id: "waves", label: "Wave Conditions", defaultOn: false },
  { id: "geofences", label: "Geofences", defaultOn: true },
  { id: "alerts", label: "Marine Alerts", defaultOn: true },
  { id: "ports", label: "Ports & Harbours (OSM)", defaultOn: false },
  { id: "restricted", label: "Restricted Zones (MPA)", defaultOn: true },
];

export default function MarineMap({
  height = 520,
  interactive = true,
  onSelectPFZ,
  onSelectFeature,
  focus,
  route,
  routeAlt,
  fit,
  animateRoute,
}: {
  height?: number | string;
  interactive?: boolean;
  onSelectPFZ?: (id: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSelectFeature?: (f: any) => void;
  focus?: { lat: number; lng: number; nonce: number } | null;
  route?: DrawnRoute | null;
  routeAlt?: DrawnRoute | null;
  fit?: FitBox | null;
  animateRoute?: { coords: [number, number][]; nonce: number } | null;
}) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [layers, setLayers] = useState<Record<LayerId, boolean>>(() => Object.fromEntries(LAYERS.map(l => [l.id, l.defaultOn])) as any);
  const [styleMode, setStyleMode] = useState<StyleMode>("ocean");
  const [zoom, setZoom] = useState(9);
  const [center, setCenter] = useState<[number, number]>([18.85, 72.7]);
  const [showLayers, setShowLayers] = useState(false);
  const [measure, setMeasure] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [inspector, setInspector] = useState<any>(null);
  const [ports, setPorts] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  // OSM ports layer (live Overpass via API route, curated fallback inside).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/geo/ports?s=15.5&w=72&n=20&e=74.5")
      .then(r => (r.ok ? r.json() : { ports: [] }))
      .then(j => { if (!cancelled && j.ports) setPorts(j.ports); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleMove = useCallback((z: number, c: MapCenter) => {
    setZoom(z);
    setCenter([Number(c.lat.toFixed(4)), Number(c.lng.toFixed(4))]);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleReady = useCallback((map: any) => {
    mapRef.current = map;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleInspect = useCallback((data: any) => {
    setInspector(data);
    if (data?.kind === "pfz" && data?.id) {
      onSelectPFZ?.(data.id);
      onSelectFeature?.({ id: data.id });
      // Enrich with satellite chlorophyll (MODIS-Aqua via our API route).
      const m = String(data.lat ?? "").match(/([\d.]+)/);
      const n = String(data.lng ?? "").match(/([\d.]+)/);
      if (m && n) {
        fetch(`/api/ocean/chlorophyll?lat=${m[1]}&lng=${n[1]}`)
          .then(r => (r.ok ? r.json() : null))
          .then(j => {
            if (j?.meanChl != null) {
              setInspector((prev: unknown) =>
                prev && typeof prev === "object" ? { ...(prev as object), chlSat: `${j.meanChl} mg/m³ (21-day mean)` } : prev
              );
            }
          })
          .catch(() => {});
      }
    }
  }, [onSelectPFZ, onSelectFeature]);

  const cycleStyle = () =>
    setStyleMode(s => (s === "ocean" ? "streets" : s === "streets" ? "voyager" : s === "voyager" ? "dark" : s === "dark" ? "satellite" : s === "satellite" ? "google" : "ocean"));

  const zoomBy = (delta: number) => {
    const m = mapRef.current;
    if (!m) return;
    if (typeof m.zoomIn === "function" && typeof m.zoomOut === "function") {
      if (delta > 0) (m as L.Map).zoomIn();
      else (m as L.Map).zoomOut();
    } else if (typeof m.getZoom === "function" && typeof m.setZoom === "function") {
      m.setZoom(Math.min(20, Math.max(3, m.getZoom() + delta)));
    }
  };

  const flyToUser = () => {
    const m = mapRef.current;
    if (!m) return;
    if (typeof m.flyTo === "function") {
      (m as L.Map).flyTo([userLocation.latitude, userLocation.longitude], 11);
    } else if (typeof m.panTo === "function" && typeof m.setZoom === "function") {
      m.panTo({ lat: userLocation.latitude, lng: userLocation.longitude });
      m.setZoom(11);
    }
  };

  // External fly-to (e.g. place search results).
  useEffect(() => {
    if (!focus) return;
    const m = mapRef.current;
    if (!m) return;
    if (typeof m.flyTo === "function") {
      (m as L.Map).flyTo([focus.lat, focus.lng], 10, { duration: 1.2 });
    } else if (typeof m.panTo === "function" && typeof m.setZoom === "function") {
      m.panTo({ lat: focus.lat, lng: focus.lng });
      m.setZoom(10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  return (
    <Card className="relative overflow-hidden p-0 gap-0 border bg-[#0A2733] shadow-lg" style={{ height: typeof height === "number" ? height : height }}>
      {/* REAL MAP BASE (client-only) */}
      {styleMode === "google" ? (
        googleKey ? (
          <GoogleBase
            apiKey={googleKey}
            layers={layers}
            interactive={interactive}
            onMove={handleMove}
            onReady={handleReady}
            onInspect={handleInspect}
            ports={ports}
            route={route}
            routeAlt={routeAlt}
            fit={fit}
          />
        ) : (
          <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#0A2733] p-6">
            <Card className="max-w-sm p-5 text-center space-y-3">
              <CardTitle className="text-sm">Google Maps needs an API key</CardTitle>
              <p className="text-xs text-muted-foreground leading-5">
                Enable <b>Maps JavaScript API</b> in Google Cloud Console, then add to{" "}
                <code className="font-mono bg-muted px-1 rounded">.env.local</code>:
                <br />
                <code className="font-mono bg-muted px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key</code>
                <br />and restart the dev server. Meanwhile use Ocean / Dark / Satellite — they now show place names.
              </p>
              <Button size="sm" onClick={cycleStyle}>Back to Ocean map</Button>
            </Card>
          </div>
        )
      ) : (
        <LeafletBase
          styleMode={styleMode}
          layers={layers}
          interactive={interactive}
          onMove={handleMove}
          onReady={handleReady}
          onInspect={handleInspect}
          ports={ports}
          route={route}
          routeAlt={routeAlt}
          fit={fit}
          animateRoute={animateRoute}
          overlayOpacity={overlayOpacity}
        />
      )}

      {/* Controls — shadcn Button + Card (above Leaflet panes) */}
      <div className="absolute left-3 top-3 flex flex-col gap-2 z-[1200]">
        <Card className="p-0 gap-0 overflow-hidden w-fit">
          <Button variant="ghost" size="icon-sm" onClick={() => zoomBy(1)} className="rounded-none">＋</Button>
          <Separator />
          <Button variant="ghost" size="icon-sm" onClick={() => zoomBy(-1)} className="rounded-none">－</Button>
        </Card>
        <Button variant="secondary" size="icon" className="rounded-xl shadow-xl" onClick={flyToUser}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>
        </Button>
        <Button variant="secondary" size="icon" className="rounded-xl shadow-xl" onClick={() => document.documentElement.requestFullscreen?.()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 3H3v5M21 8V3h-5M3 16v5h5M16 21h5v-5" /></svg>
        </Button>
      </div>

      <div className="absolute right-3 top-3 flex items-center gap-2 z-[1200]">
        <Button variant={measure ? "default" : "secondary"} size="sm" className="rounded-full backdrop-blur" onClick={() => setMeasure(!measure)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 7l5 5-5 5M21 7l-5 5 5 5" /></svg> Measure
        </Button>
        <Button variant="secondary" size="sm" className="rounded-full backdrop-blur capitalize" onClick={cycleStyle}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M12 3a15 15 0 010 18" /></svg> {styleMode}
        </Button>
        <div className="relative">
          <Button size="icon" className="rounded-full shadow" onClick={() => setShowLayers(v => !v)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 8l9 5 9-5" /><path d="M3 13l9 5 9-5" /></svg>
          </Button>
          {showLayers && (
            <Card className="absolute right-0 mt-2 w-64 p-3 z-10">
              <CardHeader className="p-0 pb-2"><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">MAP LAYERS</CardTitle></CardHeader>
              <CardContent className="p-0 space-y-0">
                {LAYERS.map(l => (
                  <label key={l.id} className="flex items-center justify-between py-2 cursor-pointer">
                    <span className="text-sm">{l.label}</span>
                    <Button variant={layers[l.id] ? "default" : "outline"} size="sm" className="w-9 h-5 rounded-full p-0.5" onClick={() => setLayers(s => ({ ...s, [l.id]: !s[l.id as LayerId] }))}>
                      <span className={`size-4 bg-white rounded-full shadow block transition-transform ${layers[l.id] ? "translate-x-3" : "translate-x-0"}`} />
                    </Button>
                  </label>
                ))}
                <div className="pt-2 border-t mt-1">
                  <div className="text-[11px] text-muted-foreground mb-1">Overlay opacity — {Math.round(overlayOpacity * 100)}%</div>
                  <input type="range" min={20} max={100} value={Math.round(overlayOpacity * 100)} onChange={e => setOverlayOpacity(Number(e.target.value) / 100)} className="w-full accent-primary" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="absolute left-3 bottom-3 hidden sm:flex items-center gap-2 bg-card/90 border backdrop-blur px-3 py-1.5 rounded-full text-[10px] text-muted-foreground z-[1200]">
        <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#F2C94C]" /> PFZ</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#FF6B6B]" /> Restricted</span>
        <span className="flex items-center gap-1">⚓ Ports</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0 border-t-2 border-[#35C98A]" /> Route</span>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 bottom-3 flex items-center gap-2 bg-card/90 border backdrop-blur px-3 py-1.5 rounded-full text-[11px] text-muted-foreground z-[1200]">
        <span>{zoom.toFixed(1)}×</span><Separator orientation="vertical" className="h-3" /><span>{center[0].toFixed(2)}°N, {center[1].toFixed(2)}°E</span><Separator orientation="vertical" className="h-3" /><span>{styleMode}</span>
      </div>

      {measure && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1200]"><Badge className="bg-[#F2C94C] text-[#071014] hover:bg-[#F2C94C]">32 km — drag map to measure</Badge></div>}

      {inspector && (
        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute right-3 bottom-12 w-[300px] z-[1200]">
          <Card className="shadow-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">{inspector.title} {inspector.conf && <Badge className="bg-[#F2C94C] text-[#071014] hover:bg-[#F2C94C]">{inspector.conf}%</Badge>} {inspector.alert && <span className="size-2 bg-[#F4B942] rounded-full animate-pulse" />}</CardTitle>
                  <CardDescription className="text-xs">{inspector.sub}</CardDescription>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setInspector(null)}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(inspector.lat || inspector.sst) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {inspector.lat && <div className="bg-muted border rounded-xl p-2"><div className="text-muted-foreground text-[11px]">Coordinates</div><div className="font-mono font-medium">{inspector.lat}, {inspector.lng}</div></div>}
                  {inspector.sst && <div className="bg-muted border rounded-xl p-2"><div className="text-muted-foreground text-[11px]">SST • Chlorophyll</div><div className="font-medium">{inspector.sst} • {inspector.chl} mg/m³</div></div>}
                </div>
              )}
              {inspector.chlSat && (
                <div className="text-xs bg-muted border rounded-xl p-2"><span className="text-muted-foreground">🛰 MODIS-Aqua: </span><span className="font-medium">{inspector.chlSat}</span></div>
              )}
              <div className="flex gap-2">
                <Button size="sm" className="flex-1">View on map</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => router.push("/assistant")}>Ask AI</Button>
              </div>
              <div className="text-[11px] text-muted-foreground space-y-1">
                {inspector.srcName ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {inspector.mode && <DataBadge mode={inspector.mode} />}
                    {inspector.srcUrl
                      ? <a href={inspector.srcUrl} target="_blank" rel="noreferrer" className="underline">{inspector.srcName}</a>
                      : <span>{inspector.srcName}</span>}
                  </div>
                ) : (
                  <div>Source: onboard reference • AI interpretation available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </Card>
  );
}
