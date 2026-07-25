import { describe, it, expect, beforeEach, vi } from "vitest";

// prisma と sendEmail を mock 化
vi.mock("./prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    emailToken: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("./notify-email", () => ({
  sendEmail: vi.fn(),
  buildFooter: vi.fn((token: string) => `\n\n--\n配信停止: https://example.com/email/unsubscribe?token=${token}`),
}));

vi.mock("./activity-log", () => ({
  logActivity: vi.fn(),
}));

import { dispatchNotificationEmails } from "./notify-email-dispatch";
import { prisma } from "./prisma";
import { sendEmail } from "./notify-email";

describe("dispatchNotificationEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("対象0件なら sendEmail が呼ばれない", async () => {
    await dispatchNotificationEmails({
      type: "new_event",
      subject: "テスト",
      body: "本文",
      recipientUserIds: [],
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("スイッチ OFF のユーザーには送らない (findMany が空を返す場合)", async () => {
    // findMany がフィルタ済みで 0 件返す = スイッチ OFF ユーザーのみ
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await dispatchNotificationEmails({
      type: "new_event",
      subject: "テスト",
      body: "本文",
      recipientUserIds: ["user-1"],
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("未確認 (verifiedAt null) のユーザーには送らない (DB フィルタで除外済みとして0件)", async () => {
    // DB 側で notifyEmailVerifiedAt != null をフィルタしているので
    // モックが 0 件を返した = 未確認は除外された
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await dispatchNotificationEmails({
      type: "announcement",
      subject: "お知らせ",
      body: "本文",
      recipientUserIds: ["user-unverified"],
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("unsubscribe トークンが無いユーザーには新規発行される", async () => {
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "user-1", notifyEmail: "user1@example.com" },
    ]);
    // 既存トークンなし
    (prisma.emailToken.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.emailToken.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await dispatchNotificationEmails({
      type: "new_event",
      subject: "テスト",
      body: "本文",
      recipientUserIds: ["user-1"],
    });

    expect(prisma.emailToken.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "user-1", purpose: "unsubscribe" }),
        ]),
      })
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("既存トークンがあるユーザーは createMany を呼ばない", async () => {
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "user-2", notifyEmail: "user2@example.com" },
    ]);
    (prisma.emailToken.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { userId: "user-2", token: "existing-token-abc" },
    ]);
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await dispatchNotificationEmails({
      type: "announcement",
      subject: "お知らせ",
      body: "本文",
      recipientUserIds: ["user-2"],
    });

    expect(prisma.emailToken.createMany).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("reminder タイプは notifyOnReminder スイッチでフィルタされる", async () => {
    // notifyOnReminder=true のユーザーが findMany で返る想定
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "user-r", notifyEmail: "reminder@example.com" },
    ]);
    (prisma.emailToken.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { userId: "user-r", token: "token-r" },
    ]);
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await dispatchNotificationEmails({
      type: "reminder",
      subject: "【２８ばど】リマインダー: テストイベント",
      body: "明日のイベントです",
      recipientUserIds: ["user-r"],
    });

    // findMany の where に notifyOnReminder: true が渡されることを確認
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ notifyOnReminder: true }),
      }),
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("event_message タイプは notifyOnEventMessage スイッチでフィルタされる", async () => {
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "user-m", notifyEmail: "message@example.com" },
    ]);
    (prisma.emailToken.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { userId: "user-m", token: "token-m" },
    ]);
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await dispatchNotificationEmails({
      type: "event_message",
      subject: "【２８ばど】7/26 テストイベント の連絡",
      body: "当日の連絡事項です",
      recipientUserIds: ["user-m"],
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ notifyOnEventMessage: true }),
      }),
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
