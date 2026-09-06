// NASA MODIS-Aqua chlorophyll-a (OBPG R2022, via NOAA CoastWatch ERDDAP).
// No login required. Science-quality lags ~3 months and monsoon clouds wipe
// out single days, so we average a 21-day window over a small bbox.
import { NextRequest, NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";

export const dynamic = "force-dynamic";

const ERDDAP = "https://coastwatch.pfeg.noaa.gov/erddap/griddap/erdMH1chla1day_R2022SQ.json";

async function erddapJSON(query: string) {
  const res = await fetch(`${ERDDAP}?${query}`, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`ERDDAP HTTP ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "18.7");
  const lng = parseFloat(sp.get("lng") ?? "72.4");
  const box = parseFloat(sp.get("box") ?? "0.4");
  if (![lat, lng, box].every(Number.isFinite)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }
  const key = `chla-${lat.toFixed(2)}-${lng.toFixed(2)}-${box}`;
  const series = sp.get("series") === "daily";
  try {
    const { data, cached } = await getOrFetch(key + (series ? "-daily" : ""), 6 * 3600 * 1000, async () => {
      const t = await erddapJSON("time[last]");
      const lastT: string = t.table.rows[0][0];
      const start = new Date(new Date(lastT).getTime() - 21 * 86400 * 1000).toISOString().replace(/\.\d+Z$/, "Z");
      const q =
        `chlor_a[(${start}):1:(${lastT})]` +
        `[(${lat - box}):1:(${lat + box})][(${lng - box}):1:(${lng + box})]`;
      const d = await erddapJSON(q);
      const rows: [string, number, number, number | null][] = d.table.rows;
      const vals = rows.filter(r => r[3] != null && r[3] > 0).map(r => r[3] as number);
      const latest = [...rows].reverse().find(r => r[3] != null && (r[3] as number) > 0);
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      const base = {
        meanChl: mean != null ? Math.round(mean * 1000) / 1000 : null,
        maxChl: vals.length ? Math.round(Math.max(...vals) * 1000) / 1000 : null,
        pixels: vals.length,
        latest: latest ? { time: latest[0], value: latest[3] } : null,
        windowEnd: lastT,
        source: "NASA MODIS-Aqua R2022 via NOAA CoastWatch ERDDAP (erdMH1chla1day_R2022SQ)",
      };
      if (!series) return base;
      // Daily means for the analytics chlorophyll chart.
      const byDay = new Map<string, number[]>();
      for (const r of rows) {
        if (r[3] == null || r[3] <= 0) continue;
        const day = r[0].slice(0, 10);
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day)!.push(r[3]);
      }
      const daily = [...byDay.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, v]) => ({ date: date.slice(5), value: Math.round((v.reduce((x, y) => x + y, 0) / v.length) * 1000) / 1000 }));
      return { ...base, daily };
    });
    return NextResponse.json({ ...data, cached });
  } catch (e) {
    return NextResponse.json({ error: "chlorophyll fetch failed", detail: String(e) }, { status: 502 });
  }
}
