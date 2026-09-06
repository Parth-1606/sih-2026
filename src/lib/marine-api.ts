// Live marine + weather via Open-Meteo (free, no API key, CORS-enabled).
// Docs: https://open-meteo.com/en/docs/marine-weather-api
import { userLocation } from "./mock";

export interface LiveDay {
  day: string;
  wind: number; // knots max
  wave: number; // meters max
  sst: number; // °C
  risk: "LOW" | "MEDIUM" | "HIGH";
}

export interface LiveMarine {
  sst: number;
  waveHeight: number;
  waveDirection: number; // degrees
  wavePeriod: number; // seconds
  windSpeedKn: number;
  windDirectionDeg: number;
  windCompass: string;
  visibilityKm: number;
  airTemp: number;
  currentVelocity: number; // m/s
  time: string; // "HH:MM IST"
  forecast: LiveDay[];
  isLive: true;
}

// Offshore Arabian Sea buoy point — marine models have no data over land,
// so readings come from open water near the selected harbour.
export const MARINE_BUOY = { lat: 18.7, lng: 72.4 };

const TZ = "Asia%2FKolkata";

function compass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function fmtTimeIST(iso?: string): string {
  if (!iso) return "--:--";
  const d = new Date(iso.includes("+") || iso.endsWith("Z") ? iso : iso + "+05:30");
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// Index of the hourly entry closest to (but not after) now.
function currentHourIndex(times: string[]): number {
  const now = Date.now();
  let idx = 0;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i].includes("+") || times[i].endsWith("Z") ? times[i] : times[i] + "+05:30").getTime();
    if (t <= now) idx = i;
    else break;
  }
  return idx;
}

async function getJSON(url: string, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function riskFor(windKn: number, waveM: number): "LOW" | "MEDIUM" | "HIGH" {
  if (windKn >= 28 || waveM >= 2.5) return "HIGH";
  if (windKn >= 17 || waveM >= 1.25) return "MEDIUM";
  return "LOW";
}

const DAY_FMT = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });

export async function fetchLiveMarine(): Promise<LiveMarine> {
  const [marine, weather] = await Promise.all([
    getJSON(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${MARINE_BUOY.lat}&longitude=${MARINE_BUOY.lng}` +
        `&hourly=wave_height,wave_direction,wave_period,sea_surface_temperature,ocean_current_velocity` +
        `&daily=wave_height_max&timezone=${TZ}&forecast_days=4`
    ),
    getJSON(
      `https://api.open-meteo.com/v1/forecast?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}` +
        `&current=temperature_2m,wind_speed_10m,wind_direction_10m` +
        `&hourly=visibility&daily=temperature_2m_max,wind_speed_10m_max&wind_speed_unit=kn` +
        `&timezone=${TZ}&forecast_days=4`
    ),
  ]);

  const mh = marine.hourly;
  const i = currentHourIndex(mh.time);
  const at = (arr: number[], fallback = 0) => (arr && arr[i] != null ? arr[i] : fallback);

  const wh = weather.hourly;
  const wi = currentHourIndex(wh.time);
  const visM = wh.visibility?.[wi] ?? 9000;

  const windKn = weather.current?.wind_speed_10m ?? 0;
  const windDeg = weather.current?.wind_direction_10m ?? 0;
  const waveM = at(mh.wave_height);

  const forecast: LiveDay[] = (weather.daily?.time ?? []).slice(0, 4).map((t: string, k: number) => {
    const w = weather.daily.wind_speed_10m_max?.[k] ?? 0;
    const wv = marine.daily?.wave_height_max?.[k] ?? 0;
    return {
      day: k === 0 ? "Today" : k === 1 ? "Tomorrow" : DAY_FMT.format(new Date(t + "T00:00:00+05:30")),
      wind: Math.round(w),
      wave: Math.round(wv * 10) / 10,
      sst: Math.round(at(mh.sea_surface_temperature, 28) * 10) / 10,
      risk: riskFor(w, wv),
    };
  });

  return {
    sst: Math.round(at(mh.sea_surface_temperature, 28) * 10) / 10,
    waveHeight: Math.round(waveM * 10) / 10,
    waveDirection: Math.round(at(mh.wave_direction)),
    wavePeriod: Math.round(at(mh.wave_period) * 10) / 10,
    windSpeedKn: Math.round(windKn),
    windDirectionDeg: Math.round(windDeg),
    windCompass: compass(windDeg),
    visibilityKm: Math.round(visM / 100) / 10,
    airTemp: Math.round((weather.current?.temperature_2m ?? 0) * 10) / 10,
    currentVelocity: Math.round(at(mh.ocean_current_velocity) * 100) / 100,
    time: fmtTimeIST(mh.time?.[i]),
    forecast,
    isLive: true,
  };
}

export interface HourlySeries {
  time: string[];
  windKn: number[];
  waveM: number[];
  sstC: number[];
  isLive: true;
}

// 48h hourly series for analytics charts (Live).
export async function fetchHourlySeries(hours = 48): Promise<HourlySeries> {
  interface Wx {
    hourly: { time: string[]; wind_speed_10m: number[]; wind_direction_10m: number[] };
  }
  interface Oc {
    hourly: { time: string[]; wave_height: number[]; wave_period: number[]; sea_surface_temperature: number[] };
  }
  const [w, m]: [Wx, Oc] = await Promise.all([
    getJSON(
      `https://api.open-meteo.com/v1/forecast?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}` +
        `&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&timezone=${TZ}&forecast_days=3`
    ),
    getJSON(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${MARINE_BUOY.lat}&longitude=${MARINE_BUOY.lng}` +
        `&hourly=wave_height,wave_period,sea_surface_temperature&timezone=${TZ}&forecast_days=3`
    ),
  ]);
  const now = Date.now();
  let start = 0;
  for (let i = 0; i < w.hourly.time.length; i++) {
    const t = new Date(w.hourly.time[i].includes("+") || w.hourly.time[i].endsWith("Z") ? w.hourly.time[i] : w.hourly.time[i] + "+05:30").getTime();
    if (t <= now) start = i;
    else break;
  }
  const n = Math.min(hours, w.hourly.time.length - start);
  const waveStart = (() => {
    let s = 0;
    for (let i = 0; i < m.hourly.time.length; i++) {
      const t = new Date(m.hourly.time[i].includes("+") || m.hourly.time[i].endsWith("Z") ? m.hourly.time[i] : m.hourly.time[i] + "+05:30").getTime();
      if (t <= now) s = i;
      else break;
    }
    return s;
  })();
  const nn = Math.min(hours, m.hourly.time.length - waveStart);
  const k = Math.min(n, nn);
  const r = (v: number) => Math.round(v * 100) / 100;
  return {
    time: w.hourly.time.slice(start, start + k),
    windKn: w.hourly.wind_speed_10m.slice(start, start + k).map(r),
    waveM: m.hourly.wave_height.slice(waveStart, waveStart + k).map(r),
    sstC: m.hourly.sea_surface_temperature.slice(waveStart, waveStart + k).map(r),
    isLive: true,
  };
}

export interface PlaceResult {
  name: string;
  country?: string;
  lat: number;
  lng: number;
}

export async function searchPlaces(query: string, count = 5): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];
  // Raw "lat,lng" passthrough
  const m = q.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
  if (m) return [{ name: `${m[1]}, ${m[3]}`, lat: parseFloat(m[1]), lng: parseFloat(m[3]) }];
  const data = await getJSON(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${count}&language=en&format=json`
  );
  return (data.results ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any): PlaceResult => ({ name: `${r.name}${r.admin1 ? `, ${r.admin1}` : ""}`, country: r.country, lat: r.latitude, lng: r.longitude })
  );
}
