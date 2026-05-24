import { prisma } from "./prisma";

// アプリ内操作ログを記録する。fire-and-forget が原則 (本処理を止めない)。
// 利用状況分析・監査の両方を兼ねる。
//
// action 命名: "domain.verb" (例: "tournament.create", "tournament.list_view").
// entityType / entityId / metadata はオプション。
export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  metadata,
}: {
  userId: string | null | undefined;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: userId ?? null,
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (err) {
    // ログ保存失敗で本処理を止めない
    console.error("[activity-log] failed:", err);
  }
}
