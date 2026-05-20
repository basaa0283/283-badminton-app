// 大会実績機能で使う固定値と表示ラベルの定義。
// 将来「全国マスター名寄せ」「派生レベル算出」を導入するときに、
// この層を経由してロジックを差し替えられるようにしておく。

// 大会階級 (tier): クラス (大会 × 部) 単位の「実質的な強さ」の指標。
// 同じ大会でも 1部 / 2部 / 3部 で Tier が変わる運用。
// 「足立区民1部 と 足立区オープン2部 が同じレベル」のような調整も
// Tier を揃えて指定することで吸収する (open/closed は別軸)。
//
// 上位 (S/A) はざっくり、メインターゲット周辺 (C〜F) を細かく、
// その下にサークル戦・初心者交流の G を 1 つ置く 8 段階。
export const TOURNAMENT_TIERS = ["S", "A", "B", "C", "D", "E", "F", "G"] as const;
export type TournamentTier = (typeof TOURNAMENT_TIERS)[number];

export const TOURNAMENT_TIER_LABEL: Record<TournamentTier, string> = {
  S: "TierS (全日本クラス)",
  A: "TierA (都道府県公式戦・地方ブロック)",
  B: "TierB (区市町村オープン上位・特別区合同)",
  C: "TierC (オープン2部級 ≒ 区民1部級)",
  D: "TierD (オープン3部級 ≒ 区民2部級)",
  E: "TierE (オープン4部級 ≒ 区民3部級)",
  F: "TierF (オープン5部級 ≒ 区民4部級)",
  G: "TierG (それ以下・サークル戦・初心者交流)",
};

// Tier select 等で「未指定」を表現するために使う sentinel 値。
// DB / API では null として保存・送信する。
export const TOURNAMENT_TIER_UNSPECIFIED = "" as const;

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

// 成績テキストから表彰絵文字を引く。優勝🥇 / 準優勝🥈 / ベスト4 (= 3位) 🥉。
// マッチしなければ空文字。
export function rankEmoji(rank: string | null | undefined): string {
  if (!rank) return "";
  if (rank === "優勝" || rank === "1位") return "🥇";
  if (rank === "準優勝" || rank === "2位") return "🥈";
  if (rank === "ベスト4" || rank === "3位") return "🥉";
  return "";
}
