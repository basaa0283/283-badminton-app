import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";

interface Params {
  params: Promise<{ userId: string }>;
}

// PUT /api/admin/members/[userId]/tags
// body: { tagIds: string[] }
// 指定ユーザーに割り当てられたタグ一覧を「与えられた tagIds 配列の集合」で置き換える。
// 既存と差分を取って attach/detach のログを記録する。
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
    const { userId } = await params;
    const body = await request.json();
    const tagIds = Array.isArray(body?.tagIds)
      ? (body.tagIds as unknown[]).filter((s): s is string => typeof s === "string")
      : [];

    const existing = await prisma.userMemberTag.findMany({
      where: { userId },
      select: { tagId: true },
    });
    const existingSet = new Set(existing.map((e) => e.tagId));
    const nextSet = new Set(tagIds);
    const toAdd = tagIds.filter((id) => !existingSet.has(id));
    const toRemove = [...existingSet].filter((id) => !nextSet.has(id));

    await prisma.$transaction([
      prisma.userMemberTag.deleteMany({ where: { userId, tagId: { in: toRemove } } }),
      ...toAdd.map((tagId) =>
        prisma.userMemberTag.create({ data: { userId, tagId } }),
      ),
    ]);

    for (const tagId of toAdd) {
      void logActivity({
        userId: session.user.id,
        action: "member_tag.attach",
        entityType: "User",
        entityId: userId,
        metadata: { tagId },
      });
    }
    for (const tagId of toRemove) {
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
    console.error("member tags PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
