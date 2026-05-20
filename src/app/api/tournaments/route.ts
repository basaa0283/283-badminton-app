import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { tournamentInputSchema } from "@/lib/validations";

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

    const isApprover = permissions.canApproveTournaments(role);
    const where = isApprover
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

    const tournaments = await prisma.tournament.findMany({
      where,
      orderBy: { heldAt: "desc" },
      include: {
        createdBy: { select: { id: true, nickname: true } },
        _count: { select: { results: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        heldAt: t.heldAt,
        tier: t.tier,
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
        tier: parsed.data.tier,
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
            order: c.order ?? idx,
            // 大会作成と同時に登録された行は approved 扱い (本体承認時に一緒に見える)
            approvalStatus: "approved",
            createdById: session.user.id,
          })),
        },
      },
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
