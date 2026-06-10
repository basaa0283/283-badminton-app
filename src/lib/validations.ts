import { z } from "zod";
import {
  TOURNAMENT_TIERS,
  TOURNAMENT_FORMATS,
  TOURNAMENT_CATEGORIES,
  TOURNAMENT_OPENNESS,
  PREFECTURES,
} from "./tournament-meta";

// イベント作成スキーマ
export const createEventSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(100, "タイトルは100文字以内で入力してください"),
  description: z.string().max(1000, "説明は1000文字以内で入力してください").optional().nullable(),
  eventDate: z.string().datetime({ message: "有効な日時を入力してください" }),
  eventEndDate: z.string().datetime().optional().nullable(),
  isAllDay: z.boolean().default(false),
  location: z.string().max(200, "場所は200文字以内で入力してください").optional().nullable(),
  capacity: z.number().int().positive("定員は1以上で入力してください").optional().nullable(),
  fee: z.number().int().nonnegative("参加費は0以上で入力してください").optional().nullable(),
  feeVisible: z.boolean().default(false),
  deadline: z.string().datetime().optional().nullable(),
  deadlineEnabled: z.boolean().default(false),
  respondStartAt: z.string().datetime().optional().nullable(),
  notifyMembers: z.boolean().default(true),
  announceOnCreate: z.boolean().default(false),
  // 種別タグ
  categoryId: z.string().optional().nullable(),
  // 閲覧・回答できる最低ロール
  minViewRole: z.enum(["guest", "visitor", "member"]).default("visitor"),
  minRespondRole: z.enum(["visitor", "member"]).default("visitor"),
  // 公開状態 (draft = 管理者と作成者のみ、published = 通常公開)
  status: z.enum(["draft", "published"]).default("published"),
  // 経費・収支 (管理者用)
  shuttleCount: z.number().int().nonnegative("シャトル本数は0以上で入力してください").optional().nullable(),
  shuttleCost: z.number().int().nonnegative("シャトル代は0以上で入力してください").optional().nullable(),
  gymCost: z.number().int().nonnegative("体育館代は0以上で入力してください").optional().nullable(),
  otherCost: z.number().int().nonnegative("その他経費は0以上で入力してください").optional().nullable(),
  otherMemo: z.string().max(500, "メモは500文字以内で入力してください").optional().nullable(),
  actualRevenue: z.number().int().nonnegative("実集金額は0以上で入力してください").optional().nullable(),
});

// イベント更新スキーマ
export const updateEventSchema = createEventSchema.partial();

// 出欠登録スキーマ
export const attendanceSchema = z.object({
  status: z.enum(["attending", "not_attending"], {
    message: "参加または不参加を選択してください",
  }),
  comment: z.string().max(200, "コメントは200文字以内で入力してください").optional(),
  // 大会連動イベントの場合のみ意味を持つ。指定なしは未申告として扱う。
  declaredTournamentClassId: z.string().nullable().optional(),
});

// プロフィール更新スキーマ
export const updateProfileSchema = z.object({
  nickname: z.string().min(1, "ニックネームは必須です").max(50, "ニックネームは50文字以内で入力してください"),
  firstName: z.string().max(50).optional().nullable(),
  lastName: z.string().max(50).optional().nullable(),
  gender: z.enum(["male", "female"]).optional().nullable(),
  birthdate: z.string().datetime({ message: "有効な生年月日を入力してください" }).optional().nullable(),
  ageVisible: z.boolean().default(true),
  comment: z.string().max(500).optional().nullable(),
  // 大会実績の全体公開スイッチ。OFF なら他メンバーには大会実績を見せない。
  tournamentResultsPublic: z.boolean().optional(),
});

// メンバー権限更新スキーマ
export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "subadmin", "member", "visitor", "guest"]),
});

// 管理者によるメンバー情報更新スキーマ
export const adminUpdateMemberSchema = z.object({
  nickname: z.string().min(1, "ニックネームは必須です").max(50, "ニックネームは50文字以内で入力してください").optional(),
  firstName: z.string().max(50).optional().nullable(),
  lastName: z.string().max(50).optional().nullable(),
  gender: z.enum(["male", "female"]).optional().nullable(),
  birthdate: z.string().datetime({ message: "有効な生年月日を入力してください" }).optional().nullable(),
  ageVisible: z.boolean().optional(),
  comment: z.string().max(500).optional().nullable(),
  role: z.enum(["admin", "subadmin", "member", "visitor", "guest"]).optional(),
  skillLevel: z.number().int().min(0, "スキルレベルは0以上で入力してください").max(10, "スキルレベルは10以下で入力してください").optional().nullable(),
  adminNote: z.string().max(1000).optional().nullable(),
  // キャンセル待ち繰り上げ優先度 (priority モード時に使用)。負値も許可しておくと
  // 「絶対あとに回したい」運用を表現できる。常識的な範囲は -100〜100。
  priorityScore: z.number().int().min(-1000).max(1000).optional(),
});

// 大会クラス入力 (大会作成・編集時にネストして送る)
// name は null OK (= その種目にクラス分けは無い)
// tier も null OK (= 登録者が判断できないので未指定、admin が後で補完する想定)
export const tournamentClassInputSchema = z.object({
  category: z.enum(TOURNAMENT_CATEGORIES),
  name: z.string().max(50, "クラス名は50文字以内").optional().nullable(),
  tier: z.enum(TOURNAMENT_TIERS).optional().nullable(),
  order: z.number().int().min(0).max(999).optional(),
});

// 後から追加申請するときの入力 (proposalNote を任意に付ける)
export const tournamentClassProposalSchema = tournamentClassInputSchema.extend({
  proposalNote: z.string().max(500).optional().nullable(),
});

// クラス単体の承認/却下
export const tournamentClassApprovalSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

// 大会マスター作成/更新スキーマ
// tier はクラス側に移動したので、ここには無い
export const tournamentInputSchema = z.object({
  name: z.string().min(1, "大会名は必須です").max(200, "大会名は200文字以内で入力してください"),
  heldAt: z.string().datetime({ message: "開催日を入力してください" }),
  openness: z.enum(TOURNAMENT_OPENNESS).default("open"),
  prefecture: z.enum(PREFECTURES).optional().nullable(),
  format: z.enum(TOURNAMENT_FORMATS),
  location: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  classes: z.array(tournamentClassInputSchema).max(60).optional().default([]),
  // 「参加表明用のイベントも作る」フラグ。デフォルト false。
  // true かつ heldAt が未来日付の時、Tournament 作成と同時に紐付き Event を作る。
  createLinkedEvent: z.boolean().optional().default(false),
});

// 大会成績作成/更新スキーマ
// isPublic: 大会成績ごとの公開フラグ (デフォルト false)。
//   true なら他メンバーから個別の成績として閲覧できる。上限なし。
export const tournamentResultInputSchema = z.object({
  category: z.enum(TOURNAMENT_CATEGORIES),
  tournamentClassId: z.string().optional().nullable(),
  rank: z.string().max(100).optional().nullable(),
  partnerName: z.string().max(100).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  isPublic: z.boolean().optional().default(false),
});

// 承認/却下入力
export const tournamentApprovalSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(500).optional().nullable(),
});

// 管理者が他人の成績を登録するとき用 (userId を明示)
export const adminTournamentResultInputSchema = tournamentResultInputSchema.extend({
  userId: z.string().min(1, "対象ユーザーが必要です"),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type AdminUpdateMemberInput = z.infer<typeof adminUpdateMemberSchema>;
export type TournamentInput = z.infer<typeof tournamentInputSchema>;
export type TournamentClassInput = z.infer<typeof tournamentClassInputSchema>;
export type TournamentClassProposalInput = z.infer<typeof tournamentClassProposalSchema>;
export type TournamentClassApprovalInput = z.infer<typeof tournamentClassApprovalSchema>;
export type TournamentResultInput = z.infer<typeof tournamentResultInputSchema>;
export type AdminTournamentResultInput = z.infer<typeof adminTournamentResultInputSchema>;
export type TournamentApprovalInput = z.infer<typeof tournamentApprovalSchema>;
