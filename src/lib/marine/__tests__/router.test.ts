import { describe, expect, it } from "vitest";
import { planMarineRoutes } from "../router";
import { VESSELS } from "../risk";
import { pointInPolygon } from "../geo";
import { CURATED_MPAS } from "@/lib/marine-zones";

const MUMBAI = { lat: 18.93, lng: 72.9, name: "Mumbai Harbour" };
const PFZ1 = { lat: 18.8, lng: 72.6, name: "PFZ-001" };
const MALVAN = CURATED_MPAS[0].polygon as [number, number][];

function throughMalvan() {
  // Harbour → far south waypoint forcing a pass near Malvan box.
  return planMarineRoutes({
    from: { lat: 16.6, lng: 73.2, name: "Ratnagiri" },
    to: { lat: 15.5, lng: 73.6, name: "South of Malvan" },
    vessel: VESSELS.small, departLabel: "test", safety: "normal",
    liveWindKts: 12, liveWaveM: 0.8,
  });
}

describe("planMarineRoutes", () => {
  it("returns two water options with sane numbers", () => {
    const { direct, safe } = planMarineRoutes({
      from: MUMBAI, to: PFZ1, vessel: VESSELS.small,
      departLabel: "test", safety: "normal", liveWindKts: 12, liveWaveM: 0.8,
    });
    expect(direct.coords.length).toBeGreaterThan(2);
    expect(safe.coords.length).toBeGreaterThanOrEqual(direct.coords.length);
    expect(direct.distanceKm).toBeGreaterThan(0);
    expect(safe.distanceKm).toBeGreaterThanOrEqual(direct.distanceKm);
    expect(direct.risk.recommendation).toBeTruthy();
    expect(safe.explanation.length).toBeGreaterThan(0);
  });

  it("keeps routes out of the Malvan restricted box (or flags intrusion)", () => {
    const { direct, safe } = throughMalvan();
    for (const opt of [direct, safe]) {
      const inside = opt.coords.filter(([la, ln]) => pointInPolygon(la, ln, MALVAN));
      if (inside.length > 0) {
        expect(opt.mpaConflicts.join(" ")).toMatch(/Malvan/);
      }
    }
    // At least the safe option must clear it or flag it.
    const s = safe.coords.filter(([la, ln]) => pointInPolygon(la, ln, MALVAN));
    expect(s.length === 0 || safe.mpaConflicts.join(" ").includes("Malvan")).toBe(true);
  });

  it("fuel and duration derive from vessel speed", () => {
    const a = planMarineRoutes({ from: MUMBAI, to: PFZ1, vessel: VESSELS.small, departLabel: "t", safety: "normal" });
    const b = planMarineRoutes({ from: MUMBAI, to: PFZ1, vessel: VESSELS.trawler, departLabel: "t", safety: "normal" });
    expect(b.direct.durationMin).toBeGreaterThan(a.direct.durationMin); // trawler slower
    expect(b.direct.fuelL).toBeGreaterThan(a.direct.fuelL);
  });
});
