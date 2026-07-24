import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";

// GET /api/admin/tags - メンバータグ一覧 (各タグの付与人数も返す)
// POST /api/admin/tags - 新規タグ作成

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    if (!permissions.canAccessAdmin(session.user.role as UserRole)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 },
      );
    }
    const tags = await prisma.memberTag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true, events: true } } },
    });
    return NextResponse.json({
      success: true,
      data: tags.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        color: t.color,
        userCount: t._count.users,
        eventCount: t._count.events,
      })),
    });
  } catch (error) {
    console.error("tags GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    if (!permissions.canAccessAdmin(session.user.role as UserRole)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 },
      );
    }
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "タグ名は必須です" } },
        { status: 400 },
      );
    }
    if (name.length > 100) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "タグ名は 100 文字以内で入力してください" } },
        { status: 400 },
      );
    }
    const description = typeof body?.description === "string" ? body.description : null;
    const color = typeof body?.color === "string" ? body.color : null;

    const existing = await prisma.memberTag.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE", message: "同名のタグがあります" } },
        { status: 409 },
      );
    }

    const tag = await prisma.memberTag.create({
      data: { name, description, color },
    });
    void logActivity({
      userId: session.user.id,
      action: "member_tag.create",
      entityType: "MemberTag",
      entityId: tag.id,
      metadata: { name },
    });
    return NextResponse.json({ success: true, data: tag });
  } catch (error) {
    console.error("tags POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
