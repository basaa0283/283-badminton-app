import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";

// GET /api/admin/expense-report - 経費レポート（過去イベントの収支一覧）
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
        _count: { select: { attendances: { where: { status: "attending" } } } },
      },
    });

    const items = events.map((e) => {
      const totalCost = (e.shuttleCost ?? 0) + (e.gymCost ?? 0) + (e.otherCost ?? 0);
      const profit = e.actualRevenue !== null ? e.actualRevenue - totalCost : null;
      return {
        id: e.id,
        title: e.title,
        eventDate: e.eventDate,
        attendingCount: e._count.attendances,
        fee: e.fee,
        shuttleCount: e.shuttleCount,
        shuttleCost: e.shuttleCost,
        gymCost: e.gymCost,
        otherCost: e.otherCost,
        otherMemo: e.otherMemo,
        actualRevenue: e.actualRevenue,
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
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
