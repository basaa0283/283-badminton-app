import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { tournamentInputSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ tournamentId: string }>;
}

// GET /api/tournaments/[tournamentId] - 大会詳細 (classes + results を含む)
// 表示条件:
//   - approved: member 以上なら全員見える
//   - pending / rejected: 本人 (createdById) または admin のみ
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
        classes: {
          orderBy: [{ category: "asc" }, { order: "asc" }, { name: "asc" }],
        },
        results: {
          orderBy: [{ category: "asc" }, { createdAt: "asc" }],
          include: {
            user: {
              select: { id: true, nickname: true, profileImageUrl: true },
            },
            tournamentClass: {
              select: {
                id: true,
                category: true,
                name: true,
                tier: true,
                order: true,
                approvalStatus: true,
              },
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

    // 承認前は本人と admin だけが見られる
    if (
      tournament.approvalStatus !== "approved" &&
      tournament.createdById !== session.user.id &&
      !permissions.canApproveTournaments(role)
    ) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    // 公開フラグ: admin と本人以外には非公開の結果を返さない。
    // (canAccessAdmin = admin / subadmin はサークル運営として全件閲覧可能)
    const isAdmin = permissions.canAccessAdmin(role);
    if (!isAdmin) {
      tournament.results = tournament.results.filter(
        (r) => r.isPublic || r.userId === session.user.id
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
// - 自分が登録した大会、または admin のみ
// - 編集すると approvalStatus は pending に戻す (admin 自身の編集を除く)
// - classes を丸ごと差し替え。既存 result が紐づくクラスが消える場合は
//   tournamentClassId = NULL に逃がす (画面側でクラス再選択を促す)
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
    const isApprover = permissions.canApproveTournaments(role);
    if (existing.createdById !== session.user.id && !isApprover) {
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

    // 一般メンバーが編集した場合は再度 pending に戻す。admin の編集はそのまま。
    const resetApproval = !isApprover && existing.approvalStatus === "approved";

    const updated = await prisma.$transaction(async (tx) => {
      // クラスを丸ごと差し替え。既存 result の tournamentClassId は外す。
      await tx.tournamentResult.updateMany({
        where: { tournamentId },
        data: { tournamentClassId: null },
      });
      await tx.tournamentClass.deleteMany({ where: { tournamentId } });
      await tx.tournamentClass.createMany({
        data: (parsed.data.classes ?? []).map((c, idx) => ({
          tournamentId,
          category: c.category,
          name: c.name ?? null,
          tier: c.tier ?? null,
          order: c.order ?? idx,
          approvalStatus: "approved",
          createdById: session.user.id,
        })),
      });

      return tx.tournament.update({
        where: { id: tournamentId },
        data: {
          name: parsed.data.name,
          heldAt: new Date(parsed.data.heldAt),
          openness: parsed.data.openness ?? "open",
          prefecture: parsed.data.prefecture ?? null,
          format: parsed.data.format,
          location: parsed.data.location ?? null,
          description: parsed.data.description ?? null,
          ...(resetApproval
            ? {
                approvalStatus: "pending",
                approvedById: null,
                approvedAt: null,
                rejectionReason: null,
              }
            : {}),
        },
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Tournament PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}

// DELETE /api/tournaments/[tournamentId] - 大会マスター削除
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
    if (existing.createdById !== session.user.id && !permissions.canApproveTournaments(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    // SQL Server: result の user FK が NoAction なので明示的に先に削除
    await prisma.$transaction(async (tx) => {
      await tx.tournamentResult.deleteMany({ where: { tournamentId } });
      await tx.tournamentClass.deleteMany({ where: { tournamentId } });
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
