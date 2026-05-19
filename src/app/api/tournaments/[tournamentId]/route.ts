import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { tournamentInputSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ tournamentId: string }>;
}

// GET /api/tournaments/[tournamentId] - 大会詳細 + 成績一覧
export async function GET(_request: NextRequest, { params }: Params) {
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

    const { tournamentId } = await params;
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        createdBy: { select: { id: true, nickname: true } },
        results: {
          orderBy: [{ category: "asc" }, { className: "asc" }, { createdAt: "asc" }],
          include: {
            user: {
              select: { id: true, nickname: true, profileImageUrl: true },
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: tournament });
  } catch (error) {
    console.error("Tournament GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}

// PUT /api/tournaments/[tournamentId] - 大会マスター編集
// 自分が登録した大会、または管理者のみ
export async function PUT(request: NextRequest, { params }: Params) {
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

    const { tournamentId } = await params;
    const existing = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }
    if (existing.createdById !== session.user.id && !permissions.canAccessAdmin(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "他の人が登録した大会は管理者のみ編集できます" } },
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

    const tournament = await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        name: parsed.data.name,
        heldAt: new Date(parsed.data.heldAt),
        tier: parsed.data.tier,
        format: parsed.data.format,
        classCount: parsed.data.classCount ?? null,
        location: parsed.data.location ?? null,
        description: parsed.data.description ?? null,
      },
    });

    return NextResponse.json({ success: true, data: tournament });
  } catch (error) {
    console.error("Tournament PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}

// DELETE /api/tournaments/[tournamentId] - 大会マスター削除
// 自分が登録した大会、または管理者のみ。成績は cascade 削除。
export async function DELETE(_request: NextRequest, { params }: Params) {
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

    const { tournamentId } = await params;
    const existing = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }
    if (existing.createdById !== session.user.id && !permissions.canAccessAdmin(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    // SQL Server: TournamentResult の user 側 FK が NoAction なので明示的に先に削除
    await prisma.$transaction(async (tx) => {
      await tx.tournamentResult.deleteMany({ where: { tournamentId } });
      await tx.tournament.delete({ where: { id: tournamentId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tournament DELETE error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
