import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { tournamentClassApprovalSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ classId: string }>;
}

// PUT /api/tournament-classes/[classId]/approval
// TournamentClass 単体の承認 / 却下。
//   approve: approvalStatus="approved" + approvedById + approvedAt セット
//   reject:  クラスを削除 (運用上、却下クラスを残すと UI ノイズになるため)
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
    if (!permissions.canApproveTournaments(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    const { classId } = await params;
    const existing = await prisma.tournamentClass.findUnique({ where: { id: classId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = tournamentClassApprovalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
        },
        { status: 400 }
      );
    }

    if (parsed.data.action === "approve") {
      const updated = await prisma.tournamentClass.update({
        where: { id: classId },
        data: {
          approvalStatus: "approved",
          approvedById: session.user.id,
          approvedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, data: updated });
    } else {
      // 却下: クラスを削除 (紐づく成績は tournamentClassId が NoAction なので、
      // まず明示的に tournamentClassId を null に戻してから消す)
      await prisma.$transaction(async (tx) => {
        await tx.tournamentResult.updateMany({
          where: { tournamentClassId: classId },
          data: { tournamentClassId: null },
        });
        await tx.tournamentClass.delete({ where: { id: classId } });
      });
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Tournament class approval PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
