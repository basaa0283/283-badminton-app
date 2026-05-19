import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { tournamentResultInputSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ resultId: string }>;
}

// PUT /api/tournament-results/[resultId]
// 本人のみ編集可。管理者は他人のも編集可。
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

    const { resultId } = await params;
    const existing = await prisma.tournamentResult.findUnique({ where: { id: resultId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }
    if (existing.userId !== session.user.id && !permissions.canAccessAdmin(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = tournamentResultInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
        },
        { status: 400 }
      );
    }

    const result = await prisma.tournamentResult.update({
      where: { id: resultId },
      data: {
        category: parsed.data.category,
        className: parsed.data.className ?? null,
        rank: parsed.data.rank ?? null,
        partnerName: parsed.data.partnerName ?? null,
        note: parsed.data.note ?? null,
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Tournament result PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}

// DELETE /api/tournament-results/[resultId]
// 本人または管理者
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

    const { resultId } = await params;
    const existing = await prisma.tournamentResult.findUnique({ where: { id: resultId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }
    if (existing.userId !== session.user.id && !permissions.canAccessAdmin(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    await prisma.tournamentResult.delete({ where: { id: resultId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tournament result DELETE error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
