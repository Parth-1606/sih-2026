"use client";
import { useEffect, useState } from "react";
import { alerts as mockAlerts } from "@/lib/mock";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { fetchAnomalies, type AnomalyResult } from "@/lib/orca-api";

const FILTERS = ["all", "cyclone", "lightning", "high_waves", "strong_wind", "geofence", "fishing_advisory"] as const;
type F = typeof FILTERS[number];

export default function AlertsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<F>("all");
  const [read, setRead] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [realAnomalies, setRealAnomalies] = useState<AnomalyResult[]>([]);

  useEffect(() => {
    fetchAnomalies(false)
      .then(setRealAnomalies)
      .catch(() => setRealAnomalies([]));
  }, []);
  const filtered = mockAlerts.filter(a => filter === "all" ? true : a.type === filter);
  const critical = mockAlerts.filter(a => a.severity === "danger").length;
  const warning = mockAlerts.filter(a => a.severity === "warning").length;
  const info = mockAlerts.filter(a => a.severity === "info").length;

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Marine Alerts</h1>
          <p className="text-sm text-muted-foreground">Cyclone, lightning, wave, wind and advisory — filtered, actionable.</p>
        </div>
        <Button onClick={() => router.push("/map")}>View on map</Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6 max-w-[520px]">
        <Card className="text-center p-4"><div className="text-2xl font-semibold">{critical + realAnomalies.length}</div><div className="text-xs tracking-[0.08em] font-semibold text-muted-foreground">CRITICAL / ANOMALIES</div></Card>
        <Card className="text-center p-4 border-[#F4B942]/20"><div className="text-2xl font-semibold text-[#F4B942]">{warning}</div><div className="text-xs tracking-[0.08em] font-semibold text-muted-foreground">WARNING</div></Card>
        <Card className="text-center p-4 border-[#4BA3FF]/20"><div className="text-2xl font-semibold text-[#4BA3FF]">{info}</div><div className="text-xs tracking-[0.08em] font-semibold text-muted-foreground">INFORMATION</div></Card>
      </div>

      {/* Real ORCA Ocean Anomalies */}
      {realAnomalies.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase flex items-center gap-2">
              <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
              ORCA Statistical Anomalies ({realAnomalies.length} Flagged)
            </div>
            <Button size="xs" variant="outline" onClick={() => router.push("/")}>
              Open Multi-Agent Dashboard →
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {realAnomalies.map(anom => (
              <Card key={anom.id} className="p-4 border-rose-500/30 bg-rose-500/5 cursor-pointer hover:ring-1 hover:ring-rose-500/40 transition-all" onClick={() => router.push("/")}>
                <div className="flex items-center justify-between">
                  <Badge className="bg-rose-500/20 text-rose-400 font-bold uppercase text-[10px]">
                    {anom.severity} • {anom.parameter.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs">
                    +{anom.z_score?.toFixed(2)}σ
                  </Badge>
                </div>
                <div className="font-semibold text-base mt-2">{anom.location.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                  Observed: {anom.value}{anom.unit} (Baseline: {anom.baseline_mean?.toFixed(1)}{anom.unit})
                </div>
                <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-rose-500/10">
                  <span className="text-muted-foreground">Status: {anom.investigation_status?.toUpperCase() ?? "NEW"}</span>
                  <span className="text-[#4BA3FF] font-medium">Investigate with Agents →</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-2 overflow-auto">
        {FILTERS.map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" className="rounded-full capitalize whitespace-nowrap" onClick={() => setFilter(f)}>{f.replace("_", " ")}</Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="mt-8 p-12 text-center"><CardContent>No marine information is available for this area.</CardContent></Card>
      ) : (
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          {filtered.map(a => (
            <Card key={a.id} className={a.severity === "warning" ? "bg-[#F4B942]/10 border-[#F4B942]/20" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.08em]">
                  <span className={`size-2 rounded-full ${a.severity === "warning" ? "bg-[#F4B942]" : a.severity === "info" ? "bg-[#4BA3FF]" : "bg-destructive"}`} />
                  {a.severity.toUpperCase()} • {a.type.toUpperCase().replace("_", " ")}
                  <Badge variant="outline" className="ml-auto text-[11px]">{read.has(a.id) ? "Read" : "New"}</Badge>
                </div>
                <CardTitle className="text-base">{a.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{a.location} • Issued {a.issued_at} • Until {a.valid_until}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm leading-5">{a.description}</p>
                <p className="text-xs text-muted-foreground">Source: {a.source}</p>
                <Badge variant="secondary" className="rounded-full">Recommended: {a.severity === "warning" ? "Avoid offshore post-noon" : "Favourable — proceed"}</Badge>
                <Separator />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => router.push("/map")}>View on map</Button>
                  <Button size="sm" variant="outline" onClick={() => setRead(s => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })}>{read.has(a.id) ? "Mark unread" : "Mark read"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(selected === a.id ? null : a.id)}>{selected === a.id ? "Hide" : "Details"}</Button>
                </div>
                {selected === a.id && (
                  <Card className="bg-muted p-3 text-xs leading-5 text-muted-foreground">Valid until {a.valid_until} • Issued {a.issued_at} • Location {a.location} • Risk level {a.severity}. Evidence: INCOIS ingest 06:00 IST.</Card>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
