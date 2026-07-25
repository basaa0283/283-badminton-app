import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/public/upcoming-events
// 認証不要。未ログインの見学検討者向けに「直近のゲスト向けイベント」を返す。
// 対象: minViewRole="guest" (= 公開度が最も高い) かつ未来 かつ 非公開 (draft) でないもの
// 出す情報: 日時 / カテゴリ名 / 空き状況アイコンだけ。場所や説明、参加費、参加者は返さない
// (部外者が晒せるほど詳細を出さない方針)
export async function GET() {
  try {
    const now = new Date();
    const events = await prisma.event.findMany({
      where: {
        eventDate: { gte: now },
        minViewRole: "guest",
        status: "published",
      },
      orderBy: { eventDate: "asc" },
      take: 8, // 直近 8 件まで
      select: {
        id: true,
        eventDate: true,
        eventEndDate: true,
        isAllDay: true,
        capacity: true,
        category: { select: { name: true, color: true } },
        _count: { select: { attendances: { where: { status: "attending" } } } },
      },
    });

    const data = events.map((e) => {
      const attending = e._count.attendances;
      // ○ / △ / × を空き状況として返す。具体人数は出さない。
      let availability: "open" | "few" | "full";
      if (e.capacity === null) availability = "open";
      else if (attending >= e.capacity) availability = "full";
      else if (attending >= e.capacity * 0.8) availability = "few";
      else availability = "open";
      return {
        id: e.id,
        eventDate: e.eventDate,
        eventEndDate: e.eventEndDate,
        isAllDay: e.isAllDay,
        category: e.category ? { name: e.category.name, color: e.category.color } : null,
        availability,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("public upcoming-events error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
