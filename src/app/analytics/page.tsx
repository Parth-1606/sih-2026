"use client";
import { useState } from "react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { sstHistory, chlHistory, waveForecast, windForecast } from "@/lib/mock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AnalyticsPage() {
  const [location, setLocation] = useState("Current Location");
  const [range, setRange] = useState("30 days");

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Marine Analytics</h1>
          <p className="text-sm text-muted-foreground">SST, chlorophyll, wave and wind — 30d history + 48h forecast</p>
        </div>
        <div className="flex gap-2">
          <Select value={location} onValueChange={v => v && setLocation(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Current Location">Current Location</SelectItem>
              <SelectItem value="PFZ-001">PFZ-001</SelectItem>
              <SelectItem value="PFZ-002">PFZ-002</SelectItem>
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={v => v && setRange(v)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30 days">30 days</SelectItem>
              <SelectItem value="7 days">7 days</SelectItem>
              <SelectItem value="48 hours">48 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <ChartCard title="Sea Surface Temperature" unit="°C" data={sstHistory} color="#2E9CFF" />
        <ChartCard title="Chlorophyll Concentration" unit=" mg/m³" data={chlHistory} color="#4BD58A" />
        <ChartCard title="Wave Height Forecast" unit="m" data={waveForecast.map(d => ({ date: d.h, value: d.v }))} color="#F2C94C" />
        <ChartCard title="Wind Forecast" unit=" kts" data={windForecast.map(d => ({ date: d.h, value: d.v }))} color="#F4B942" />
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">FILTERS</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-xs">
            {["Location: " + location, "Date: " + range, "Source: INCOIS", "Layer: SST"].map(f => (
              <Badge key={f} variant="secondary" className="rounded-full">{f}</Badge>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-3">Charts ready for API integration — TypeScript interfaces defined for all marine entities.</div>
        </CardContent>
      </Card>
    </div>
  );
}

function ChartCard({ title, data, color, unit }: { title: string; data: { date: string; value: number }[]; color: string; unit: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Badge variant="outline">{data.length} points • {unit.trim()}</Badge>
      </CardHeader>
      <CardContent>
        <div className="h-[180px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`g-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: "#62767E", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "#62767E", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: "#071014", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#F4F7F8" }} />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#g-${title})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Source: mock with api-ready interfaces • hover for values</div>
      </CardContent>
    </Card>
  );
}
