// 大会実績機能で使う固定値と表示ラベルの定義。
// 将来「全国マスター名寄せ」「派生レベル算出」を導入するときに、
// この層を経由してロジックを差し替えられるようにしておく。

// 大会階級 (tier): 大会のレベル感を表す。具体的な序列の定義はユーザーが別途指定する想定。
// 暫定で S → A → B → C → D の 5 段階 + その他 を置いておく。
// (中身は後でラベルだけ書き換えても DB スキーマ・コード構造は変えなくて良い設計)
export const TOURNAMENT_TIERS = ["S", "A", "B", "C", "D", "other"] as const;
export type TournamentTier = (typeof TOURNAMENT_TIERS)[number];

export const TOURNAMENT_TIER_LABEL: Record<TournamentTier, string> = {
  S: "S tier",
  A: "A tier",
  B: "B tier",
  C: "C tier",
  D: "D tier",
  other: "その他",
};

// オープン / クローズ: 出場資格の有無
//   open   = 誰でも参加できる
//   closed = 在住・在勤・協会所属など、何らかの出場資格がある
export const TOURNAMENT_OPENNESS = ["open", "closed"] as const;
export type TournamentOpenness = (typeof TOURNAMENT_OPENNESS)[number];

export const TOURNAMENT_OPENNESS_LABEL: Record<TournamentOpenness, string> = {
  open: "オープン (誰でも出場可)",
  closed: "クローズ (出場資格あり)",
};

// 開催地 (都道府県)。47 都道府県 + overseas (海外) + other (不明等)。
export const PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
  "overseas",
  "other",
] as const;
export type Prefecture = (typeof PREFECTURES)[number];

export const PREFECTURE_LABEL: Record<Prefecture, string> = (() => {
  const labels: Partial<Record<Prefecture, string>> = {
    overseas: "海外",
    other: "その他",
  };
  // 都道府県名はそのまま (日本語) 表示。
  for (const p of PREFECTURES) {
    if (!labels[p]) labels[p] = p as string;
  }
  return labels as Record<Prefecture, string>;
})();

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
