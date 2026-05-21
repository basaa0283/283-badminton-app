import { TOURNAMENT_TIERS, TOURNAMENT_CATEGORIES } from "./tournament-meta";
import type { TournamentTier, TournamentCategory } from "./tournament-meta";

export interface PodiumCount {
  gold: number; // 優勝 / 1位
  silver: number; // 準優勝 / 2位
  bronze: number; // ベスト4 / 3位
}

// 種目 (TournamentCategory) → Tier → 集計 (Tier=null は省略)
export type TournamentSummary = Partial<
  Record<TournamentCategory, Partial<Record<TournamentTier, PodiumCount>>>
>;

// 「優勝 / 1位」「準優勝 / 2位」「ベスト4 / 3位」をカウント。
// それ以下や未知の成績は集計対象外。
export function classifyRank(rank: string | null | undefined): keyof PodiumCount | null {
  if (!rank) return null;
  if (rank === "優勝" || rank === "1位") return "gold";
  if (rank === "準優勝" || rank === "2位") return "silver";
  if (rank === "ベスト4" || rank === "3位") return "bronze";
  return null;
}

interface ResultLike {
  category: string;
  rank: string | null;
  tournamentClass: { tier: string | null } | null;
}

// 1 ユーザー分の result 配列から「種目 × Tier × メダル種別」のカウントを作る。
// Tier が null の class はスキップ (集計対象外)。
export function buildSummary(results: ResultLike[]): TournamentSummary {
  const summary: TournamentSummary = {};
  for (const r of results) {
    const tier = r.tournamentClass?.tier;
    if (!tier) continue;
    if (!(TOURNAMENT_TIERS as readonly string[]).includes(tier)) continue;
    const medal = classifyRank(r.rank);
    if (!medal) continue;
    if (!(TOURNAMENT_CATEGORIES as readonly string[]).includes(r.category)) continue;
    const category = r.category as TournamentCategory;
    const t = tier as TournamentTier;
    summary[category] ??= {};
    summary[category]![t] ??= { gold: 0, silver: 0, bronze: 0 };
    summary[category]![t]![medal] += 1;
  }
  return summary;
}
