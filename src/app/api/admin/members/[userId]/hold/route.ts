import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { notifyHoldRequest } from "@/lib/line-messaging";

interface Params {
  params: Promise<{ userId: string }>;
}

// POST /api/admin/members/[userId]/hold
// pending ユーザーを保留状態にする。LINE で初参加時の必要事項を促す返信も送る。
export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 },
      );
    }
    const { userId } = await params;
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, lineId: true, nickname: true },
    });
    if (!target) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    }
    if (target.role !== "pending") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_STATE", message: "pending ユーザーのみ保留できます" } },
        { status: 400 },
      );
    }

    let messageSent = false;
    if (target.lineId) {
      try {
        await notifyHoldRequest({ lineId: target.lineId });
        messageSent = true;
      } catch (e) {
        console.error("[hold] LINE 返信失敗:", e);
      }
    }

    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: {
        holdAt: now,
        holdMessageSentAt: messageSent ? now : null,
      },
    });

    void logActivity({
      userId: session.user.id,
      action: "member.hold",
      entityType: "User",
      entityId: userId,
      metadata: { targetNickname: target.nickname, messageSent },
    });

    return NextResponse.json({ success: true, data: { messageSent } });
  } catch (error) {
    console.error("hold POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/members/[userId]/hold
// 保留解除。通常の承認待ちに戻す。
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 },
      );
    }
    const { userId } = await params;
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true, holdAt: true },
    });
    if (!target) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    }
    if (!target.holdAt) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_STATE", message: "保留中ではありません" } },
        { status: 400 },
      );
    }
    await prisma.user.update({
      where: { id: userId },
      data: { holdAt: null, holdMessageSentAt: null },
    });
    void logActivity({
      userId: session.user.id,
      action: "member.hold_release",
      entityType: "User",
      entityId: userId,
      metadata: { targetNickname: target.nickname },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("hold DELETE error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
