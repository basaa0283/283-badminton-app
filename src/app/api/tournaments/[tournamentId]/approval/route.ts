import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { tournamentApprovalSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-log";

interface Params {
  params: Promise<{ tournamentId: string }>;
}

// PUT /api/tournaments/[tournamentId]/approval
// 大会マスターの承認 / 却下。canApproveTournaments を満たすロールのみ。
//   action = "approve": approved + approvedById + approvedAt セット
//   action = "reject":  rejected + rejectionReason セット
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

    const { tournamentId } = await params;
    const existing = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = tournamentApprovalSchema.safeParse(body);
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
      const updated = await prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          approvalStatus: "approved",
          approvedById: session.user.id,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });
      void logActivity({
        userId: session.user.id,
        action: "tournament.approve",
        entityType: "Tournament",
        entityId: tournamentId,
        metadata: { name: existing.name },
      });
      return NextResponse.json({ success: true, data: updated });
    } else {
      const updated = await prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          approvalStatus: "rejected",
          approvedById: session.user.id,
          approvedAt: new Date(),
          rejectionReason: parsed.data.rejectionReason ?? null,
        },
      });
      void logActivity({
        userId: session.user.id,
        action: "tournament.reject",
        entityType: "Tournament",
        entityId: tournamentId,
        metadata: { name: existing.name, reason: parsed.data.rejectionReason },
      });
      return NextResponse.json({ success: true, data: updated });
    }
  } catch (error) {
    console.error("Tournament approval PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
