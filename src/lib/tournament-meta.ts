// 大会実績機能で使う固定値と表示ラベルの定義。
// 将来「全国マスター名寄せ」「派生レベル算出」を導入するときに、
// この層を経由してロジックを差し替えられるようにしておく。

export const TOURNAMENT_TIERS = [
  "national",
  "regional",
  "prefectural",
  "city",
  "club",
  "other",
] as const;
export type TournamentTier = (typeof TOURNAMENT_TIERS)[number];

export const TOURNAMENT_TIER_LABEL: Record<TournamentTier, string> = {
  national: "全国大会",
  regional: "地方・関東等 広域",
  prefectural: "都道府県大会",
  city: "区・市町村大会",
  club: "内部・サークル間",
  other: "その他",
};

export const TOURNAMENT_FORMATS = [
  "tournament",
  "league",
  "league_then_tournament",
  "other",
] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const TOURNAMENT_FORMAT_LABEL: Record<TournamentFormat, string> = {
  tournament: "トーナメント",
  league: "リーグ戦",
  league_then_tournament: "予選リーグ + 決勝トーナメント",
  other: "その他",
};

export const TOURNAMENT_CATEGORIES = ["MS", "WS", "MD", "WD", "XD", "other"] as const;
export type TournamentCategory = (typeof TOURNAMENT_CATEGORIES)[number];

export const TOURNAMENT_CATEGORY_LABEL: Record<TournamentCategory, string> = {
  MS: "男子シングルス",
  WS: "女子シングルス",
  MD: "男子ダブルス",
  WD: "女子ダブルス",
  XD: "ミックスダブルス",
  other: "その他",
};

// 成績 (rank) の候補リスト。format に応じて切り替える。
// 「その他」を選ぶと自由入力に切り替わる UI を前提に、各リスト末尾に other は含めない。
// 自由入力テキストの保存は変えていないので、過去の任意テキストもそのまま読める。
export const RANK_OPTIONS_TOURNAMENT = [
  "優勝",
  "準優勝",
  "ベスト4",
  "ベスト8",
  "ベスト16",
  "ベスト32",
  "1回戦敗退",
  "2回戦敗退",
  "3回戦敗退",
] as const;

export const RANK_OPTIONS_LEAGUE = [
  "1位",
  "2位",
  "3位",
  "4位",
  "5位以下",
  "予選敗退",
] as const;

export const RANK_OPTIONS_LEAGUE_THEN_TOURNAMENT = [
  "優勝",
  "準優勝",
  "ベスト4",
  "ベスト8",
  "予選リーグ敗退",
] as const;

export function rankOptionsFor(format: string): readonly string[] {
  if (format === "league") return RANK_OPTIONS_LEAGUE;
  if (format === "league_then_tournament") return RANK_OPTIONS_LEAGUE_THEN_TOURNAMENT;
  if (format === "tournament") return RANK_OPTIONS_TOURNAMENT;
  return RANK_OPTIONS_TOURNAMENT;
}
