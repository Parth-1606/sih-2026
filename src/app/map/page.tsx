"use client";
import { useState } from "react";
import MarineMap from "@/components/MarineMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { searchPlaces, type PlaceResult } from "@/lib/marine-api";

export default function MapPage() {
  const [mode, setMode] = useState<"past" | "current" | "forecast">("current");
  const [frame, setFrame] = useState(6);
  const [playing, setPlaying] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  const [focusedName, setFocusedName] = useState<string | null>(null);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const r = await searchPlaces(q);
      setResults(r);
      if (r.length > 0) flyTo(r[0]);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const flyTo = (p: PlaceResult) => {
    setFocus({ lat: p.lat, lng: p.lng, nonce: Date.now() });
    setFocusedName(p.name);
    setResults([]);
    setQuery(p.name);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col lg:flex-row">
      <div className="w-full lg:w-[280px] shrink-0 border-b lg:border-b-0 lg:border-r bg-sidebar text-sidebar-foreground p-4 overflow-auto space-y-4">
        <div>
          <h2 className="font-semibold">Marine Map</h2>
          <p className="text-xs text-muted-foreground">Fullscreen • layer control • timeline</p>
        </div>

        <div className="space-y-4">
          {[
            { title: "Ocean", items: ["SST", "Chlorophyll", "Ocean Productivity"] },
            { title: "Weather", items: ["Wind", "Rainfall", "Lightning", "Cloud Cover"] },
            { title: "Sea State", items: ["Wave Height", "Wave Direction", "Tides"] },
            { title: "Operational", items: ["PFZ", "Geofences", "Protected Areas", "Maritime Boundaries"] },
          ].map(s => (
            <Card key={s.title}>
              <CardHeader className="pb-2"><CardTitle className="text-xs tracking-[0.08em] text-muted-foreground">{s.title.toUpperCase()}</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {s.items.map(it => (
                  <label key={it} className="flex items-center justify-between text-sm cursor-pointer">
                    <span>{it}</span>
                    <input type="checkbox" defaultChecked={it === "PFZ" || it === "SST"} className="accent-primary" />
                  </label>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-xs">Location search {searching && <span className="text-muted-foreground font-normal">• searching…</span>}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder="Search port or coordinates"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") runSearch(query); }}
            />
            {results.length > 0 && (
              <div className="rounded-xl border overflow-hidden">
                {results.map(r => (
                  <button key={`${r.lat},${r.lng}`} onClick={() => flyTo(r)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                    {r.name} <span className="text-muted-foreground text-xs">{r.country} • {r.lat.toFixed(2)}, {r.lng.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
            {focusedName && <Badge variant="secondary" className="w-full justify-start truncate">◎ {focusedName}</Badge>}
            <div className="flex gap-1.5 flex-wrap">
              {["Mumbai", "Kochi", "Chennai", "18.52,73.85"].map(c => (
                <Badge key={c} variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => { setQuery(c); runSearch(c); }}>{c}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <p className="text-[11px] text-muted-foreground p-2">Coordinate display • click any feature for inspector with AI interpretation</p>
      </div>

      <div className="flex-1 flex flex-col min-h-[480px] p-3 gap-3 bg-background">
        <div className="flex-1 min-h-0">
          <MarineMap height="100%" interactive focus={focus} />
        </div>
        <Card className="p-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex p-1 rounded-full bg-muted">
              {(["past", "current", "forecast"] as const).map(m => (
                <Button key={m} variant={mode === m ? "default" : "ghost"} size="sm" className="rounded-full capitalize h-7" onClick={() => setMode(m)}>{m}</Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" onClick={() => setFrame(f => Math.max(0, f - 1))}>‹</Button>
              <Button size="icon-sm" onClick={() => setPlaying(!playing)}>{playing ? "❚❚" : "▶"}</Button>
              <Button variant="outline" size="icon-sm" onClick={() => setFrame(f => Math.min(12, f + 1))}>›</Button>
            </div>
            <input type="range" min={0} max={12} value={frame} onChange={e => setFrame(Number(e.target.value))} className="flex-1 w-full accent-primary" />
            <Badge variant="outline" className="font-mono whitespace-nowrap">{mode} • T{frame}:00 IST</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
