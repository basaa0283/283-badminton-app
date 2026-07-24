import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";

// GET /api/admin/expense-report - 経費レポート（過去イベントの収支一覧）
// shuttleCost は「個数 × イベント日時点の適用単価」で都度算出。
// actualRevenue は attendings の paid 合計から算出。
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }
    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    }

    const events = await prisma.event.findMany({
      where: { eventDate: { lt: new Date() } },
      orderBy: { eventDate: "desc" },
      take: 50,
      include: {
        attendances: {
          where: { status: "attending" },
          select: { paymentStatus: true, paymentAmount: true },
        },
      },
    });

    // ShuttlePrice は全件読み込み (テーブル未マイグレーション等の障害には備える)
    let prices: { effectiveFrom: Date; casePrice: number; shuttlesPerCase: number }[] = [];
    try {
      prices = await prisma.shuttlePrice.findMany({
        orderBy: { effectiveFrom: "desc" },
        select: { effectiveFrom: true, casePrice: true, shuttlesPerCase: true },
      });
    } catch (err) {
      console.warn("[expense-report] ShuttlePrice query failed:", err);
    }

    const applicablePriceFor = (eventDate: Date) =>
      prices.find((p) => p.effectiveFrom <= eventDate) ?? null;

    const items = events.map((e) => {
      const price = applicablePriceFor(e.eventDate);
      const shuttleCost =
        e.shuttleCount !== null && price
          ? Math.round(e.shuttleCount * (price.casePrice / price.shuttlesPerCase))
          : null;

      const paid = e.attendances.filter((a) => a.paymentStatus === "paid");
      const computedActualRevenue =
        paid.length > 0
          ? paid.reduce((sum, a) => sum + (a.paymentAmount ?? e.fee ?? 0), 0)
          : (e.actualRevenue ?? null);

      const totalCost = (shuttleCost ?? 0) + (e.gymCost ?? 0) + (e.otherCost ?? 0);
      const profit =
        computedActualRevenue !== null ? computedActualRevenue - totalCost : null;

      return {
        id: e.id,
        title: e.title,
        eventDate: e.eventDate,
        attendingCount: e.attendances.length,
        fee: e.fee,
        shuttleCount: e.shuttleCount,
        shuttleCost,
        gymCost: e.gymCost,
        otherCost: e.otherCost,
        otherMemo: e.otherMemo,
        actualRevenue: computedActualRevenue,
        totalCost,
        profit,
      };
    });

    const summary = items.reduce(
      (acc, e) => {
        acc.totalCost += e.totalCost;
        acc.totalRevenue += e.actualRevenue ?? 0;
        if (e.profit !== null) acc.totalProfit += e.profit;
        return acc;
      },
      { totalCost: 0, totalRevenue: 0, totalProfit: 0 }
    );

    return NextResponse.json({ success: true, data: { items, summary } });
  } catch (error) {
    console.error("GET /api/admin/expense-report error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
