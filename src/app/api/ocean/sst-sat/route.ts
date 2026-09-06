// Satellite SST cross-check (MUR JPL, via ERDDAP). Best-effort —
// Open-Meteo model SST in marine-api.ts remains the primary live value.
import { NextRequest, NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "18.7");
  const lng = parseFloat(sp.get("lng") ?? "72.4");
  if (![lat, lng].every(Number.isFinite)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }
  try {
    const { data, cached } = await getOrFetch(`sstdat-${lat.toFixed(2)}-${lng.toFixed(2)}`, 6 * 3600 * 1000, async () => {
      const url =
        `https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.json` +
        `?analysed_sst[last][(${lat})][(${lng})]`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`ERDDAP HTTP ${res.status}`);
      const j = await res.json();
      const row = j.table.rows[0];
      const c = row[3] != null ? Math.round((row[3] - 273.15) * 10) / 10 : null;
      return { sstC: c, time: row[0], source: "JPL MUR SST via NOAA CoastWatch ERDDAP (jplMURSST41)" };
    });
    return NextResponse.json({ ...data, cached });
  } catch (e) {
    return NextResponse.json({ error: "sst fetch failed", detail: String(e) }, { status: 502 });
  }
}
