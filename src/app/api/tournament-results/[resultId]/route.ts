import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { tournamentResultInputSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ resultId: string }>;
}

// PUT /api/tournament-results/[resultId] - 成績編集
// 本人または admin。tournamentClassId は同じ大会内のクラスかを検証。
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

    if (parsed.data.tournamentClassId) {
      const cls = await prisma.tournamentClass.findUnique({
        where: { id: parsed.data.tournamentClassId },
      });
      if (!cls || cls.tournamentId !== existing.tournamentId) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "クラスの指定が不正です" } },
          { status: 400 }
        );
      }
    }

    // 公開できる成績は 1 ユーザーあたり 5 件まで。
    // 既に非公開 → 公開へ切り替える場合は 5 件枠を超えないかチェック。
    if (parsed.data.isPublic && !existing.isPublic) {
      const publicCount = await prisma.tournamentResult.count({
        where: { userId: existing.userId, isPublic: true },
      });
      if (publicCount >= 5) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "PUBLIC_LIMIT_REACHED",
              message: "公開できる大会成績は5件までです。先に他の成績を非公開にしてください。",
            },
          },
          { status: 400 }
        );
      }
    }

    const result = await prisma.tournamentResult.update({
      where: { id: resultId },
      data: {
        category: parsed.data.category,
        tournamentClassId: parsed.data.tournamentClassId ?? null,
        rank: parsed.data.rank ?? null,
        partnerName: parsed.data.partnerName ?? null,
        note: parsed.data.note ?? null,
        isPublic: parsed.data.isPublic ?? false,
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
