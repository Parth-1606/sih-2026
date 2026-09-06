import { describe, expect, it } from "vitest";
import { assessRisk, VESSELS } from "../risk";

const calm = {
  windKts: 12, waveM: 0.8, wavePeriodS: 8, lightning: false,
  visibilityKm: 9, vessel: VESSELS.small,
};

describe("assessRisk", () => {
  it("calm seas → Safe / Low with supporters listed", () => {
    const r = assessRisk({ ...calm });
    expect(r.level).toBe("Low");
    expect(r.recommendation).toBe("Safe");
    expect(r.thresholdsExceeded).toHaveLength(0);
    expect(r.supporters.length).toBeGreaterThan(0);
    expect(r.disclaimer).toMatch(/INCOIS\/IMD/);
  });

  it("over-limit wind+wave for small craft → Severe / Do not venture", () => {
    const r = assessRisk({ ...calm, windKts: 30, waveM: 2.6 });
    expect(r.level).toBe("Severe");
    expect(r.recommendation).toBe("Do not venture into the sea");
    expect(r.thresholdsExceeded.join(" ")).toMatch(/Wind speed|Wave height/);
  });

  it("lightning forces at least Medium", () => {
    const r = assessRisk({ ...calm, lightning: true });
    expect(["Medium", "High", "Severe"]).toContain(r.level);
    expect(r.recommendation).not.toBe("Safe");
  });

  it("nearby cyclone (<150km) → Severe", () => {
    const r = assessRisk({ ...calm, cycloneKm: 120 });
    expect(r.level).toBe("Severe");
  });

  it("shallow water below vessel minimum adds points", () => {
    const deep = assessRisk({ ...calm, minDepthOnRouteM: 30 });
    const shallow = assessRisk({ ...calm, minDepthOnRouteM: 3 });
    expect(shallow.score).toBeGreaterThan(deep.score);
    expect(shallow.thresholdsExceeded.join(" ")).toMatch(/depth/i);
  });

  it("trawler tolerates more than small craft", () => {
    const inp = { ...calm, windKts: 27, waveM: 2.2 };
    expect(assessRisk({ ...inp, vessel: VESSELS.small }).level).toBe("Severe");
    expect(assessRisk({ ...inp, vessel: VESSELS.trawler }).level).not.toBe("Severe");
  });
});
