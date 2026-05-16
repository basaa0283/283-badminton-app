import { describe, it, expect } from "vitest";
import {
  createEventSchema,
  attendanceSchema,
  updateProfileSchema,
  updateMemberRoleSchema,
  adminUpdateMemberSchema,
} from "./validations";

describe("createEventSchema", () => {
  const baseValidInput = {
    title: "練習会",
    eventDate: "2026-06-01T10:00:00.000Z",
  };

  it("最小限の必須項目で成功する", () => {
    const result = createEventSchema.safeParse(baseValidInput);
    expect(result.success).toBe(true);
  });

  it("title が空文字の場合は失敗する", () => {
    const result = createEventSchema.safeParse({ ...baseValidInput, title: "" });
    expect(result.success).toBe(false);
  });

  it("title が101文字の場合は失敗する", () => {
    const result = createEventSchema.safeParse({
      ...baseValidInput,
      title: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("eventDate が無効な日付文字列だと失敗する", () => {
    const result = createEventSchema.safeParse({
      ...baseValidInput,
      eventDate: "2026-06-01",
    });
    expect(result.success).toBe(false);
  });

  it("capacity が0以下だと失敗する", () => {
    const result = createEventSchema.safeParse({ ...baseValidInput, capacity: 0 });
    expect(result.success).toBe(false);
  });

  it("fee が負の値だと失敗する", () => {
    const result = createEventSchema.safeParse({ ...baseValidInput, fee: -1 });
    expect(result.success).toBe(false);
  });

  it("デフォルト値が適用される", () => {
    const result = createEventSchema.safeParse(baseValidInput);
    if (result.success) {
      expect(result.data.feeVisible).toBe(false);
      expect(result.data.deadlineEnabled).toBe(false);
      expect(result.data.notifyMembers).toBe(true);
    }
  });
});

describe("attendanceSchema", () => {
  it("attending を許可する", () => {
    const result = attendanceSchema.safeParse({ status: "attending" });
    expect(result.success).toBe(true);
  });

  it("not_attending を許可する", () => {
    const result = attendanceSchema.safeParse({ status: "not_attending" });
    expect(result.success).toBe(true);
  });

  it("waitlist は不可（サーバ側で自動判定するため）", () => {
    const result = attendanceSchema.safeParse({ status: "waitlist" });
    expect(result.success).toBe(false);
  });

  it("コメントが200文字を超えると失敗する", () => {
    const result = attendanceSchema.safeParse({
      status: "attending",
      comment: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("nickname のみで成功する", () => {
    const result = updateProfileSchema.safeParse({ nickname: "ツバサ" });
    expect(result.success).toBe(true);
  });

  it("nickname が空だと失敗する", () => {
    const result = updateProfileSchema.safeParse({ nickname: "" });
    expect(result.success).toBe(false);
  });

  it("birthdate が ISO 文字列なら通る", () => {
    const result = updateProfileSchema.safeParse({
      nickname: "テスト",
      birthdate: "1990-05-17T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("birthdate が不正な日時文字列ならエラー", () => {
    const result = updateProfileSchema.safeParse({
      nickname: "テスト",
      birthdate: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("gender に male/female 以外の値はエラーになる", () => {
    const result = updateProfileSchema.safeParse({
      nickname: "テスト",
      gender: "other",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateMemberRoleSchema", () => {
  it.each(["admin", "subadmin", "member", "visitor", "guest"] as const)(
    "%s を許可する",
    (role) => {
      const result = updateMemberRoleSchema.safeParse({ role });
      expect(result.success).toBe(true);
    },
  );

  it("未定義のロールは失敗する", () => {
    const result = updateMemberRoleSchema.safeParse({ role: "superadmin" });
    expect(result.success).toBe(false);
  });
});

describe("adminUpdateMemberSchema", () => {
  it("空オブジェクトは部分更新として有効", () => {
    const result = adminUpdateMemberSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("skillLevel が負の値で失敗する", () => {
    const result = adminUpdateMemberSchema.safeParse({ skillLevel: -1 });
    expect(result.success).toBe(false);
  });

  it("skillLevel が11で失敗する", () => {
    const result = adminUpdateMemberSchema.safeParse({ skillLevel: 11 });
    expect(result.success).toBe(false);
  });

  it.each([0, 1, 5, 10])("skillLevel %d は有効", (skillLevel) => {
    const result = adminUpdateMemberSchema.safeParse({ skillLevel });
    expect(result.success).toBe(true);
  });
});
