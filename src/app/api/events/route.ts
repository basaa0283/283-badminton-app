import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, meetsRoleThreshold, UserRole } from "@/lib/permissions";
import { createEventSchema } from "@/lib/validations";
import { notifyNewEvent } from "@/lib/line-messaging";
import { logActivity } from "@/lib/activity-log";
import { formatInTimeZone } from "date-fns-tz";
import { ja } from "date-fns/locale";
import { dispatchNotificationEmails } from "@/lib/notify-email-dispatch";
import { getDefaultTenantId, tenantWhere } from "@/lib/tenant";

// GET /api/events - イベント一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get("upcoming") !== "false";
    // 過去イベント取得時の遡及期間 (月数)。デフォルト 3 か月。
    // フロントの「もっと前を見る」が押されるたびに増やして再取得する。
    const monthsBackParam = Number(searchParams.get("monthsBack"));
    const monthsBack =
      Number.isFinite(monthsBackParam) && monthsBackParam > 0
        ? Math.min(Math.floor(monthsBackParam), 240) // 上限 20 年
        : 3;

    const now = new Date();
    const pastStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const dateWhere = upcoming
      ? { eventDate: { gte: now } }
      : { eventDate: { gte: pastStart, lt: now } };

    // 閾値方式: 各イベントの minViewRole に対し、現在のロールが届いているもののみ。
    //   - admin / subadmin は閾値に関わらず常に全件
    //   - member は minViewRole in {guest, visitor, member}
    //   - visitor は minViewRole in {guest, visitor}
    //   - guest / pending は minViewRole = "guest" のみ
    const role = session.user.role as UserRole;
    const visibleRoleFilter: string[] | null =
      role === "admin" || role === "subadmin"
        ? null
        : role === "member"
          ? ["guest", "visitor", "member"]
          : role === "visitor"
            ? ["guest", "visitor"]
            : ["guest"]; // guest / pending
    const baseWhere =
      visibleRoleFilter === null
        ? dateWhere
        : { ...dateWhere, minViewRole: { in: visibleRoleFilter } };

    // 過去イベント (upcoming=false) は管理者以外には「自分が参加したもの」のみ。
    // 他人の過去履歴を眺めるユースケースが無いので一覧をシンプルに保つ。
    const isAdmin = role === "admin" || role === "subadmin";
    // status=draft は作成者と管理者だけが見える。一般メンバーには非公開。
    const statusWhere = isAdmin
      ? {}
      : { OR: [{ status: "published" }, { createdById: session.user.id }] };
    // タグ限定: 自分が持つタグの SOME に含まれない限り、タグありイベントは見えない。
    // admin/subadmin は無条件で通す。
    const tagWhere = isAdmin
      ? {}
      : {
          OR: [
            { allowedTags: { none: {} } },
            {
              allowedTags: {
                some: { tag: { users: { some: { userId: session.user.id } } } },
              },
            },
          ],
        };
    // 非公開イベントの「参加者本人には見せる」オプション (#53)。
    // visibleToParticipants=true かつ自分の Attendance レコードがあれば、
    // status/タグ制限を問わず個別に見える (管理者からの明示的な招待扱い)。
    const draftParticipantWhere = {
      status: "draft",
      visibleToParticipants: true,
      attendances: { some: { userId: session.user.id } },
    };
    const accessWhere = isAdmin
      ? {}
      : { OR: [{ AND: [statusWhere, tagWhere] }, draftParticipantWhere] };
    const baseWhereWithStatus = isAdmin
      ? { ...baseWhere, ...statusWhere }
      : { AND: [baseWhere, accessWhere] };
    const where =
      !upcoming && !isAdmin
        ? {
            AND: [
              baseWhere,
              accessWhere,
              { attendances: { some: { userId: session.user.id, status: "attending" } } },
            ],
          }
        : baseWhereWithStatus;

    const tw = await tenantWhere();
    const whereWithTenant = { AND: [where, tw] };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where: whereWithTenant,
        orderBy: { eventDate: upcoming ? "asc" : "desc" },
        include: {
          attendances: {
            select: {
              status: true,
              userId: true,
              comment: true,
              position: true,
            },
          },
          createdBy: {
            select: {
              nickname: true,
            },
          },
          category: true,
          allowedTags: { include: { tag: true } },
        },
      }),
      prisma.event.count({ where: whereWithTenant }),
    ]);

    const userId = session.user.id;
    const eventsWithCounts = events.map((event) => {
      const attendingCount = event.attendances.filter((a) => a.status === "attending").length;
      const waitlistCount = event.attendances.filter((a) => a.status === "waitlist").length;
      const myAttendance = event.attendances.find((a) => a.userId === userId);

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        eventDate: event.eventDate,
        eventEndDate: event.eventEndDate,
        isAllDay: event.isAllDay,
        location: event.location,
        capacity: event.capacity,
        fee: event.feeVisible ? event.fee : null,
        feeVisible: event.feeVisible,
        deadline: event.deadline,
        deadlineEnabled: event.deadlineEnabled,
        minViewRole: event.minViewRole,
        minRespondRole: event.minRespondRole,
        status: event.status,
        allowedTags: event.allowedTags.map((at) => ({
          id: at.tag.id,
          name: at.tag.name,
          color: at.tag.color,
        })),
        // 管理者向け「経費記録未入力」判定用 (UI 側で admin/subadmin のみ参照)
        // shuttleCost は個数×単価で自動計算されるため生値は常に null。判定は shuttleCount で行う。
        gymCost: event.gymCost,
        shuttleCount: event.shuttleCount,
        category: event.category
          ? {
              id: event.category.id,
              name: event.category.name,
              description: event.category.description,
              color: event.category.color,
            }
          : null,
        cancelledAt: event.cancelledAt,
        cancelReason: event.cancelReason,
        createdBy: event.createdBy.nickname,
        attendingCount,
        waitlistCount,
        myAttendance: myAttendance
          ? {
              status: myAttendance.status,
              comment: myAttendance.comment,
              position: myAttendance.position,
            }
          : null,
      };
    });

    void logActivity({
      userId: session.user.id,
      action: "event.list_view",
      metadata: { count: total },
    });

    return NextResponse.json({
      success: true,
      data: eventsWithCounts,
      // 過去イベントは「当月＋先月」、未来イベントは全期間で、ページング廃止。
      // 型互換のため pagination は自己整合な値で残しておく。
      pagination: {
        page: 1,
        limit: total,
        total,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error("Events GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// POST /api/events - イベント作成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const role = session.user.role as UserRole;
    if (!permissions.canCreateEvent(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "イベント作成の権限がありません" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "入力内容に誤りがあります",
          },
        },
        { status: 400 }
      );
    }

    const tenantId = await getDefaultTenantId();
    const event = await prisma.event.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        eventDate: new Date(parsed.data.eventDate),
        eventEndDate: parsed.data.eventEndDate ? new Date(parsed.data.eventEndDate) : null,
        isAllDay: parsed.data.isAllDay ?? false,
        location: parsed.data.location || null,
        capacity: parsed.data.capacity || null,
        fee: parsed.data.fee || null,
        feeVisible: parsed.data.feeVisible,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
        deadlineEnabled: parsed.data.deadlineEnabled,
        respondStartAt: parsed.data.respondStartAt ? new Date(parsed.data.respondStartAt) : null,
        categoryId: parsed.data.categoryId ?? null,
        minViewRole: parsed.data.minViewRole ?? "visitor",
        minRespondRole: parsed.data.minRespondRole ?? "visitor",
        status: parsed.data.status ?? "published",
        visibleToParticipants: parsed.data.visibleToParticipants ?? false,
        shuttleCount: parsed.data.shuttleCount ?? null,
        shuttleCost: parsed.data.shuttleCost ?? null,
        gymCost: parsed.data.gymCost ?? null,
        otherCost: parsed.data.otherCost ?? null,
        otherMemo: parsed.data.otherMemo ?? null,
        actualRevenue: parsed.data.actualRevenue ?? null,
        createdById: session.user.id,
        tenantId,
        ...(parsed.data.allowedTagIds && parsed.data.allowedTagIds.length > 0
          ? {
              allowedTags: {
                create: parsed.data.allowedTagIds.map((tagId) => ({ tagId })),
              },
            }
          : {}),
      },
    });

    // draft 状態では LINE 通知もお知らせ投稿も走らない (上限消費しない)。
    const isDraft = event.status === "draft";

    if (!isDraft && parsed.data.notifyMembers) {
      const members = await prisma.user.findMany({
        where: {
          role: { in: ["member", "subadmin", "admin"] },
          lineId: { not: null },
        },
        select: { lineId: true },
      });
      const lineIds = members.map((u) => u.lineId as string);
      const appUrl = process.env.NEXTAUTH_URL || "";
      notifyNewEvent({
        lineIds,
        eventTitle: event.title,
        eventDate: event.eventDate,
        location: event.location,
        appUrl,
      }).catch((err) => console.error("[notify] new event failed:", err));
    }

    // お知らせにも投稿: イベント情報を定型文で Announcement として作成。
    // 公開対象は member/visitor。guest はイベント詳細で見ればよく、お知らせは
    // 内部メンバー向けの位置づけ。後から /admin/announcements で編集可。
    if (!isDraft && parsed.data.announceOnCreate) {
      const lines = [
        event.title,
        `📅 ${formatInTimeZone(event.eventDate, "Asia/Tokyo", "M月d日(E) HH:mm", { locale: ja })}`,
        event.location ? `📍 ${event.location}` : null,
        "",
        "詳しくはアプリ「イベント一覧」をご確認ください。",
      ].filter((l): l is string => l !== null);
      await prisma.announcement
        .create({
          data: {
            title: `イベント追加: ${event.title}`,
            body: lines.join("\n"),
            severity: "info",
            audienceMember: true,
            audienceVisitor: true,
            audienceGuest: false,
            createdById: session.user.id,
            tenantId,
          },
        })
        .catch((err) => console.error("[announce] new event announcement failed:", err));
    }

    void logActivity({
      userId: session.user.id,
      action: "event.create",
      entityType: "Event",
      entityId: event.id,
      metadata: { title: event.title },
    });

    // メール通知: draft では送らない。公開制御と同じロジックで対象ユーザーを絞る。
    if (!isDraft) {
      void (async () => {
        try {
          // 対象ユーザーを取得: pending / hold 中は除外 (minViewRole 閾値・タグ限定は下で判定)
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

          const allowedTagIds = parsed.data.allowedTagIds ?? [];
          const hasTagRestriction = allowedTagIds.length > 0;

          const targetUserIds = allUsers
            .filter((u) => {
              // admin/subadmin は常に対象
              if (u.role === "admin" || u.role === "subadmin") return true;
              // minViewRole 閾値チェック
              if (!meetsRoleThreshold(u.role as UserRole, event.minViewRole)) return false;
              // タグ限定: 限定ありなら該当タグを持つユーザーのみ
              if (hasTagRestriction) {
                const userTagIds = new Set(u.memberTags.map((t) => t.tagId));
                return allowedTagIds.some((tid) => userTagIds.has(tid));
              }
              return true;
            })
            .map((u) => u.id);

          const appUrl = process.env.NEXTAUTH_URL ?? "";
          const dateStr = event.isAllDay
            ? formatInTimeZone(event.eventDate, "Asia/Tokyo", "M月d日(E)", { locale: ja }) + " 終日"
            : formatInTimeZone(event.eventDate, "Asia/Tokyo", "M月d日(E) HH:mm", { locale: ja });

          const bodyLines = [
            "新しいイベントが追加されました！",
            "",
            event.title,
            `📅 ${dateStr}`,
            ...(event.location ? [`📍 ${event.location}`] : []),
            "",
            "参加登録はアプリから:",
            `${appUrl}/events/${event.id}`,
          ];

          await dispatchNotificationEmails({
            type: "new_event",
            subject: `【２８ばど】新しいイベント: ${event.title}`,
            body: bodyLines.join("\n"),
            recipientUserIds: targetUserIds,
          });
        } catch (err) {
          console.error("[events POST] メール通知エラー:", err);
        }
      })();
    }

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error("Events POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
