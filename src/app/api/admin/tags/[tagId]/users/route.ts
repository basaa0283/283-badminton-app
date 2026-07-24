import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";

interface Params {
  params: Promise<{ tagId: string }>;
}

// PUT /api/admin/tags/[tagId]/users
// body: { userIds: string[] }
// このタグを持つメンバーを「与えられた userIds 配列の集合」に置き換える。
export async function PUT(request: NextRequest, { params }: Params) {
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
    const { tagId } = await params;
    const body = await request.json();
    const userIds = Array.isArray(body?.userIds)
      ? (body.userIds as unknown[]).filter((s): s is string => typeof s === "string")
      : [];

    const existing = await prisma.userMemberTag.findMany({
      where: { tagId },
      select: { userId: true },
    });
    const existingSet = new Set(existing.map((e) => e.userId));
    const nextSet = new Set(userIds);
    const toAdd = userIds.filter((id) => !existingSet.has(id));
    const toRemove = [...existingSet].filter((id) => !nextSet.has(id));

    await prisma.$transaction([
      prisma.userMemberTag.deleteMany({ where: { tagId, userId: { in: toRemove } } }),
      ...toAdd.map((userId) =>
        prisma.userMemberTag.create({ data: { tagId, userId } }),
      ),
    ]);

    for (const userId of toAdd) {
      void logActivity({
        userId: session.user.id,
        action: "member_tag.attach",
        entityType: "User",
        entityId: userId,
        metadata: { tagId },
      });
    }
    for (const userId of toRemove) {
      void logActivity({
        userId: session.user.id,
        action: "member_tag.detach",
        entityType: "User",
        entityId: userId,
        metadata: { tagId },
      });
    }

    return NextResponse.json({
      success: true,
      data: { added: toAdd.length, removed: toRemove.length },
    });
  } catch (error) {
    console.error("tag users PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}

// GET: このタグを持つユーザー ID リスト
export async function GET(_request: NextRequest, { params }: Params) {
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
    const { tagId } = await params;
    const rows = await prisma.userMemberTag.findMany({
      where: { tagId },
      select: { userId: true },
    });
    return NextResponse.json({
      success: true,
      data: { userIds: rows.map((r) => r.userId) },
    });
  } catch (error) {
    console.error("tag users GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
