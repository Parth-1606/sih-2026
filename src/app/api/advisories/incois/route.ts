// INCOIS advisory status: live validity dates scraped from the public PFZ
// text page + deep links per sector. Per-sector lat/long text loads via the
// site's own JS, so the full text stays one click away (linked, not faked).
import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";

export const dynamic = "force-dynamic";

const SECTORS = [
  "GUJARAT", "MAHARASHTRA", "GOA", "KARNATAKA", "KERALA",
  "SOUTH TAMILNADU", "NORTH TAMILNADU", "SOUTH ANDHRA PRADESH",
  "NORTH ANDHRA PRADESH", "ODISHA", "WEST BENGAL", "ANDAMAN",
  "NICOBAR", "LAKSHADWEEP",
];

export async function GET() {
  try {
    const { data, cached } = await getOrFetch("incois-status", 12 * 3600 * 1000, async () => {
      const res = await fetch(
        "https://incois.gov.in/MarineFisheries/TextDataHome?mfid=1&request_locale=en",
        { signal: AbortSignal.timeout(25000), headers: { "User-Agent": "ORCA-SIH-Prototype/1.0 (research)" } }
      );
      if (!res.ok) throw new Error(`INCOIS HTTP ${res.status}`);
      const html = await res.text();
      const dates = [...html.matchAll(/(\d{1,2}\s+[A-Z]{3}\s+\d{4})/g)].map(m => m[1]);
      return {
        forecastDate: dates[0] ?? null,
        validUpto: dates[1] ?? null,
        sectors: SECTORS,
        links: {
          pfzAdvisory: "https://incois.gov.in/MarineFisheries/PfzAdvisory",
          pfzWebGis: "https://incois.gov.in/MarineFisheries/PfzWebGis",
          textData: "https://incois.gov.in/MarineFisheries/TextDataHome?mfid=1&request_locale=en",
          oceanStateForecast: "https://incois.gov.in/portal/osf/osf.jsp",
        },
        source: "INCOIS PFZ text-data page (live validity dates)",
      };
    });
    return NextResponse.json({ ...data, cached });
  } catch (e) {
    return NextResponse.json({ error: "incois unreachable", detail: String(e) }, { status: 502 });
  }
}
