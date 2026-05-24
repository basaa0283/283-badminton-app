import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { tournamentInputSchema } from "@/lib/validations";
import { sendAdminNotification } from "@/lib/email";
import { logActivity } from "@/lib/activity-log";

// GET /api/tournaments - 大会マスター一覧
//   - 一般メンバー: approved のみ + 自分が登録した pending (本人にだけ可視)
//   - admin (canApproveTournaments): 全件返す (UI 側で承認待ち/承認済みを区別)
// 並び順は heldAt desc。
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }
    const role = session.user.role as UserRole;
    if (!permissions.canViewTournaments(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status"); // optional: "pending" | "approved" | "rejected"
    // 重複検出用: 指定日 (YYYY-MM-DD) と同じ heldAt の大会だけに絞る
    const dateFilter = searchParams.get("date");

    const isApprover = permissions.canApproveTournaments(role);
    const baseWhere: Record<string, unknown> = isApprover
      ? statusFilter
        ? { approvalStatus: statusFilter }
        : {}
      : {
          // 一般メンバー: approved 全件 + 自分の pending
          OR: [
            { approvalStatus: "approved" },
            { createdById: session.user.id, approvalStatus: { in: ["pending", "rejected"] } },
          ],
        };

    if (dateFilter && /^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
      // heldAt は UTC 00:00:00Z で保存しているので、丸 1 日の範囲で絞る
      const start = new Date(`${dateFilter}T00:00:00Z`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      baseWhere.heldAt = { gte: start, lt: end };
    } else {
      // 一覧表示時のデフォルト遡及期間 (月数)。
      // 大会は月数件想定なので、12 か月をデフォルト。
      // 「もっと前を見る」で広げる。dateFilter (重複検出) と同時には使わない。
      const monthsBackParam = Number(searchParams.get("monthsBack"));
      const monthsBack =
        Number.isFinite(monthsBackParam) && monthsBackParam > 0
          ? Math.min(Math.floor(monthsBackParam), 240) // 上限 20 年
          : 12;
      const now = new Date();
      const pastStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
      // 未来の大会も含めて返したいので gte だけにする (lt は付けない)
      baseWhere.heldAt = { gte: pastStart };
    }

    const where = baseWhere;

    const tournaments = await prisma.tournament.findMany({
      where,
      orderBy: { heldAt: "desc" },
      include: {
        createdBy: { select: { id: true, nickname: true } },
        _count: { select: { results: true } },
        // 一覧の種目タグ表示に使う。approved な class の category だけを集める。
        classes: {
          where: { approvalStatus: "approved" },
          select: { category: true },
        },
      },
    });

    // 利用状況分析: 一覧アクセスを記録 (フィルタ条件もメタデータに残す)
    void logActivity({
      userId: session.user.id,
      action: "tournament.list_view",
      metadata: {
        monthsBack: searchParams.get("monthsBack") ?? undefined,
        date: searchParams.get("date") ?? undefined,
        resultCount: tournaments.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        heldAt: t.heldAt,
        openness: t.openness,
        prefecture: t.prefecture,
        format: t.format,
        location: t.location,
        description: t.description,
        approvalStatus: t.approvalStatus,
        approvedAt: t.approvedAt,
        rejectionReason: t.rejectionReason,
        createdBy: t.createdBy,
        resultCount: t._count.results,
        // 重複を除いた category の一覧 (MS/WS/MD/WD/XD/other) を返す
        categories: Array.from(new Set(t.classes.map((c) => c.category))),
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("Tournaments GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}

// POST /api/tournaments - 大会マスター登録 (member 以上)
// 新規登録は常に approvalStatus = "pending"。
// classes 配列 (ネスト) を同時に作成する。
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }
    const role = session.user.role as UserRole;
    if (!permissions.canManageTournaments(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = tournamentInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
        },
        { status: 400 }
      );
    }

    const tournament = await prisma.tournament.create({
      data: {
        name: parsed.data.name,
        heldAt: new Date(parsed.data.heldAt),
        openness: parsed.data.openness ?? "open",
        prefecture: parsed.data.prefecture ?? null,
        format: parsed.data.format,
        location: parsed.data.location ?? null,
        description: parsed.data.description ?? null,
        createdById: session.user.id,
        approvalStatus: "pending",
        classes: {
          create: (parsed.data.classes ?? []).map((c, idx) => ({
            category: c.category,
            name: c.name ?? null,
            tier: c.tier ?? null,
            order: c.order ?? idx,
            // 大会作成と同時に登録された行は approved 扱い (本体承認時に一緒に見える)
            approvalStatus: "approved",
            createdById: session.user.id,
          })),
        },
      },
    });

    // 管理者に承認依頼メール (fire-and-forget)。
    // メール失敗で大会作成が落ちないように非同期で投げて log だけ取る。
    const appUrl =
      process.env.NEXTAUTH_URL ||
      "https://prod-283-badminton-app-gsacfjcnezadeugd.japanwest-01.azurewebsites.net";
    void sendAdminNotification({
      subject: `[大会] 承認待ち: ${tournament.name}`,
      body: [
        `新しい大会が登録され、承認待ちになっています。`,
        ``,
        `大会名: ${tournament.name}`,
        `開催日: ${new Date(tournament.heldAt).toISOString().slice(0, 10)}`,
        `登録者: ${session.user.name ?? session.user.id}`,
        ``,
        `承認画面:`,
        `${appUrl}/tournaments/${tournament.id}`,
      ].join("\n"),
    }).catch((err) => console.error("[tournaments] approval mail failed:", err));

    void logActivity({
      userId: session.user.id,
      action: "tournament.create",
      entityType: "Tournament",
      entityId: tournament.id,
      metadata: { name: tournament.name, classCount: parsed.data.classes?.length ?? 0 },
    });

    return NextResponse.json({ success: true, data: tournament }, { status: 201 });
  } catch (error) {
    console.error("Tournaments POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
