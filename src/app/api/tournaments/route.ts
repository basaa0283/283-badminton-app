import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { tournamentInputSchema } from "@/lib/validations";

// GET /api/tournaments - 大会マスター一覧
// 表示は member 以上。新しい順 (heldAt desc) で全件返す。
export async function GET() {
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

    const tournaments = await prisma.tournament.findMany({
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
        format: t.format,
        classCount: t.classCount,
        location: t.location,
        description: t.description,
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
        format: parsed.data.format,
        classCount: parsed.data.classCount ?? null,
        location: parsed.data.location ?? null,
        description: parsed.data.description ?? null,
        createdById: session.user.id,
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
