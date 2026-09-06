"use client";
import { useEffect, useState } from "react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DataBadge from "@/components/DataBadge";
import type { DataMode } from "@/lib/marine/schema";
import { fetchHourlySeries } from "@/lib/marine-api";
import { demoTideSeries } from "@/lib/marine/fixtures";

interface Pt {
  date: string;
  value: number;
}

interface SeriesState {
  data: Pt[];
  mode: DataMode;
  source: string;
  stamp: string;
}

const EMPTY: SeriesState = { data: [], mode: "unavailable", source: "", stamp: "" };

const shortTime = (iso: string) => {
  const d = new Date(iso.includes("+") || iso.endsWith("Z") ? iso : iso + "+05:30");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + " " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
};

export default function AnalyticsPage() {
  const [location, setLocation] = useState("Mumbai Harbour");
  const [range, setRange] = useState("48 hours");
  const [sst, setSst] = useState<SeriesState>(EMPTY);
  const [wave, setWave] = useState<SeriesState>(EMPTY);
  const [wind, setWind] = useState<SeriesState>(EMPTY);
  const [chl, setChl] = useState<SeriesState>(EMPTY);
  // Demo fixtures are static — initialise as state, not in an effect.
  const [tide] = useState<SeriesState>(() => {
    const tideS = demoTideSeries();
    return {
      data: tideS.map(p => ({ date: shortTime(p.time).slice(6), value: p.heightM })),
      mode: "demo" as const, source: "Demo tide curve (harmonic-style, simulated)", stamp: "simulated",
    };
  });
  const [current] = useState<SeriesState>(() => {
    const tideS = demoTideSeries();
    return {
      data: tideS.map((p, i) => ({ date: shortTime(p.time).slice(6), value: Math.round((0.3 + 0.15 * Math.sin(i / 2.4)) * 100) / 100 })),
      mode: "demo" as const, source: "Demo current curve (simulated)", stamp: "simulated",
    };
  });
  const [prod, setProd] = useState<SeriesState>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    // Live model series (Open-Meteo marine + forecast).
    fetchHourlySeries(48)
      .then(h => {
        if (cancelled) return;
        const stamp = `observed ${shortTime(h.time[0])} IST`;
        const src = "Open-Meteo Marine + Forecast";
        setSst({ data: h.time.map((t, i) => ({ date: shortTime(t).slice(6), value: h.sstC[i] })), mode: "live", source: src, stamp });
        setWave({ data: h.time.map((t, i) => ({ date: shortTime(t).slice(6), value: h.waveM[i] })), mode: "live", source: src, stamp });
        setWind({ data: h.time.map((t, i) => ({ date: shortTime(t).slice(6), value: h.windKn[i] })), mode: "forecast", source: src, stamp });
      })
      .catch(() => {});
    // Live satellite chlorophyll daily means.
    fetch("/api/ocean/chlorophyll?lat=18.7&lng=72.4&series=daily")
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (cancelled || !j?.daily?.length) return;
        setChl({
          data: j.daily,
          mode: "live",
          source: "NASA MODIS-Aqua via ERDDAP",
          stamp: `window ending ${String(j.windowEnd).slice(0, 10)}`,
        });
        // Productivity proxy: normalized bloom index 0-100 from chl series.
        const vals = (j.daily as Pt[]).map(d => d.value);
        const mx = Math.max(...vals, 0.01);
        setProd({
          data: (j.daily as Pt[]).map(d => ({ date: d.date, value: Math.round(Math.min(100, (d.value / mx) * 100)) })),
          mode: "live",
          source: "Derived from MODIS-Aqua chlorophyll (method: bloom-index)",
          stamp: `window ending ${String(j.windowEnd).slice(0, 10)}`,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Marine Analytics</h1>
          <p className="text-sm text-muted-foreground">SST, chlorophyll, waves, wind, tides, currents, productivity — every chart states its source and freshness</p>
        </div>
        <div className="flex gap-2">
          <Select value={location} onValueChange={v => v && setLocation(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Mumbai Harbour">Mumbai Harbour</SelectItem>
              <SelectItem value="PFZ-001">PFZ-001</SelectItem>
              <SelectItem value="PFZ-002">PFZ-002</SelectItem>
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={v => v && setRange(v)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="21 days">21 days</SelectItem>
              <SelectItem value="48 hours">48 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <ChartCard title="Sea Surface Temperature" unit="°C" s={sst} range="48h hourly" color="#2E9CFF" />
        <ChartCard title="Chlorophyll Concentration" unit=" mg/m³" s={chl} range="21 daily means" color="#4BD58A" />
        <ChartCard title="Wave Height" unit="m" s={wave} range="48h hourly" color="#F2C94C" />
        <ChartCard title="Wind Speed" unit=" kts" s={wind} range="48h hourly" color="#F4B942" />
        <ChartCard title="Tide Height" unit="m" s={tide} range="24h hourly" color="#4BA3FF" />
        <ChartCard title="Surface Current" unit=" m/s" s={current} range="24h hourly" color="#35C98A" />
        <ChartCard title="Productivity / PFZ Confidence" unit=" index" s={prod} range="21 daily" color="#F2C94C" />
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">FILTERS</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-xs">
            {["Location: " + location, "Range: " + range, "Live: Open-Meteo, MODIS-Aqua", "Demo: tide, current curves"].map(f => (
              <Badge key={f} variant="secondary" className="rounded-full">{f}</Badge>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-3">Live charts stream from open APIs; Demo charts are simulated fixtures in the same schema. Nothing simulated is labelled Live.</div>
        </CardContent>
      </Card>
    </div>
  );
}

function ChartCard({ title, s, color, unit, range }: { title: string; s: SeriesState; color: string; unit: string; range: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{s.data.length} pts • {unit.trim()}</Badge>
          <DataBadge mode={s.mode} stamp={s.stamp || undefined} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[180px] mt-2">
          {s.data.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={s.data}>
                <defs>
                  <linearGradient id={`g-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "#62767E", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#62767E", fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={{ background: "#071014", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#F4F7F8" }} />
                <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#g-${title})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              {s.mode === "unavailable" ? "No data — source unreachable" : "Loading…"}
            </div>
          )}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Source: {s.source || "—"} • {range} • hover for values</div>
      </CardContent>
    </Card>
  );
}
