// Ports & harbours: live Overpass (OSM seamarks) with curated fallback.
// PDF §2.3 — OSM coastline/ports backbone for the map UI.
import { NextRequest, NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { CURATED_PORTS } from "@/lib/marine-zones";

export const dynamic = "force-dynamic";

async function livePorts(s: number, w: number, n: number, e: number) {
  const q =
    `[out:json][timeout:20];(node["seamark:type"="harbour"](${s},${w},${n},${e});` +
    `node["amenity"="ferry_terminal"](${s},${w},${n},${e}););out body;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "ORCA-SIH-Prototype/1.0 (research)",
    },
    body: `data=${encodeURIComponent(q)}`,
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const j = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (j.elements ?? []).map((el: any) => ({
    name: el.tags?.name ?? el.tags?.["seamark:name"] ?? "Unnamed harbour",
    lat: el.lat,
    lng: el.lon,
    kind: "minor" as const,
  }));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const s = parseFloat(sp.get("s") ?? "15.5");
  const w = parseFloat(sp.get("w") ?? "72.0");
  const n = parseFloat(sp.get("n") ?? "20.0");
  const e = parseFloat(sp.get("e") ?? "74.5");
  const key = `ports-${s}-${w}-${n}-${e}`;
  try {
    const { data, cached } = await getOrFetch(key, 24 * 3600 * 1000, async () => {
      const live = await livePorts(s, w, n, e);
      if (!live.length) throw new Error("empty overpass result");
      return { ports: live, source: "OpenStreetMap via Overpass API (seamarks + ferry terminals)" };
    });
    return NextResponse.json({ ...data, cached });
  } catch {
    const ports = CURATED_PORTS.filter(p => p.lat >= s && p.lat <= n && p.lng >= w && p.lng <= e);
    return NextResponse.json({
      ports,
      source: "Curated major-port fallback (Overpass unreachable)",
      cached: false,
    });
  }
}
