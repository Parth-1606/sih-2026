"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import MarineMap from "@/components/MarineMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RoutesPage() {
  const router = useRouter();
  const [start, setStart] = useState("My Location (18.52,73.85)");
  const [dest, setDest] = useState("PFZ-001 • 18.4 km NE");
  const [vessel, setVessel] = useState("small");
  const [depart, setDepart] = useState("Tomorrow 06:00");
  const [generated, setGenerated] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<"recommended" | "shortest">("recommended");

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
              <Button className="w-full" onClick={() => setGenerated(true)}>Analyze conditions & generate routes</Button>
              {!generated && <div className="text-xs text-muted-foreground text-center">Mock route generation — no backend required</div>}
            </CardContent>
          </Card>

          {generated && (
            <div className="space-y-3">
              {[
                { id: "recommended", name: "Recommended Route", risk: "LOW", distance: "42 km", time: "2h 18m", reason: "Avoids forecast high-wave region.", color: "#35C98A" },
                { id: "shortest", name: "Shortest Route", risk: "MEDIUM", distance: "36 km", time: "1h 56m", reason: "Crosses an area with deteriorating sea conditions.", color: "#F4B942" },
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
              <Card className="p-3 text-xs text-muted-foreground">Weather overlay + risk segments visualized on map • Comparison: recommended saves 0.6m wave exposure.</Card>
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="relative">
            <MarineMap height={420} />
            {generated && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 420">
                {selectedRoute === "recommended" ? (
                  <path d="M 380 210 Q 420 140 500 150 T 620 190" fill="none" stroke="#35C98A" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 6" />
                ) : (
                  <path d="M 380 210 L 620 190" fill="none" stroke="#F4B942" strokeWidth="3" strokeLinecap="round" />
                )}
              </svg>
            )}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">ROUTE COMPARISON</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Card className="p-3 bg-muted"><div className="text-muted-foreground">Distance</div><div className="text-sm font-semibold mt-1">Recommended 42 km vs Shortest 36 km</div></Card>
                <Card className="p-3 bg-muted"><div className="text-muted-foreground">Risk segments</div><div className="text-sm font-semibold mt-1"><span className="text-[#35C98A]">LOW</span> vs <span className="text-[#F4B942]">MEDIUM</span></div></Card>
                <Card className="p-3 bg-muted"><div className="text-muted-foreground">Weather overlay</div><div className="text-sm font-semibold mt-1">Wind 14→22 kts • Wave 0.8→1.8m</div></Card>
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
