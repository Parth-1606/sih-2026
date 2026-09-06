// Demo-grade ingestion cache — stands in for the PDF §3 storage layer
// (MinIO for raw rasters, PostgreSQL+PostGIS+TimescaleDB for structured data).
// Same contract: TTL per source, served by Next.js API routes. Swap the body
// of getOrFetch() for SQL when the full stack is deployed.
import { promises as fs } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), ".data");

async function readCache(key: string, ttlMs: number): Promise<{ hit: boolean; data?: unknown }> {
  try {
    const raw = await fs.readFile(path.join(DIR, `${key}.json`), "utf8");
    const { at, data } = JSON.parse(raw);
    if (Date.now() - at < ttlMs) return { hit: true, data };
    return { hit: false };
  } catch {
    return { hit: false };
  }
}

async function writeCache(key: string, data: unknown): Promise<void> {
  try {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(path.join(DIR, `${key}.json`), JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* cache is best-effort */
  }
}

export async function getOrFetch<T>(key: string, ttlMs: number, fetchFn: () => Promise<T>): Promise<{ data: T; cached: boolean }> {
  const c = await readCache(key, ttlMs);
  if (c.hit) return { data: c.data as T, cached: true };
  const data = await fetchFn();
  await writeCache(key, data);
  return { data, cached: false };
}
