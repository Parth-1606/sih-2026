import { describe, expect, it } from "vitest";
import {
  adaptEezDemo, adaptGebcoDemo, adaptImdDemo, adaptMpaCurated,
  adaptOsfDemo, adaptPfz, adaptUnavailable,
} from "../adapters";
import type { DataMode } from "../schema";

const MODES: DataMode[] = ["live", "demo", "forecast", "unavailable"];

describe("adapters", () => {
  it("every record carries schema metadata + dataMode + isMock flag", async () => {
    const groups = [
      adaptOsfDemo(), adaptImdDemo(), adaptMpaCurated(), adaptEezDemo(),
      adaptUnavailable(), await adaptPfz().catch(() => []),
    ];
    const all = groups.flat();
    expect(all.length).toBeGreaterThan(5);
    for (const r of all) {
      expect(MODES).toContain(r.dataMode);
      expect(typeof r.isMock).toBe("boolean");
      expect(r.source.name.length).toBeGreaterThan(0);
      expect(r.source.url).toMatch(/^https?:\/\//);
      expect(r.source.retrievedAt).toBeTruthy();
      expect(r.units).toBeDefined();
      // demo records must never claim to be live
      if (r.isMock) expect(r.dataMode).not.toBe("live");
      if (r.dataMode === "live") expect(r.isMock).toBe(false);
    }
  });

  it("demo PFZ positions sit offshore Mumbai Harbour", async () => {
    const pfz = (await adaptPfz().catch(() => []))
      .filter(r => r.id.startsWith("PFZ-"));
    for (const p of pfz) {
      expect(p.dataMode).toBe("demo");
      expect(p.location!.lng).toBeLessThan(72.9); // seaward (west) of harbour
    }
  });

  it("gebco demo depth grows offshore", () => {
    const near = adaptGebcoDemo(18.93, 72.9).data as { depthM: number };
    const far = adaptGebcoDemo(18.7, 72.2).data as { depthM: number };
    expect(far.depthM).toBeGreaterThan(near.depthM);
    expect(adaptGebcoDemo(18.93, 72.9).dataMode).toBe("demo");
    expect(adaptGebcoDemo(18.93, 72.9).isMock).toBe(true);
  });
});
