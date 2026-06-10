import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole, meetsRoleThreshold } from "@/lib/permissions";
import { updateEventSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-log";

function isStaff(role: UserRole) {
  return role === "admin" || role === "subadmin";
}
function canRoleView(role: UserRole, minViewRole: string) {
  return meetsRoleThreshold(role, minViewRole);
}

interface Params {
  params: Promise<{ eventId: string }>;
}

// GET /api/events/[eventId] - イベント詳細取得
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const { eventId } = await params;
    const role = session.user.role as UserRole;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        createdBy: {
          select: { nickname: true },
        },
        category: true,
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                profileImageUrl: true,
                gender: true,
              },
            },
          },
          orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
        },
        // 大会連動イベントの場合は紐付き大会の class 一覧を併せて取得する。
        // (Attendance フォームの「申告クラス」セレクト用)
        linkedTournament: {
          include: {
            classes: {
              where: { approvalStatus: "approved" },
              orderBy: [{ category: "asc" }, { order: "asc" }],
              select: {
                id: true,
                category: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "イベントが見つかりません" } },
        { status: 404 }
      );
    }

    // 閾値方式: event.minViewRole に対し、現在ロールが届かないなら 404 で隠す。
    // admin / subadmin は閾値を無視して常に閲覧可。
    if (!isStaff(role) && !canRoleView(role, event.minViewRole)) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "イベントが見つかりません" } },
        { status: 404 }
      );
    }

    // draft 状態のイベントは管理者と作成者だけが閲覧可。
    if (event.status === "draft" && !isStaff(role) && event.createdById !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "イベントが見つかりません" } },
        { status: 404 }
      );
    }

    const attendingCount = event.attendances.filter((a) => a.status === "attending").length;
    const waitlistCount = event.attendances.filter((a) => a.status === "waitlist").length;
    const observingCount = event.attendances.filter((a) => a.status === "observing").length;
    const myAttendance = event.attendances.find((a) => a.user.id === session.user.id);

    // 参加者リストは member 以上のみ閲覧可能
    const canViewAttendees = permissions.canViewAttendeeList(role);
    // 経費・収支は管理者のみ閲覧可能
    const canViewExpenses = permissions.canAccessAdmin(role);

    // 経費入力支援: イベント開催日に適用されるシャトル単価
    // ShuttlePrice テーブルが未マイグレーションでもエラーで API 全体を死なせない。
    let applicablePrice: {
      id: string;
      effectiveFrom: Date;
      casePrice: number;
      shuttlesPerCase: number;
    } | null = null;
    if (canViewExpenses) {
      try {
        applicablePrice = await prisma.shuttlePrice.findFirst({
          where: { effectiveFrom: { lte: event.eventDate } },
          orderBy: { effectiveFrom: "desc" },
        });
      } catch (err) {
        console.warn("[event GET] failed to query ShuttlePrice (table may not exist yet):", err);
      }
    }

    // 実集金額は、attending かつ paymentStatus=paid なメンバーの (paymentAmount ?? event.fee) の合計から自動算出
    let computedActualRevenue: number | null = null;
    if (canViewExpenses) {
      const paidAttendances = event.attendances.filter(
        (a) => a.status === "attending" && a.paymentStatus === "paid"
      );
      if (paidAttendances.length > 0) {
        computedActualRevenue = paidAttendances.reduce(
          (sum, a) => sum + (a.paymentAmount ?? event.fee ?? 0),
          0
        );
      }
    }

    // 参加費が表示されるイベントに限り、運営の PayPay ID を併せて返す。
    // PayPay ID が SystemSetting に登録されていなければ送らない。
    let paypayPersonalId: string | null = null;
    if (event.feeVisible && event.fee != null) {
      try {
        const row = await prisma.systemSetting.findUnique({
          where: { key: "paypayPersonalId" },
        });
        const id = row?.value?.trim();
        if (id) paypayPersonalId = id;
      } catch {
        // テーブル未マイグレーション等のエラーは握り潰す
      }
    }

    void logActivity({
      userId: session.user.id,
      action: "event.view",
      entityType: "Event",
      entityId: event.id,
    });

    return NextResponse.json({
      success: true,
      data: {
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
        // 管理者は EventForm で体育館代を編集できるため、event 直下にも値を出す。
        // canViewExpenses (admin/subadmin) でない場合は null にする。
        gymCost: canViewExpenses ? event.gymCost : null,
        paypayPersonalId,
        linkedTournamentId: event.linkedTournamentId ?? null,
        deadline: event.deadline,
        deadlineEnabled: event.deadlineEnabled,
        respondStartAt: event.respondStartAt,
        category: event.category
          ? {
              id: event.category.id,
              name: event.category.name,
              description: event.category.description,
              color: event.category.color,
            }
          : null,
        minViewRole: event.minViewRole,
        minRespondRole: event.minRespondRole,
        status: event.status,
        cancelledAt: event.cancelledAt,
        cancelReason: event.cancelReason,
        createdBy: event.createdBy.nickname,
        createdById: event.createdById,
        createdAt: event.createdAt,
        attendingCount,
        waitlistCount,
        observingCount,
        expenses: canViewExpenses
          ? {
              shuttleCount: event.shuttleCount,
              // 個数 × イベント日時点の適用単価から自動算出。
              // 単価未登録なら null。
              shuttleCost:
                event.shuttleCount !== null && applicablePrice
                  ? Math.round(
                      event.shuttleCount *
                        (applicablePrice.casePrice / applicablePrice.shuttlesPerCase)
                    )
                  : null,
              gymCost: event.gymCost,
              otherCost: event.otherCost,
              otherMemo: event.otherMemo,
              // 実集金額 = 参加者の支払い済み合計 (自動算出)。
              // 支払い済みがゼロの間は DB に保存されている値 (旧 UI 経由の手入力分) を見せる。
              actualRevenue: computedActualRevenue ?? event.actualRevenue,
              applicableShuttlePrice: applicablePrice
                ? {
                    id: applicablePrice.id,
                    effectiveFrom: applicablePrice.effectiveFrom,
                    casePrice: applicablePrice.casePrice,
                    shuttlesPerCase: applicablePrice.shuttlesPerCase,
                    pricePerPiece: applicablePrice.casePrice / applicablePrice.shuttlesPerCase,
                  }
                : null,
            }
          : null,
        myAttendance: myAttendance
          ? {
              id: myAttendance.id,
              status: myAttendance.status,
              comment: myAttendance.comment,
              position: myAttendance.position,
              declaredTournamentClassId: myAttendance.declaredTournamentClassId ?? null,
            }
          : null,
        linkedTournamentClasses: event.linkedTournament?.classes ?? [],
        attendees: canViewAttendees
          ? event.attendances.map((a) => ({
              id: a.id,
              status: a.status,
              comment: a.comment,
              position: a.position,
              createdAt: a.createdAt,
              user: a.user,
              // 支払情報は admin のみ
              paymentStatus: canViewExpenses ? a.paymentStatus : undefined,
              paymentAmount: canViewExpenses ? a.paymentAmount : undefined,
              paymentNote: canViewExpenses ? a.paymentNote : undefined,
              declaredTournamentClassId: a.declaredTournamentClassId ?? null,
            }))
          : null,
      },
    });
  } catch (error) {
    console.error("Event GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// PUT /api/events/[eventId] - イベント更新
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const role = session.user.role as UserRole;
    if (!permissions.canEditEvent(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "イベント編集の権限がありません" } },
        { status: 403 }
      );
    }

    const { eventId } = await params;
    const body = await request.json();
    const parsed = updateEventSchema.safeParse(body);

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

    const existing = await prisma.event.findUnique({ where: { id: eventId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "イベントが見つかりません" } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null;
    if (parsed.data.eventDate !== undefined) updateData.eventDate = new Date(parsed.data.eventDate);
    if (parsed.data.eventEndDate !== undefined)
      updateData.eventEndDate = parsed.data.eventEndDate ? new Date(parsed.data.eventEndDate) : null;
    if (parsed.data.isAllDay !== undefined) updateData.isAllDay = parsed.data.isAllDay;
    if (parsed.data.location !== undefined) updateData.location = parsed.data.location || null;
    if (parsed.data.capacity !== undefined) updateData.capacity = parsed.data.capacity || null;
    if (parsed.data.fee !== undefined) updateData.fee = parsed.data.fee || null;
    if (parsed.data.feeVisible !== undefined) updateData.feeVisible = parsed.data.feeVisible;
    if (parsed.data.deadline !== undefined)
      updateData.deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null;
    if (parsed.data.deadlineEnabled !== undefined) updateData.deadlineEnabled = parsed.data.deadlineEnabled;
    if (parsed.data.respondStartAt !== undefined)
      updateData.respondStartAt = parsed.data.respondStartAt ? new Date(parsed.data.respondStartAt) : null;
    if (parsed.data.categoryId !== undefined) updateData.categoryId = parsed.data.categoryId;
    if (parsed.data.minViewRole !== undefined) updateData.minViewRole = parsed.data.minViewRole;
    if (parsed.data.minRespondRole !== undefined) updateData.minRespondRole = parsed.data.minRespondRole;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.shuttleCount !== undefined) updateData.shuttleCount = parsed.data.shuttleCount;
    if (parsed.data.shuttleCost !== undefined) updateData.shuttleCost = parsed.data.shuttleCost;
    if (parsed.data.gymCost !== undefined) updateData.gymCost = parsed.data.gymCost;
    if (parsed.data.otherCost !== undefined) updateData.otherCost = parsed.data.otherCost;
    if (parsed.data.otherMemo !== undefined) updateData.otherMemo = parsed.data.otherMemo;
    if (parsed.data.actualRevenue !== undefined) updateData.actualRevenue = parsed.data.actualRevenue;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: updateData,
    });

    void logActivity({
      userId: session.user.id,
      action: event.cancelledAt ? "event.cancel" : "event.update",
      entityType: "Event",
      entityId: event.id,
      metadata: { title: event.title },
    });

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    console.error("Event PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[eventId] - イベント削除
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const role = session.user.role as UserRole;
    if (!permissions.canDeleteEvent(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "イベント削除の権限がありません" } },
        { status: 403 }
      );
    }

    const { eventId } = await params;

    const existing = await prisma.event.findUnique({ where: { id: eventId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "イベントが見つかりません" } },
        { status: 404 }
      );
    }

    await prisma.event.delete({ where: { id: eventId } });

    void logActivity({
      userId: session.user.id,
      action: "event.delete",
      entityType: "Event",
      entityId: eventId,
      metadata: { title: existing.title },
    });

    return NextResponse.json({ success: true, data: { message: "イベントを削除しました" } });
  } catch (error) {
    console.error("Event DELETE error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
