"use client";
import { useEffect, useState } from "react";
import MarineMap from "@/components/MarineMap";
import { pfzData, alerts, forecast } from "@/lib/mock";
import { fetchLiveMarine, type LiveMarine } from "@/lib/marine-api";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export default function OverviewPage() {
  const router = useRouter();
  const [selectedPfz, setSelectedPfz] = useState<string | null>(null);
  const [showSafety, setShowSafety] = useState(false);
  const [live, setLive] = useState<LiveMarine | null>(null);

  // Real-life test: live ocean + weather, mock stays as offline fallback.
  useEffect(() => {
    let cancelled = false;
    fetchLiveMarine()
      .then(d => { if (!cancelled) setLive(d); })
      .catch(() => { /* offline — keep mock values */ });
    return () => { cancelled = true; };
  }, []);

  const sst = live?.sst ?? 28.1;
  const wave = live?.waveHeight ?? 0.8;
  const windKn = live?.windSpeedKn ?? 14;
  const windDir = live?.windCompass ?? "SW";
  const vis = live?.visibilityKm ?? 9.2;
  const forecastRows = live?.forecast ?? forecast;

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      {/* Header — shadcn Badge + Button */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="secondary" className="bg-[#4BA3FF]/15 text-[#4BA3FF] border-[#4BA3FF]/20 tracking-[0.12em] text-[11px]">MARINE INTELLIGENCE</Badge>
          <h1 className="text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] leading-none mt-2">Ocean conditions at a glance</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[560px]">Monitor marine conditions, fishing zones, weather risks and operational intelligence.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:flex gap-1.5 bg-card"><span className={`size-1.5 rounded-full ${live ? "bg-[#35C98A] animate-pulse" : "bg-muted-foreground"}`} /> {live ? `LIVE ${live.time} IST • Open-Meteo` : "Updated 06:00 IST • INCOIS"}</Badge>
          <Button size="sm" className="rounded-full" onClick={() => router.push("/map")}>Open full map →</Button>
        </div>
      </div>

      {/* Metrics — shadcn Card + Badge + Button */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <Card className="relative overflow-hidden p-4 cursor-pointer hover:ring-foreground/20 transition-all" onClick={() => setShowSafety(true)}>
          <div className="absolute top-0 right-0 size-20 bg-[#35C98A]/10 blur-2xl rounded-full pointer-events-none" />
          <div className="text-[11px] tracking-[0.08em] font-semibold text-muted-foreground">MARINE SAFETY</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#35C98A] shadow-[0_0_8px_rgba(53,201,138,0.6)]" />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">LOW RISK</span>
            <Badge variant="outline" className="ml-auto text-[11px]">↗</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Tap for risk breakdown</div>
        </Card>

        <Card className="p-4 cursor-pointer hover:ring-foreground/20 transition-all" onClick={() => document.getElementById("pfz-section")?.scrollIntoView({ behavior: "smooth" })}>
          <div className="text-[11px] tracking-[0.08em] font-semibold text-muted-foreground">NEAREST PFZ</div>
          <div className="mt-2 text-[22px] font-semibold tracking-[-0.02em] leading-none">18.4 <span className="text-sm font-normal text-muted-foreground">km</span></div>
          <div className="text-xs text-[#F2C94C] mt-1">↗ NE of current location</div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] tracking-[0.08em] font-semibold text-muted-foreground">SEA SURFACE TEMPERATURE {live && <span className="text-[#35C98A]">• LIVE</span>}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[22px] font-semibold tracking-[-0.02em]">{sst.toFixed(1)}°C</span>
            <Badge className="bg-[#35C98A]/15 text-[#35C98A] border-[#35C98A]/20">+0.4°C</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Stable • favorable for PFZ</div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] tracking-[0.08em] font-semibold text-muted-foreground">WAVE HEIGHT {live && <span className="text-[#35C98A]">• LIVE</span>}</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[22px] font-semibold tracking-[-0.02em]">{wave.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">m</span></span>
            <span className="size-2 rounded-full bg-[#35C98A]" />
          </div>
          <div className="text-xs text-muted-foreground mt-1">Low • safe for small craft</div>
        </Card>
      </div>

      {/* Main grid: map + brief — shadcn Card */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        <div className="col-span-12 lg:col-span-8">
          <MarineMap height={520} onSelectPFZ={setSelectedPfz} />
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="gap-1 bg-[#F2C94C]/10 text-[#F2C94C] border-[#F2C94C]/20"><span className="size-2 rounded-full bg-[#F2C94C]" /> PFZ</Badge>
            <Badge variant="outline" className="gap-1 bg-[#F4B942]/10 text-[#F4B942] border-[#F4B942]/20"><span className="size-2 rounded-full bg-[#F4B942]" /> Alert</Badge>
            <Badge variant="outline" className="gap-1 bg-[#4BA3FF]/10 text-[#4BA3FF] border-[#4BA3FF]/20"><span className="size-2 rounded-full bg-[#4BA3FF]" /> You</Badge>
            <span className="ml-auto hidden sm:inline text-xs">Click PFZ or alert for inspector • Drag to pan • Scroll to zoom</span>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><span className="size-1.5 bg-[#4BA3FF] rounded-full animate-pulse" /> AI Marine Brief</CardTitle>
              <Badge variant="secondary">LIVE</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl bg-[#35C98A]/10 border border-[#35C98A]/15 p-3">
                <div className="text-xs font-semibold text-[#35C98A] flex items-center gap-1.5"><span className="size-1.5 bg-[#35C98A] rounded-full" /> Current assessment</div>
                <div className="text-[13px] leading-5 mt-1">Conditions are currently favourable for nearshore fishing. Wave {wave.toFixed(1)}m, wind {windDir} {windKn} kts.</div>
              </div>
              <div className="rounded-xl bg-background border p-3">
                <div className="text-xs font-semibold text-muted-foreground">Key observation</div>
                <div className="text-[13px] leading-5 mt-1">A high-productivity zone has been detected <span className="text-[#F2C94C] font-medium">northeast</span> of your current position — 18.4 km, confidence 91%.</div>
              </div>
              <div className="rounded-xl bg-[#F4B942]/10 border border-[#F4B942]/20 p-3">
                <div className="text-xs font-semibold text-[#F4B942]">Upcoming change</div>
                <div className="text-[13px] leading-5 mt-1">Wind intensity is expected to increase later today — advisory valid until 18:00.</div>
              </div>
              <Button className="w-full" onClick={() => router.push("/assistant?q=Explain%20today%27s%20marine%20conditions%20for%20my%20location")}>Ask AI about these conditions →</Button>
              <div className="text-[11px] text-center text-muted-foreground">Evidence • INCOIS PFZ 06:00 IST • Confidence 91%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">CURRENT CONDITIONS</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-background border rounded-xl p-3"><div className="text-[11px] text-muted-foreground">Wind</div><div className="font-semibold">{windKn} kts <span className="font-normal text-muted-foreground">{windDir}</span></div></div>
              <div className="bg-background border rounded-xl p-3"><div className="text-[11px] text-muted-foreground">Visibility</div><div className="font-semibold">{vis.toFixed(1)} km</div></div>
              <div className="bg-background border rounded-xl p-3"><div className="text-[11px] text-muted-foreground">Tide</div><div className="font-semibold">↗ Rising</div></div>
              <div className="bg-background border rounded-xl p-3"><div className="text-[11px] text-muted-foreground">Chlorophyll</div><div className="font-semibold">0.74 mg/m³</div></div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lower sections — shadcn Tabs */}
      <Tabs defaultValue="conditions" className="mt-6">
        <TabsList>
          <TabsTrigger value="conditions">Marine Conditions</TabsTrigger>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="pfz">PFZ Recommendations</TabsTrigger>
          <TabsTrigger value="forecast">48h Forecast</TabsTrigger>
        </TabsList>
        <TabsContent value="conditions" className="mt-4">
          <div className="grid md:grid-cols-3 gap-3">
            <ConditionCard label="Sea Surface Temp" value={`${sst.toFixed(1)}°C`} sub="+0.4°C • Warm" trend="up" />
            <ConditionCard label="Chlorophyll" value="0.74 mg/m³" sub="Productive" trend="stable" />
            <ConditionCard label="Wave Height" value={`${wave.toFixed(1)} m`} sub="Low • Favourable" trend="down" />
          </div>
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <div className="grid md:grid-cols-2 gap-3">
            {alerts.slice(0, 2).map(a => (
              <Card key={a.id} className="p-4 hover:ring-foreground/10 transition-all cursor-pointer" onClick={() => router.push("/alerts")}>
                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em]">
                  <span className={`size-2 rounded-full ${a.severity === "warning" ? "bg-[#F4B942]" : "bg-[#4BA3FF]"}`} /> {a.type.replace("_", " ").toUpperCase()} • {a.valid_until}
                </div>
                <div className="font-medium mt-1">{a.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{a.location} — {a.description}</div>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="pfz" className="mt-4">
          <div id="pfz-section" className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pfzData.map(p => (
              <Card key={p.id} className={`p-4 transition-colors ${selectedPfz === p.id ? "bg-primary text-primary-foreground" : ""}`}>
                <div className="flex items-center justify-between">
                  <Badge variant={selectedPfz === p.id ? "secondary" : "default"} className={selectedPfz === p.id ? "bg-background text-foreground" : "bg-[#F2C94C] text-[#071014]"}>{p.id}</Badge>
                  <span className={`text-xs font-medium ${selectedPfz === p.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{p.confidence}% confidence</span>
                </div>
                <div className="mt-3 text-sm"><span className="font-semibold">{p.distance_km} km</span> <span className="text-muted-foreground">↗ {p.direction}</span> • <span className={p.productivity === "HIGH" ? "text-[#35C98A]" : "text-[#F4B942]"}>{p.productivity}</span></div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-background/50 rounded-xl p-2 border"><div className="text-muted-foreground text-[11px]">SST</div><div className="font-medium">{p.sst}°C</div></div>
                  <div className="bg-background/50 rounded-xl p-2 border"><div className="text-muted-foreground text-[11px]">Chlorophyll</div><div className="font-medium">{p.chlorophyll}</div></div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="flex-1" variant={selectedPfz === p.id ? "secondary" : "default"} onClick={() => setSelectedPfz(p.id)}>Show on map</Button>
                  <Button size="sm" variant="outline" onClick={() => router.push(`/assistant?q=Tell%20me%20about%20${p.id}`)}>Ask AI</Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="forecast" className="mt-4">
          <Card className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {forecastRows.map(f => (
                <div key={f.day} className="rounded-xl bg-background border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">{f.day.toUpperCase()}</div>
                  <div className="mt-2 flex items-center gap-2"><span className={`size-2 rounded-full ${f.risk === "LOW" ? "bg-[#35C98A]" : "bg-[#F4B942]"}`} /><Badge variant="outline" className="text-xs">{f.risk}</Badge></div>
                  <div className="text-sm mt-2">Wind {f.wind} kts • Wave {f.wave}m</div>
                  <div className="text-xs text-muted-foreground">SST {f.sst}°C</div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-6 p-4">
        <CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">RECENT ACTIVITY</CardTitle>
        <CardContent className="p-0 pt-3 space-y-2 text-sm">
          <div className="flex gap-3"><span className="text-muted-foreground text-xs mt-0.5">06:00</span><span>PFZ advisory updated — <Badge variant="secondary" className="bg-[#F2C94C]/20 text-[#F2C94C] border-[#F2C94C]/20 ml-1">PFZ-001 HIGH</Badge> confidence 91%</span></div>
          <Separator />
          <div className="flex gap-3"><span className="text-muted-foreground text-xs mt-0.5">05:30</span><span>INCOIS SST ingest • 28.1°C</span></div>
          <div className="flex gap-3"><span className="text-muted-foreground text-xs mt-0.5">04:00</span><span>Wave forecast issued — 0.8m nearshore</span></div>
        </CardContent>
      </Card>

      {/* Safety — shadcn Dialog */}
      <Dialog open={showSafety} onOpenChange={setShowSafety}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="size-10 rounded-full bg-[#35C98A]/15 border border-[#35C98A]/20 flex items-center justify-center text-[#35C98A]">✓</span>
              Risk Score — 24 / 100
            </DialogTitle>
            <DialogDescription>SAFE • Nearshore favourable</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm py-2">
            <div className="flex justify-between bg-muted border rounded-xl p-3"><span>Wave</span><Badge variant="secondary" className="bg-[#35C98A]/15 text-[#35C98A]">{wave.toFixed(1)}m • Low</Badge></div>
            <div className="flex justify-between bg-muted border rounded-xl p-3"><span>Wind</span><Badge variant="secondary" className="bg-[#35C98A]/15 text-[#35C98A]">{windKn} kts • Moderate</Badge></div>
            <div className="flex justify-between bg-muted border rounded-xl p-3"><span>Visibility</span><Badge variant="secondary" className="bg-[#35C98A]/15 text-[#35C98A]">{vis.toFixed(1)} km</Badge></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConditionCard({ label, value, sub, trend }: { label: string; value: string; sub: string; trend: "up" | "down" | "stable" }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] tracking-[0.08em] font-semibold text-muted-foreground">{label.toUpperCase()}</div>
      <div className="mt-2 flex items-baseline gap-2"><span className="text-xl font-semibold">{value}</span>{trend === "up" && <Badge variant="secondary" className="bg-[#F4B942]/15 text-[#F4B942]">↗</Badge>}{trend === "down" && <Badge variant="secondary" className="bg-[#35C98A]/15 text-[#35C98A]">↘</Badge>}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-[#4BA3FF] w-[68%]" /></div>
    </Card>
  );
}
