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

    const body = await request.json();
    const isAdmin = permissions.canAccessAdmin(role);
    const schema = isAdmin
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

    const result = await prisma.tournamentResult.create({
      data: {
        tournamentId,
        userId: targetUserId,
        category: parsed.data.category,
        className: parsed.data.className ?? null,
        rank: parsed.data.rank ?? null,
        partnerName: parsed.data.partnerName ?? null,
        note: parsed.data.note ?? null,
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
