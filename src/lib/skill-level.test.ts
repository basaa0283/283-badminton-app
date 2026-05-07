import { describe, it, expect } from "vitest";
import {
  SKILL_LEVELS,
  SKILL_LEVEL_MIN,
  SKILL_LEVEL_MAX,
  getSkillLevelDefinition,
  formatSkillLevel,
} from "./skill-level";

describe("SKILL_LEVELS", () => {
  it("0から10までの全11段階定義されている", () => {
    expect(SKILL_LEVELS).toHaveLength(11);
    expect(SKILL_LEVELS.map((s) => s.level)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("MIN/MAX定数と整合している", () => {
    expect(SKILL_LEVEL_MIN).toBe(0);
    expect(SKILL_LEVEL_MAX).toBe(10);
  });
});

describe("getSkillLevelDefinition", () => {
  it("有効なレベルなら定義を返す", () => {
    const def = getSkillLevelDefinition(1);
    expect(def?.level).toBe(1);
    expect(def?.district).toBe("4部出場");
  });

  it("0も有効", () => {
    const def = getSkillLevelDefinition(0);
    expect(def?.shortLabel).toBe("4部未満");
  });

  it("範囲外なら null", () => {
    expect(getSkillLevelDefinition(11)).toBeNull();
    expect(getSkillLevelDefinition(-1)).toBeNull();
  });

  it("null/undefined は null", () => {
    expect(getSkillLevelDefinition(null)).toBeNull();
    expect(getSkillLevelDefinition(undefined)).toBeNull();
  });
});

describe("formatSkillLevel", () => {
  it("有効なレベルなら 'Lv.X (短ラベル)'", () => {
    expect(formatSkillLevel(1)).toBe("Lv.1 (区民4部)");
    expect(formatSkillLevel(6)).toBe("Lv.6 (区民2部入賞)");
  });

  it("0も対応", () => {
    expect(formatSkillLevel(0)).toBe("Lv.0 (4部未満)");
  });

  it("null/undefined は '未設定'", () => {
    expect(formatSkillLevel(null)).toBe("未設定");
    expect(formatSkillLevel(undefined)).toBe("未設定");
  });

  it("範囲外なら 'Lv.X' のみ（短ラベルなし）", () => {
    expect(formatSkillLevel(11)).toBe("Lv.11");
  });
});
