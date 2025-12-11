import { z } from "zod";

// イベント作成スキーマ
export const createEventSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(100, "タイトルは100文字以内で入力してください"),
  description: z.string().max(1000, "説明は1000文字以内で入力してください").optional(),
  eventDate: z.string().datetime({ message: "有効な日時を入力してください" }),
  eventEndDate: z.string().datetime().optional().nullable(),
  location: z.string().max(200, "場所は200文字以内で入力してください").optional(),
  capacity: z.number().int().positive("定員は1以上で入力してください").optional().nullable(),
  fee: z.number().int().nonnegative("参加費は0以上で入力してください").optional().nullable(),
  feeVisible: z.boolean().default(false),
  deadline: z.string().datetime().optional().nullable(),
  deadlineEnabled: z.boolean().default(false),
});

// イベント更新スキーマ
export const updateEventSchema = createEventSchema.partial();

// 出欠登録スキーマ
export const attendanceSchema = z.object({
  status: z.enum(["attending", "not_attending"], {
    message: "参加または不参加を選択してください",
  }),
  comment: z.string().max(200, "コメントは200文字以内で入力してください").optional(),
});

// プロフィール更新スキーマ
export const updateProfileSchema = z.object({
  nickname: z.string().min(1, "ニックネームは必須です").max(50, "ニックネームは50文字以内で入力してください"),
  firstName: z.string().max(50).optional().nullable(),
  lastName: z.string().max(50).optional().nullable(),
  gender: z.enum(["male", "female"]).optional().nullable(),
  age: z.number().int().min(0).max(150).optional().nullable(),
  ageVisible: z.boolean().default(true),
  comment: z.string().max(500).optional().nullable(),
});

// メンバー権限更新スキーマ
export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "subadmin", "member", "visitor", "guest"]),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
