import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import {
  tournamentResultInputSchema,
  adminTournamentResultInputSchema,
} from "@/lib/validations";

interface Params {
  params: Promise<{ tournamentId: string }>;
}

// POST /api/tournaments/[tournamentId]/results
// 本人の成績を登録 (userId はセッションから決定)。
// 管理者は body に userId を付けて他人の成績も登録できる。
//
// 大会が approved でないときは登録を拒否する (admin だけは本人テスト用に許可)。
// tournamentClassId は同じ大会の class でなければエラー。
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

    if (
      tournament.approvalStatus !== "approved" &&
      !permissions.canApproveTournaments(role)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_APPROVED", message: "この大会は承認待ちのため成績登録できません" },
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const isAdmin = permissions.canAccessAdmin(role);
    // admin の場合でも、body に userId が含まれている時だけ「他人の成績登録」モード。
    // 含まれていなければ自分用なので通常スキーマで検証する (admin が自分の成績を
    // 追加するときに userId 必須エラーになるのを防ぐ)。
    const hasExplicitUserId =
      isAdmin && typeof body?.userId === "string" && body.userId.length > 0;
    const schema = hasExplicitUserId
      ? adminTournamentResultInputSchema
      : tournamentResultInputSchema;
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
        },
        { status: 400 }
      );
    }

    // 管理者の場合のみ body.userId を反映。一般メンバーは常に自分。
    const adminBody = parsed.data as unknown as { userId?: string };
    const targetUserId: string =
      isAdmin && typeof adminBody.userId === "string" && adminBody.userId.length > 0
        ? adminBody.userId
        : session.user.id;

    // tournamentClassId が指定されている場合は、同じ大会のクラスかを検証
    if (parsed.data.tournamentClassId) {
      const cls = await prisma.tournamentClass.findUnique({
        where: { id: parsed.data.tournamentClassId },
      });
      if (!cls || cls.tournamentId !== tournamentId) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "クラスの指定が不正です" } },
          { status: 400 }
        );
      }
    }

    const result = await prisma.tournamentResult.create({
      data: {
        tournamentId,
        tournamentClassId: parsed.data.tournamentClassId ?? null,
        userId: targetUserId,
        category: parsed.data.category,
        rank: parsed.data.rank ?? null,
        partnerName: parsed.data.partnerName ?? null,
        note: parsed.data.note ?? null,
        isPublic: parsed.data.isPublic ?? false,
      },
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("Tournament result POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
