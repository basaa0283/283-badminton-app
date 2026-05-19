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
