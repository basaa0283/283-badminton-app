import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";

interface Params {
  params: Promise<{ tagId: string }>;
}

// PUT /api/admin/tags/[tagId] - タグ名/説明/色を更新
// DELETE /api/admin/tags/[tagId] - タグ削除 (Cascade で UserMemberTag / EventAllowedTag も消える)

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 }) };
  if (!permissions.canAccessAdmin(session.user.role as UserRole)) {
    return { error: NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 }) };
  }
  return { session };
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { tagId } = await params;
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : undefined;
    const description = typeof body?.description === "string" ? body.description : undefined;
    const color = typeof body?.color === "string" ? body.color : undefined;
    if (name !== undefined && (name.length === 0 || name.length > 100)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "タグ名は 1-100 文字で入力してください" } },
        { status: 400 },
      );
    }
    const tag = await prisma.memberTag.update({
      where: { id: tagId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(color !== undefined ? { color } : {}),
      },
    });
    void logActivity({
      userId: auth.session!.user.id,
      action: "member_tag.update",
      entityType: "MemberTag",
      entityId: tag.id,
    });
    return NextResponse.json({ success: true, data: tag });
  } catch (error) {
    console.error("tag PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { tagId } = await params;
  try {
    await prisma.memberTag.delete({ where: { id: tagId } });
    void logActivity({
      userId: auth.session!.user.id,
      action: "member_tag.delete",
      entityType: "MemberTag",
      entityId: tagId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("tag DELETE error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
