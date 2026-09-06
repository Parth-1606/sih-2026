import { describe, expect, it } from "vitest";
import { pointInPolygon, routeIntersectsPolygon, routeCrossesLine, haversineKm, destPoint } from "../geo";

const SQUARE: [number, number][] = [[1, 1], [1, 3], [3, 3], [3, 1]];

describe("pointInPolygon", () => {
  it("detects inside / outside / edge-adjacent", () => {
    expect(pointInPolygon(2, 2, SQUARE)).toBe(true);
    expect(pointInPolygon(0, 0, SQUARE)).toBe(false);
    expect(pointInPolygon(2, 5, SQUARE)).toBe(false);
  });
});

describe("routeIntersectsPolygon", () => {
  it("flags crossing routes and clears passing ones", () => {
    expect(routeIntersectsPolygon([[0, 2], [4, 2]], SQUARE)).toBe(true);
    expect(routeIntersectsPolygon([[2, 2], [2.5, 2.5]], SQUARE)).toBe(true); // inside
    expect(routeIntersectsPolygon([[0, 0], [0, 4]], SQUARE)).toBe(false);
  });
});

describe("routeCrossesLine", () => {
  it("detects EEZ-line crossings", () => {
    const line: [number, number][] = [[0, 0], [0, 4]];
    expect(routeCrossesLine([[-1, 2], [1, 2]], line)).toBe(true);
    expect(routeCrossesLine([[-1, 2], [-1, 3]], line)).toBe(false);
  });
});

describe("haversineKm + destPoint", () => {
  it("Mumbai harbour to PFZ-001≈32km", () => {
    expect(haversineKm(18.93, 72.9, 18.8, 72.6)).toBeCloseTo(34.4, 0);
  });
  it("destPoint round-trips distance", () => {
    const [la, ln] = destPoint(18.93, 72.9, 225, 30);
    expect(haversineKm(18.93, 72.9, la, ln)).toBeCloseTo(30, 0);
  });
});
