import { describe, it, expect } from "vitest";
import { planHasPaidFeatures } from "./feature-gate";

describe("planHasPaidFeatures", () => {
  it("paid + active は有料機能 OK", () => {
    expect(planHasPaidFeatures("paid", "active")).toBe(true);
  });

  it("complimentary + active は有料機能 OK (知人パイロット)", () => {
    expect(planHasPaidFeatures("complimentary", "active")).toBe(true);
  });

  it("free + active は有料機能 NG", () => {
    expect(planHasPaidFeatures("free", "active")).toBe(false);
  });

  it("paid でも frozen (未払い等) なら NG", () => {
    expect(planHasPaidFeatures("paid", "frozen")).toBe(false);
  });

  it("complimentary でも pending (承認待ち) なら NG", () => {
    expect(planHasPaidFeatures("complimentary", "pending")).toBe(false);
  });

  it("未知のプラン文字列は NG に倒す", () => {
    expect(planHasPaidFeatures("premium", "active")).toBe(false);
    expect(planHasPaidFeatures("", "active")).toBe(false);
  });
});
