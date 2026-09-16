import { describe, expect, it } from "vitest";
import { toVerdict, type Verdict } from "@/lib/scoring";

describe("toVerdict", () => {
  it("buckets low percentages as Likely Human", () => {
    expect(toVerdict(0)).toBe<Verdict>("Likely Human");
    expect(toVerdict(1)).toBe<Verdict>("Likely Human");
    expect(toVerdict(17)).toBe<Verdict>("Likely Human");
    expect(toVerdict(34)).toBe<Verdict>("Likely Human");
  });

  it("keeps 34.9 below the Uncertain boundary", () => {
    expect(toVerdict(34.9)).toBe<Verdict>("Likely Human");
  });

  it("buckets the exact lower boundary of Uncertain", () => {
    expect(toVerdict(35)).toBe<Verdict>("Uncertain");
  });

  it("buckets mid-range percentages as Uncertain", () => {
    expect(toVerdict(50)).toBe<Verdict>("Uncertain");
    expect(toVerdict(65)).toBe<Verdict>("Uncertain");
  });

  it("moves past the Uncertain upper boundary at 65", () => {
    expect(toVerdict(65)).toBe<Verdict>("Uncertain");
    expect(toVerdict(65.1)).toBe<Verdict>("Likely AI-generated");
    expect(toVerdict(66)).toBe<Verdict>("Likely AI-generated");
  });

  it("buckets high percentages as Likely AI-generated", () => {
    expect(toVerdict(78)).toBe<Verdict>("Likely AI-generated");
    expect(toVerdict(99)).toBe<Verdict>("Likely AI-generated");
    expect(toVerdict(100)).toBe<Verdict>("Likely AI-generated");
  });
});
