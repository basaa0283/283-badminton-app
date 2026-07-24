import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyEventReminder } from "@/lib/line-messaging";

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
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const now = new Date();
  let totalSent = 0;

  for (const window of REMINDER_WINDOWS) {
    // ターゲット時刻 = now + hoursUntil ± tolerance
    const targetFrom = new Date(now.getTime() + (window.hoursUntil * 60 - WINDOW_TOLERANCE_MINUTES) * 60 * 1000);
    const targetTo = new Date(now.getTime() + (window.hoursUntil * 60 + WINDOW_TOLERANCE_MINUTES) * 60 * 1000);

    const events = await prisma.event.findMany({
      where: { eventDate: { gte: targetFrom, lte: targetTo } },
      include: {
        attendances: {
          where: { status: "attending" },
          include: { user: { select: { lineId: true, nickname: true } } },
        },
      },
    });

    for (const event of events) {
      // 終日イベントは 24h 前 (前日 00:00 = 深夜) では送らず、2h 前 (前日 22:00 ≒ 前日夜) のみ送る
      if (event.isAllDay && window.hoursUntil >= 24) continue;
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
  }

  console.log(`[cron/remind] sent ${totalSent} reminders at ${now.toISOString()}`);
  return NextResponse.json({ success: true, sent: totalSent });
}
