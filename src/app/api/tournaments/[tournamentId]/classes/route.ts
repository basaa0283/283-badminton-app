import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { tournamentClassProposalSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ tournamentId: string }>;
}

// POST /api/tournaments/[tournamentId]/classes
// 既に登録された大会に対して「種目 + クラス」を追加申請する。
// approvalStatus = "pending" として作成され、admin が個別承認する。
// 大会本体が approved である必要がある (pending な大会は本体編集で対応してもらう)。
export async function POST(request: NextRequest, { params }: Params) {
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
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }
    if (tournament.approvalStatus !== "approved") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_APPROVED", message: "未承認の大会に追加申請はできません" },
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = tournamentClassProposalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
        },
        { status: 400 }
      );
    }

    // admin が直接追加する場合は即 approved、一般メンバーの追加は pending
    const isApprover = permissions.canApproveTournaments(role);
    const cls = await prisma.tournamentClass.create({
      data: {
        tournamentId,
        category: parsed.data.category,
        name: parsed.data.name ?? null,
        tier: parsed.data.tier ?? null,
        order: parsed.data.order ?? 0,
        approvalStatus: isApprover ? "approved" : "pending",
        proposalNote: parsed.data.proposalNote ?? null,
        createdById: session.user.id,
        approvedById: isApprover ? session.user.id : null,
        approvedAt: isApprover ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, data: cls }, { status: 201 });
  } catch (error) {
    console.error("Tournament class POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
