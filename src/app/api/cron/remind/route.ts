import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyEventReminder } from "@/lib/line-messaging";
import { formatInTimeZone } from "date-fns-tz";
import { ja } from "date-fns/locale";
import { dispatchNotificationEmails } from "@/lib/notify-email-dispatch";
import { getDefaultTenantId } from "@/lib/tenant";

// リマインダーウィンドウ（時間）: 前日 & 当日
const REMINDER_WINDOWS = [
  { hoursUntil: 24, label: "24h" },
  { hoursUntil: 2, label: "2h" },
];
// 各ウィンドウの許容誤差（分）: cron が多少ずれても重複送信しない
const WINDOW_TOLERANCE_MINUTES = 30;

// GET /api/cron/remind
// Azure Scheduler や cron-job.org から定期的に呼び出す
// Header: Authorization: Bearer {CRON_SECRET}
//
// マルチテナント対応 (P5): 全テナント (active) のイベントを対象にする。
// - メールリマインダー: 全テナント。件名はテナント名、リンクは slug 付き URL
// - LINE リマインダー: デフォルトテナント (28ばど) のみ
//   (方針 2026-09-15: 他テナントの通知はメールのみ。LINE の userId はチャネル単位の
//    ため、28ばど のチャネルから他テナント宛てに送っても届かない)
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const now = new Date();
  let totalSent = 0;

  const defaultTenantId = await getDefaultTenantId();
  // active テナントの一覧 (frozen / pending は通知対象外)
  const tenants = await prisma.tenant.findMany({
    where: { status: "active" },
    select: { id: true, slug: true, name: true },
  });
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));

  for (const window of REMINDER_WINDOWS) {
    // ターゲット時刻 = now + hoursUntil ± tolerance
    const targetFrom = new Date(now.getTime() + (window.hoursUntil * 60 - WINDOW_TOLERANCE_MINUTES) * 60 * 1000);
    const targetTo = new Date(now.getTime() + (window.hoursUntil * 60 + WINDOW_TOLERANCE_MINUTES) * 60 * 1000);

    const events = await prisma.event.findMany({
      where: { eventDate: { gte: targetFrom, lte: targetTo } },
      include: {
        attendances: {
          where: { status: "attending" },
          include: { user: { select: { id: true, lineId: true, nickname: true } } },
        },
      },
    });

    for (const event of events) {
      // 終日イベントは 24h 前 (前日 00:00 = 深夜) では送らず、2h 前 (前日 22:00 ≒ 前日夜) のみ送る
      if (event.isAllDay && window.hoursUntil >= 24) continue;

      // tenantId=null は理論上存在しない (backfill 済み) が、保険としてデフォルト扱い
      const tenant = tenantMap.get(event.tenantId ?? defaultTenantId);
      if (!tenant) continue; // frozen / pending テナントのイベントには送らない
      const isDefaultTenant = tenant.id === defaultTenantId;

      // LINE リマインダー (デフォルトテナントのみ)
      if (isDefaultTenant) {
        for (const attendance of event.attendances) {
          if (!attendance.user.lineId) continue;
          try {
            await notifyEventReminder({
              lineId: attendance.user.lineId,
              eventTitle: event.title,
              eventDate: event.eventDate,
              location: event.location,
              hoursUntil: window.hoursUntil,
            });
            totalSent++;
          } catch (err) {
            console.error(`[cron/remind] failed for user ${attendance.user.nickname}:`, err);
          }
        }
      }

      // メール リマインダー (全テナント、LINE と同じ参加確定者)
      const attendingUserIds = event.attendances.map((a) => a.user.id);
      if (attendingUserIds.length > 0) {
        const dateStr = event.isAllDay
          ? formatInTimeZone(event.eventDate, "Asia/Tokyo", "M月d日(E)", { locale: ja }) + " 終日"
          : formatInTimeZone(event.eventDate, "Asia/Tokyo", "M月d日(E) HH:mm", { locale: ja });
        const appUrl = process.env.NEXTAUTH_URL ?? "";
        const bodyLines = [
          `【リマインダー】${event.title}`,
          "",
          `📅 ${dateStr}`,
          ...(event.location ? [`📍 ${event.location}`] : []),
          "",
          `詳細: ${appUrl}/${tenant.slug}/events/${event.id}`,
        ];
        await dispatchNotificationEmails({
          type: "reminder",
          subject: `【${tenant.name}】リマインダー: ${event.title}`,
          body: bodyLines.join("\n"),
          recipientUserIds: attendingUserIds,
        });
      }
    }
  }

  console.log(`[cron/remind] sent ${totalSent} reminders at ${now.toISOString()}`);
  return NextResponse.json({ success: true, sent: totalSent });
}
