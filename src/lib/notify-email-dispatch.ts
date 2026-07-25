import crypto from "crypto";
import { prisma } from "./prisma";
import { sendEmail, buildFooter } from "./notify-email";
import { logActivity } from "./activity-log";

/**
 * 一括メール配信基盤。
 * recipientUserIds は呼び出し側で公開制御済み。ここでは
 * 「確認済み + 該当スイッチ ON」のユーザーだけに絞り込んで送る。
 */
export async function dispatchNotificationEmails(params: {
  type: "new_event" | "announcement";
  subject: string;
  body: string; // フッター抜きの本文
  recipientUserIds: string[];
}): Promise<void> {
  const { type, subject, body, recipientUserIds } = params;

  if (recipientUserIds.length === 0) return;

  // type に対応するスイッチを決定
  const switchField =
    type === "new_event" ? "notifyOnNewEvent" : "notifyOnAnnouncement";

  // 1クエリで「確認済み + スイッチON」のユーザーを取得
  const users = await prisma.user.findMany({
    where: {
      id: { in: recipientUserIds },
      notifyEmail: { not: null },
      notifyEmailVerifiedAt: { not: null },
      [switchField]: true,
    },
    select: {
      id: true,
      notifyEmail: true,
    },
  });

  if (users.length === 0) return;

  // unsubscribe トークンを一括取得
  const existingTokens = await prisma.emailToken.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      purpose: "unsubscribe",
    },
    select: { userId: true, token: true },
  });
  const tokenMap = new Map(existingTokens.map((t) => [t.userId, t.token]));

  // トークンが無いユーザーに新規発行
  const usersWithoutToken = users.filter((u) => !tokenMap.has(u.id));
  if (usersWithoutToken.length > 0) {
    const newTokens = usersWithoutToken.map((u) => ({
      token: crypto.randomBytes(32).toString("hex"),
      userId: u.id,
      purpose: "unsubscribe" as const,
      expiresAt: null,
    }));
    await prisma.emailToken.createMany({ data: newTokens });
    for (const t of newTokens) {
      tokenMap.set(t.userId, t.token);
    }
  }

  // 5件ずつバッチ送信
  const BATCH_SIZE = 5;
  let sent = 0;
  let failed = 0;

  try {
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((u) => {
          const unsubToken = tokenMap.get(u.id) ?? "";
          const fullBody = body + buildFooter(unsubToken);
          return sendEmail({ to: u.notifyEmail as string, subject, body: fullBody });
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          sent++;
        } else {
          failed++;
        }
      }
    }

    void logActivity({
      userId: null,
      action: "notify_email.bulk_send",
      metadata: { type, targeted: users.length, sent, failed },
    });
  } catch (err) {
    // 呼び出し元を止めない
    console.error("[notify-email-dispatch] 一括送信エラー:", err);
  }
}
