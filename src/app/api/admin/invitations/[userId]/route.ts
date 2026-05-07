import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";

// LIFF ID が設定されていれば LIFF URL、なければ通常のWebアプリURLを返す。
// LIFF URL なら LINE トーク内でタップしてもLIFF経由で開かれる。
function buildInviteUrl(token: string): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (liffId) {
    return `https://liff.line.me/${liffId}/invite/${token}`;
  }
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${baseUrl}/invite/${token}`;
}

// POST /api/admin/invitations/[userId] - 招待トークン発行（再発行も可）
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    }

    const { userId } = await params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    // 既存トークンを削除して新規発行
    await prisma.invitationToken.deleteMany({ where: { userId } });

    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3日間有効
    const invitation = await prisma.invitationToken.create({
      data: { userId, expiresAt },
    });

    const inviteUrl = buildInviteUrl(invitation.token);

    return NextResponse.json({ success: true, data: { token: invitation.token, inviteUrl, expiresAt } });
  } catch (error) {
    console.error("POST /api/admin/invitations error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

// GET /api/admin/invitations/[userId] - 現在の招待トークン取得
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    }

    const { userId } = await params;

    const invitation = await prisma.invitationToken.findUnique({ where: { userId } });
    if (!invitation) {
      return NextResponse.json({ success: true, data: null });
    }

    const inviteUrl = buildInviteUrl(invitation.token);
    const isExpired = invitation.expiresAt < new Date();

    return NextResponse.json({
      success: true,
      data: { token: invitation.token, inviteUrl, expiresAt: invitation.expiresAt, isExpired },
    });
  } catch (error) {
    console.error("GET /api/admin/invitations error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

// DELETE /api/admin/invitations/[userId] - 招待トークン無効化
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    }

    const { userId } = await params;

    await prisma.invitationToken.deleteMany({ where: { userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/invitations error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
