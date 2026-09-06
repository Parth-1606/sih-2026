"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import MarineMap from "@/components/MarineMap";
import type { FitBox } from "@/components/LeafletBase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchLiveMarine, searchPlaces } from "@/lib/marine-api";
import { pfzData } from "@/lib/mock";
import { planWaterRoutes, VESSELS, type VesselSpec, type WaterRoute } from "@/lib/marine/water-router";

interface Endpoint {
  lat: number;
  lng: number;
  name: string;
}

async function resolveEndpoint(text: string): Promise<Endpoint> {
  const t = text.trim();
  if (!t) throw new Error("Empty location");
  if (/my location/i.test(t)) {
    const m = t.match(/(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[3]), name: "My Location" };
  }
  const pfz = pfzData.find(p => p.id.toLowerCase() === t.toLowerCase());
  if (pfz && pfz.lat != null && pfz.lng != null) return { lat: pfz.lat, lng: pfz.lng, name: pfz.id };
  const m = t.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[3]), name: t };
  const r = await searchPlaces(t);
  if (!r.length) throw new Error(`Could not find "${t}" — try a harbour, PFZ id, or lat,lng`);
  return { lat: r[0].lat, lng: r[0].lng, name: r[0].name };
}

export default function RoutesPage() {
  const router = useRouter();
  const [start, setStart] = useState("Mumbai Harbour");
  const [dest, setDest] = useState("Alibaug");
  const [vessel, setVessel] = useState<VesselSpec["type"]>("small");
  const [safety, setSafety] = useState<"normal" | "cautious">("normal");
  const [depart, setDepart] = useState("Tomorrow 06:00");
  const [generated, setGenerated] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState<Endpoint | null>(null);
  const [to, setTo] = useState<Endpoint | null>(null);
  const [direct, setDirect] = useState<WaterRoute | null>(null);
  const [safe, setSafe] = useState<WaterRoute | null>(null);
  const [fit, setFit] = useState<FitBox | null>(null);
  const [anim, setAnim] = useState<{ coords: [number, number][]; nonce: number } | null>(null);
  const [liveWx, setLiveWx] = useState<{ windKts: number; waveM: number; time: string } | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<"direct" | "safe">("safe");

  const analyze = async (v = vessel, s = safety) => {
    setAnalyzing(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([resolveEndpoint(start), resolveEndpoint(dest)]);
      let wx = liveWx;
      if (!wx) {
        try {
          const m = await fetchLiveMarine();
          wx = { windKts: m.windSpeedKn, waveM: m.waveHeight, time: m.time };
          setLiveWx(wx);
        } catch { /* router falls back to reference exposure */ }
      }
      const { direct: d, safe: sf } = planWaterRoutes({
        from: a, to: b, vessel: VESSELS[v], departLabel: depart, safety: s,
        windKts: wx?.windKts ?? 14, waveM: wx?.waveM ?? 0.8,
      });
      setFrom(a);
      setTo(b);
      setDirect(d);
      setSafe(sf);
      const all = [...d.coords, ...sf.coords];
      const lats = all.map(c => c[0]);
      const lngs = all.map(c => c[1]);
      setFit({
        s: Math.min(...lats) - 0.15, w: Math.min(...lngs) - 0.15,
        n: Math.max(...lats) + 0.15, e: Math.max(...lngs) + 0.15,
        nonce: Date.now(),
      });
      setGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Route analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const changeVessel = (v: VesselSpec["type"]) => {
    setVessel(v);
    if (generated && from && to) {
      const r = planWaterRoutes({
        from, to, vessel: VESSELS[v], departLabel: depart, safety,
        windKts: liveWx?.windKts ?? 14, waveM: liveWx?.waveM ?? 0.8,
      });
      setDirect(r.direct);
      setSafe(r.safe);
    }
  };

  const changeSafety = (s: "normal" | "cautious") => {
    setSafety(s);
    if (generated && from && to) {
      const r = planWaterRoutes({
        from, to, vessel: VESSELS[vessel], departLabel: depart, safety: s,
        windKts: liveWx?.windKts ?? 14, waveM: liveWx?.waveM ?? 0.8,
      });
      setDirect(r.direct);
      setSafe(r.safe);
    }
  };

  const shown = selectedRoute === "direct" ? direct : safe;
  const other = selectedRoute === "direct" ? safe : direct;
  const fmtTime = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Safe Route Planner</h1>
      <p className="text-sm text-muted-foreground">Water-only marine routes — every leg stays off land, clear of restricted zones.</p>

      <div className="mt-6 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">WORKFLOW</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {["Start", "Destination", "Vessel", "Analyze", "Generate", "Compare", "Select"].map((s, i) => (
                <Badge key={s} variant={i <= 4 ? "default" : "secondary"} className="rounded-full">{i + 1}. {s}</Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="space-y-1">
                <Label>Start harbour / location</Label>
                <Input value={start} onChange={e => setStart(e.target.value)} placeholder="Mumbai Harbour, PFZ-001, or lat,lng" />
              </div>
              <div className="space-y-1">
                <Label>Destination — harbour or PFZ</Label>
                <Input value={dest} onChange={e => setDest(e.target.value)} placeholder="Alibaug" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Departure</Label>
                  <Input value={depart} onChange={e => setDepart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Safety preference</Label>
                  <Select value={safety} onValueChange={v => v && changeSafety(v as "normal" | "cautious")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="cautious">Cautious</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Vessel type</Label>
                <Select value={vessel} onValueChange={v => v && changeVessel(v as VesselSpec["type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small craft • 12 kts • min 5 m</SelectItem>
                    <SelectItem value="trawler">Trawler • 9 kts • min 8 m</SelectItem>
                    <SelectItem value="research">Research vessel • 15 kts • min 10 m</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => analyze()} disabled={analyzing}>
                {analyzing ? "Geocoding + planning water route…" : "Analyze conditions & generate routes"}
              </Button>
              {error && <div className="text-xs text-center text-destructive">{error}</div>}
              {!generated && !error && <div className="text-xs text-muted-foreground text-center">Water-only routing • shore + MPA checked • live weather exposure</div>}
            </CardContent>
          </Card>

          {generated && direct && safe && (
            <div className="space-y-3">
              {([direct, safe] as WaterRoute[]).map(r => {
                const active = selectedRoute === r.id;
                return (
                  <Card key={r.id} className={`cursor-pointer transition-colors p-4 ${active ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setSelectedRoute(r.id)}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{r.name}</span>
                      <Badge variant="outline" className="text-[10px]">Demo water route</Badge>
                      <Badge variant="outline" className="ml-auto" style={{ background: r.risk === "Low" ? "#35C98A" : r.risk === "Medium" ? "#F4B942" : "#FF6B6B", color: "#071014", borderColor: "transparent" }}>{r.risk}</Badge>
                    </div>
                    <div className="text-xs mt-1 opacity-80">{r.distanceKm} km • {fmtTime(r.durationMin)} • ⛽ ~{r.fuelL} L • min depth {r.minDepthM} m</div>
                    <div className="text-xs mt-1 opacity-80">
                      {r.waterOk ? "✓ all legs on water" : "⚠ some legs near shore"} • {r.recommendation}
                      {r.mpaConflicts.length ? ` • ⚠ ${r.mpaConflicts.join("; ")}` : ""}
                    </div>
                    {r.id === "safe" && <div className="text-xs mt-1.5 opacity-70 italic">{r.explanation}</div>}
                  </Card>
                );
              })}
              <Card className="p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Risk rules: </span>
                {shown?.thresholds.length ? shown.thresholds.join(" • ") : "all factors within vessel limits"}
              </Card>
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-4">
          <MarineMap
            height={420}
            route={shown ? { coords: shown.coords, color: "#35C98A" } : null}
            routeAlt={other ? { coords: other.coords, color: "#F4B942", dash: true } : null}
            fit={fit}
            animateRoute={anim}
          />

          {generated && shown && (shown.mpaConflicts.length > 0 || !shown.waterOk) && (
            <Card className="p-3 border-[#F4B942]/30 bg-[#F4B942]/5 text-xs flex items-start gap-2">
              <span className="text-base">⚠</span>
              <div>
                <span className="font-semibold">Geofence alert — </span>
                {!shown.waterOk && <span>route approaches the shore. </span>}
                {shown.mpaConflicts.length > 0 && <span>{shown.mpaConflicts.join("; ")}. </span>}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">ROUTE COMPARISON</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <Card className="p-3 bg-muted"><div className="text-muted-foreground">Distance</div><div className="text-sm font-semibold mt-1">{generated && direct && safe ? `Direct ${direct.distanceKm} vs Safe ${safe.distanceKm} km` : "Run analysis"}</div></Card>
                <Card className="p-3 bg-muted"><div className="text-muted-foreground">Time / fuel</div><div className="text-sm font-semibold mt-1">{shown ? `${fmtTime(shown.durationMin)} • ~${shown.fuelL} L` : "—"}</div></Card>
                <Card className="p-3 bg-muted"><div className="text-muted-foreground">Weather exposure (live)</div><div className="text-sm font-semibold mt-1">{liveWx ? `Wind ${liveWx.windKts} kts • Wave ${liveWx.waveM.toFixed(1)}m` : "Loading…"}</div></Card>
                <Card className="p-3 bg-muted"><div className="text-muted-foreground">Route risk</div><div className="text-sm font-semibold mt-1">{shown ? `${shown.risk} — ${shown.recommendation}` : "—"}</div></Card>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button size="sm" disabled={!shown} onClick={() => shown && setAnim({ coords: shown.coords, nonce: Date.now() })}>▶ Animate route</Button>
                <Button size="sm" variant="outline" onClick={() => router.push("/assistant")}>Ask AI about route</Button>
                {from && to && <span className="text-xs text-muted-foreground ml-auto">{from.name} → {to.name}</span>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
