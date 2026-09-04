import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole, meetsRoleThreshold } from "@/lib/permissions";
import { isEventAnnouncementVisibleTo } from "@/lib/announcement";
import { logActivity } from "@/lib/activity-log";
import { dispatchNotificationEmails } from "@/lib/notify-email-dispatch";
import { getDefaultTenantId } from "@/lib/tenant";

interface Params {
  params: Promise<{ eventId: string }>;
}

// GET /api/events/[eventId]/messages
// イベント紐付き Announcement (旧「当日連絡」) の一覧を返す。
// 実体は Announcement テーブル (eventId 紐付き)。
// TOP バナー (AnnouncementBanner) にも同じ Announcement が表示されるので既読管理も自動で乗る。
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    const { eventId } = await params;
    const role = session.user.role as UserRole;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, minViewRole: true, status: true, createdById: true },
    });
    if (!event) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    }
    const isAdmin = permissions.canAccessAdmin(role);
    if (!isAdmin && event.createdById !== session.user.id) {
      if (event.status === "draft") {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND" } },
          { status: 404 },
        );
      }
      if (!meetsRoleThreshold(role, event.minViewRole)) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND" } },
          { status: 404 },
        );
      }
    }

    const [announcements, myAttendance] = await Promise.all([
      prisma.announcement.findMany({
        where: { eventId },
        orderBy: { publishedAt: "desc" },
        include: {
          createdBy: { select: { id: true, nickname: true, profileImageUrl: true } },
        },
      }),
      prisma.attendance.findUnique({
        where: { userId_eventId: { userId: session.user.id, eventId } },
        select: { status: true },
      }),
    ]);

    const attendanceStatus = myAttendance?.status ?? null;
    const visible = announcements.filter((a) =>
      isEventAnnouncementVisibleTo(role, a, attendanceStatus),
    );

    return NextResponse.json({
      success: true,
      data: visible.map((a) => ({
        id: a.id,
        content: a.body,
        targetType: a.attendanceTargetType,
        sentAt: a.publishedAt,
        sender: a.createdBy
          ? {
              id: a.createdBy.id,
              nickname: a.createdBy.nickname,
              profileImageUrl: a.createdBy.profileImageUrl,
            }
          : { id: "system", nickname: "運営", profileImageUrl: null },
      })),
    });
  } catch (error) {
    console.error("event messages GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}

// POST /api/events/[eventId]/messages
// Announcement を作成 (eventId + attendanceTargetType セット)。TOP バナーにも自動で流れる。
const ALLOWED_TARGETS = new Set(["attending", "attending_or_undecided", "all"]);

export async function POST(request: NextRequest, { params }: Params) {
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
    const { eventId } = await params;
    const body = await request.json();
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const targetType = typeof body?.targetType === "string" ? body.targetType : "attending_or_undecided";
    if (!content) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "本文は必須です" } },
        { status: 400 },
      );
    }
    if (content.length > 2000) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "本文は 2000 文字以内で入力してください" } },
        { status: 400 },
      );
    }
    if (!ALLOWED_TARGETS.has(targetType)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "対象範囲が不正です" } },
        { status: 400 },
      );
    }

    // 対象範囲 -> audience の初期化。イベント紐付きなので audience は自身のイベント閲覧権限に合わせる:
    // "all" = 全員に見せるので member/visitor/guest 全部 ON、
    // それ以外は少なくとも member+visitor は ON (attendance 判定で更に絞られる)。
    const audienceGuest = targetType === "all";
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        title: true,
        eventDate: true,
        minViewRole: true,
        allowedTags: { select: { tagId: true } },
      },
    });
    const dateStr = event?.eventDate
      ? new Date(event.eventDate).toLocaleDateString("ja-JP", {
          month: "numeric",
          day: "numeric",
        })
      : "";
    const title = event ? `【${dateStr} ${event.title}】` : "【イベントお知らせ】";

    const tenantId = await getDefaultTenantId();
    const ann = await prisma.announcement.create({
      data: {
        title,
        body: content,
        severity: "info",
        audienceMember: true,
        audienceVisitor: true,
        audienceGuest,
        createdById: session.user.id,
        eventId,
        attendanceTargetType: targetType,
        tenantId,
      },
    });
    void logActivity({
      userId: session.user.id,
      action: "event_message.post",
      entityType: "Announcement",
      entityId: ann.id,
      metadata: { eventId, targetType },
    });

    // メール通知: fire-and-forget (cron と異なり API レスポンスを待たせない)
    void (async () => {
      try {
        const appUrl = process.env.NEXTAUTH_URL ?? "";
        const subject = `【２８ばど】${dateStr} ${event?.title ?? "イベント"} の連絡`;
        const emailBody = content + `\n\n詳細: ${appUrl}/events/${eventId}`;

        const allowedTagIds = (event?.allowedTags ?? []).map((t) => t.tagId);
        const hasTagRestriction = allowedTagIds.length > 0;
        const minViewRole = event?.minViewRole ?? "visitor";

        let recipientUserIds: string[];

        if (targetType === "attending") {
          // 参加確定者のみ
          const attendances = await prisma.attendance.findMany({
            where: { eventId, status: "attending" },
            select: { userId: true },
          });
          recipientUserIds = attendances.map((a) => a.userId);
        } else {
          // attending_or_undecided / all: イベントを閲覧できるユーザーを取得
          const allUsers = await prisma.user.findMany({
            where: {
              role: { notIn: ["pending"] },
              holdAt: null,
            },
            select: {
              id: true,
              role: true,
              memberTags: { select: { tagId: true } },
            },
          });

          // イベント閲覧可能ユーザーを絞り込む
          const viewableUserIds = allUsers
            .filter((u) => {
              if (u.role === "admin" || u.role === "subadmin") return true;
              if (!meetsRoleThreshold(u.role as UserRole, minViewRole)) return false;
              if (hasTagRestriction) {
                const userTagIds = new Set(u.memberTags.map((t) => t.tagId));
                return allowedTagIds.some((tid) => userTagIds.has(tid));
              }
              return true;
            })
            .map((u) => u.id);

          if (targetType === "all") {
            recipientUserIds = viewableUserIds;
          } else {
            // attending_or_undecided: 参加確定 or Attendance レコードなし
            const attendances = await prisma.attendance.findMany({
              where: { eventId, userId: { in: viewableUserIds } },
              select: { userId: true, status: true },
            });
            const attendanceMap = new Map(attendances.map((a) => [a.userId, a.status]));
            recipientUserIds = viewableUserIds.filter((uid) => {
              const status = attendanceMap.get(uid) ?? null;
              return status === "attending" || status === null;
            });
          }
        }

        await dispatchNotificationEmails({
          type: "event_message",
          subject,
          body: emailBody,
          recipientUserIds,
        });
      } catch (err) {
        console.error("[event messages POST] メール通知エラー:", err);
      }
    })();

    return NextResponse.json({ success: true, data: { id: ann.id } });
  } catch (error) {
    console.error("event messages POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
