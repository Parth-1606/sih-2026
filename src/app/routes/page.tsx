"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MarineMap from "@/components/MarineMap";
import type { FitBox } from "@/components/LeafletBase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { boundsOf, fetchRoadRoute, geodesicRoute, resolvePlace, type RoutePoint, type RouteResult } from "@/lib/routing";
import { fetchLiveMarine } from "@/lib/marine-api";

const VESSEL_KTS: Record<string, number> = { small: 12, trawler: 9, research: 15 };

export default function RoutesPage() {
  const router = useRouter();
  const [start, setStart] = useState("My Location (18.52,73.85)");
  const [dest, setDest] = useState("mumbai");
  const [vessel, setVessel] = useState("small");
  const [depart, setDepart] = useState("Tomorrow 06:00");
  const [generated, setGenerated] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startPt, setStartPt] = useState<RoutePoint | null>(null);
  const [endPt, setEndPt] = useState<RoutePoint | null>(null);
  const [rec, setRec] = useState<RouteResult | null>(null);
  const [short, setShort] = useState<RouteResult | null>(null);
  const [fit, setFit] = useState<FitBox | null>(null);
  const [liveWx, setLiveWx] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<"recommended" | "shortest">("recommended");

  useEffect(() => {
    let cancelled = false;
    fetchLiveMarine()
      .then(m => { if (!cancelled) setLiveWx(`Wind ${m.windSpeedKn} kts ${m.windCompass} • Wave ${m.waveHeight.toFixed(1)}m`); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const analyze = async () => {
    setAnalyzing(true);
    setError(null);
    setGenerated(false);
    try {
      const [a, b] = await Promise.all([resolvePlace(start), resolvePlace(dest)]);
      setStartPt(a);
      setEndPt(b);
      let recommended: RouteResult;
      try {
        recommended = await fetchRoadRoute(a, b);
      } catch {
        recommended = geodesicRoute(a, b, VESSEL_KTS[vessel] ?? 12);
      }
      const shortest = geodesicRoute(a, b, VESSEL_KTS[vessel] ?? 12);
      setRec(recommended);
      setShort(shortest);
      setFit({ ...boundsOf(recommended.coords), nonce: Date.now() });
      setGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Route analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const shown = selectedRoute === "recommended" ? rec : short;
  const other = selectedRoute === "recommended" ? short : rec;

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Safe Route Planner</h1>
      <p className="text-sm text-muted-foreground">Select start, destination, vessel and depart time — compare risk-aware routes.</p>

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
                <Label>Start — map or location</Label>
                <Input value={start} onChange={e => setStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Destination — map or location</Label>
                <Input value={dest} onChange={e => setDest(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Departure time</Label>
                <Input value={depart} onChange={e => setDepart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Vessel type</Label>
                <Select value={vessel} onValueChange={v => v && setVessel(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small craft • 12 kts</SelectItem>
                    <SelectItem value="trawler">Trawler • 9 kts</SelectItem>
                    <SelectItem value="research">Research vessel • 15 kts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fuel constraint</Label>
                <Input placeholder="Optional — max km or litres" />
              </div>
              <Button className="w-full" onClick={analyze} disabled={analyzing}>{analyzing ? "Geocoding + routing…" : "Analyze conditions & generate routes"}</Button>
              {error && <div className="text-xs text-center text-destructive">{error}</div>}
              {!generated && !error && <div className="text-xs text-muted-foreground text-center">Geocodes both ends • OSRM road geometry • live weather overlay</div>}
            </CardContent>
          </Card>

          {generated && rec && short && (
            <div className="space-y-3">
              {[
                { id: "recommended", name: "Recommended Route", risk: rec.source.startsWith("OSRM") ? "LOW" : "MEDIUM", distance: `${rec.distanceKm} km`, time: `${Math.floor(rec.durationMin / 60)}h ${rec.durationMin % 60}m`, reason: rec.source, color: "#35C98A" },
                { id: "shortest", name: "Shortest Route", risk: "MEDIUM", distance: `${short.distanceKm} km`, time: `${Math.floor(short.durationMin / 60)}h ${short.durationMin % 60}m`, reason: "Direct geodesic line — ignores roads, coast and hazards.", color: "#F4B942" },
              ].map(r => (
                <Card key={r.id} className={`cursor-pointer transition-colors p-4 ${selectedRoute === r.id ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setSelectedRoute(r.id as "recommended" | "shortest")}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{r.name}</span>
                    <Badge variant="outline" className="ml-auto" style={{ background: r.color, color: "#071014", borderColor: r.color }}>{r.risk}</Badge>
                  </div>
                  <div className="text-xs mt-1 opacity-70">{r.distance} • {r.time} • {r.reason}</div>
                  <div className="mt-2 flex gap-1.5">
                    <span className={`h-1.5 flex-1 rounded-full ${r.id === "recommended" ? "bg-[#35C98A]" : "bg-[#F4B942]/60"}`} />
                    <span className={`h-1.5 flex-1 rounded-full ${r.id === "recommended" ? "bg-[#35C98A]" : "bg-[#F4B942]"}`} />
                    <span className={`h-1.5 flex-1 rounded-full ${r.id === "recommended" ? "bg-[#35C98A]/30" : "bg-[#F4B942]"}`} />
                  </div>
                </Card>
              ))}
              <Card className="p-3 text-xs">
                <div className="font-semibold mb-1.5">Turn-by-turn — {selectedRoute === "recommended" ? "Recommended" : "Shortest"} ({shown?.steps.length} steps)</div>
                <div className="space-y-1 max-h-56 overflow-auto">
                  {shown?.steps.slice(0, 25).map((s, i) => (
                    <div key={i} className="flex gap-2 text-muted-foreground"><span className="font-mono shrink-0">{i + 1}.</span><span className="flex-1">{s.instruction}</span><span className="font-mono shrink-0">{s.distanceKm} km</span></div>
                  ))}
                  {(shown?.steps.length ?? 0) > 25 && <div className="text-muted-foreground">…{(shown?.steps.length ?? 0) - 25} more steps</div>}
                </div>
              </Card>
              <Card className="p-3 text-xs text-muted-foreground">Route comparison: recommended follows the road network ({rec.source}); shortest is a straight line. {startPt && endPt ? `${startPt.name} → ${endPt.name}` : ""}</Card>
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-4">
          <MarineMap
            height={420}
            route={selectedRoute === "recommended" ? (rec ? { coords: rec.coords, color: "#35C98A" } : null) : (short ? { coords: short.coords, color: "#35C98A" } : null)}
            routeAlt={other ? { coords: other.coords, color: "#F4B942", dash: true } : null}
            fit={fit}
          />

          <Card>
            <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">ROUTE COMPARISON</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Card className="p-3 bg-muted"><div className="text-muted-foreground">Distance</div><div className="text-sm font-semibold mt-1">{generated && rec && short ? `Recommended ${rec.distanceKm} km vs Shortest ${short.distanceKm} km` : "Run analysis to compare"}</div></Card>
                <Card className="p-3 bg-muted"><div className="text-muted-foreground">Time</div><div className="text-sm font-semibold mt-1">{generated && rec && short ? `${Math.floor(rec.durationMin / 60)}h ${rec.durationMin % 60}m vs ${Math.floor(short.durationMin / 60)}h ${short.durationMin % 60}m` : "—"}</div></Card>
                <Card className="p-3 bg-muted"><div className="text-muted-foreground">Weather overlay (live)</div><div className="text-sm font-semibold mt-1">{liveWx ?? "Loading…"}</div></Card>
              </div>
              <div className="flex gap-2">
                <Button size="sm">Select route</Button>
                <Button size="sm" variant="outline" onClick={() => router.push("/assistant")}>Ask AI about route</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
