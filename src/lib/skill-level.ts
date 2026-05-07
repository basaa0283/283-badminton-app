// バドミントンスキルレベル定義（管理画面のみで使用）
// 基準: 区民大会レベル
// - Lv.1 = 区民4部出場（最低ライン）
// - Lv.7 以上 = 公式戦（都大会・県大会など）出場レベル

export interface SkillLevelDefinition {
  level: number;
  /** 区民大会レベル（基準軸、4部=底辺） */
  district: string;
  /** 公式戦（都大会・県大会など社会人公式戦） */
  official: string;
  /** 都内オープン戦レベル（おおむね4部スタート） */
  open: string;
  /** UI表示用の短いラベル */
  shortLabel: string;
}

export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 10;

const DASH = "—";

export const SKILL_LEVELS: SkillLevelDefinition[] = [
  { level: 0,  district: "4部未満",       official: DASH,                   open: DASH,                shortLabel: "4部未満" },
  { level: 1,  district: "4部出場",       official: DASH,                   open: DASH,                shortLabel: "区民4部" },
  { level: 2,  district: "4部上位",       official: DASH,                   open: "4部出場",           shortLabel: "区民4部上位" },
  { level: 3,  district: "3部出場",       official: DASH,                   open: "4部上位",           shortLabel: "区民3部" },
  { level: 4,  district: "3部上位",       official: DASH,                   open: "3部下位",           shortLabel: "区民3部上位" },
  { level: 5,  district: "2部出場",       official: DASH,                   open: "3部出場",           shortLabel: "区民2部" },
  { level: 6,  district: "2部入賞",       official: DASH,                   open: "3部上位〜2部下位", shortLabel: "区民2部入賞" },
  { level: 7,  district: "1部出場",       official: "都大会・県大会出場",  open: "2部出場",           shortLabel: "区民1部" },
  { level: 8,  district: "1部上位",       official: "都大会・県大会上位",  open: "2部上位",           shortLabel: "区民1部上位" },
  { level: 9,  district: DASH,             official: "都大会・県大会入賞",  open: "1部出場",           shortLabel: "都県大会入賞" },
  { level: 10, district: DASH,             official: "全国大会出場",        open: "1部上位・全国",     shortLabel: "全国" },
];

export function getSkillLevelDefinition(level: number | null | undefined): SkillLevelDefinition | null {
  if (level === null || level === undefined) return null;
  return SKILL_LEVELS.find((s) => s.level === level) ?? null;
}

/** 例: "Lv.6 (区民2部入賞)" / null は "未設定" */
export function formatSkillLevel(level: number | null | undefined): string {
  if (level === null || level === undefined) return "未設定";
  const def = getSkillLevelDefinition(level);
  return def ? `Lv.${level} (${def.shortLabel})` : `Lv.${level}`;
}
