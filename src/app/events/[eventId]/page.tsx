"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Header } from "@/components/layout/Header";
import { AttendanceForm } from "@/components/events/AttendanceForm";
import { GuestContactCard } from "@/components/guests/GuestContactCard";
import { AttendeeList } from "@/components/events/AttendeeList";
import { AdminAttendanceManager } from "@/components/events/AdminAttendanceManager";
import { ExpensesCard } from "@/components/events/ExpensesCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { permissions, UserRole } from "@/lib/permissions";

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  eventEndDate: string | null;
  isAllDay: boolean;
  location: string | null;
  capacity: number | null;
  fee: number | null;
  feeVisible: boolean;
  deadline: string | null;
  deadlineEnabled: boolean;
  category: { id: string; name: string; color: string | null } | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdBy: string;
  createdById: string;
  attendingCount: number;
  waitlistCount: number;
  observingCount: number;
  myAttendance: {
    id: string;
    status: string;
    comment: string | null;
    position: number | null;
  } | null;
  attendees: Array<{
    id: string;
    status: string;
    comment: string | null;
    position: number | null;
    createdAt: string;
    user: {
      id: string;
      nickname: string;
      profileImageUrl: string | null;
      gender: string | null;
    };
    paymentStatus?: string | null;
    paymentAmount?: number | null;
    paymentNote?: string | null;
  }> | null;
  expenses: {
    shuttleCount: number | null;
    shuttleCost: number | null;
    gymCost: number | null;
    otherCost: number | null;
    otherMemo: string | null;
    actualRevenue: number | null;
    applicableShuttlePrice: {
      effectiveFrom: string;
      casePrice: number;
      shuttlesPerCase: number;
      pricePerPiece: number;
    } | null;
  } | null;
}

export default function EventDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && eventId) {
      fetchEvent();
    }
  }, [status, eventId]);

  const fetchEvent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`);
      const data = await res.json();
      if (data.success) {
        setEvent(data.data);
      } else {
        router.push("/events");
      }
    } catch (error) {
      console.error("Failed to fetch event:", error);
      router.push("/events");
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceSubmit = async (
    attendanceStatus: "attending" | "not_attending",
    comment: string
  ) => {
    const res = await fetch(`/api/events/${eventId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: attendanceStatus, comment }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error?.message || "出欠登録に失敗しました");
    }

    await fetchEvent();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        router.push("/events");
      }
    } catch (error) {
      console.error("Failed to delete event:", error);
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/events/${eventId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReasonInput.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        setCancelModalOpen(false);
        setCancelReasonInput("");
        await fetchEvent();
      }
    } finally {
      setCancelling(false);
    }
  };

  const handleUncancel = async () => {
    if (!confirm("中止を解除してイベントを再開しますか？")) return;
    const res = await fetch(`/api/events/${eventId}/cancel`, { method: "DELETE" });
    if ((await res.json()).success) await fetchEvent();
  };

  if (status === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  const role = session.user.role as UserRole;
  const canEdit = permissions.canEditEvent(role);
  const canDelete = permissions.canDeleteEvent(role);
  const canViewAttendees = permissions.canViewAttendeeList(role);
  const canViewExpenses = permissions.canAccessAdmin(role);
  const canRespond = permissions.canRespondToEvent(role);
  const eventDate = new Date(event.eventDate);
  // 終日イベントは「その日 24:00」までを開催中扱い (isPast 判定を時刻で誤らせない)
  const effectiveEndForPast = event.isAllDay
    ? new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate() + 1)
    : eventDate;
  const isDeadlinePassed =
    event.deadlineEnabled && event.deadline && new Date(event.deadline) < new Date();
  const isPast = effectiveEndForPast < new Date();

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-4">
          <Link href="/events" className="text-blue-600 text-sm hover:underline">
            ← イベント一覧に戻る
          </Link>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{event.title}</h1>
                {event.category && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                    style={{ backgroundColor: event.category.color ?? "#6B7280" }}
                  >
                    {event.category.name}
                  </span>
                )}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2 justify-end">
                  <Link href={`/events/${eventId}/edit`}>
                    <Button size="sm" variant="secondary">
                      編集
                    </Button>
                  </Link>
                  {event.cancelledAt ? (
                    <Button size="sm" variant="secondary" onClick={handleUncancel}>
                      中止を解除
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setCancelModalOpen(true)}>
                      中止する
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleteModalOpen(true)}
                    >
                      削除
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {event.cancelledAt && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="text-sm font-bold text-red-800">⚠️ このイベントは中止されました</div>
                {event.cancelReason && (
                  <div className="text-sm text-red-700 mt-1 whitespace-pre-wrap">理由: {event.cancelReason}</div>
                )}
              </div>
            )}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>
                  {format(eventDate, "yyyy年M月d日(E)", { locale: ja })}
                  {event.isAllDay
                    ? " 終日"
                    : (
                      <>
                        {` ${format(eventDate, "HH:mm", { locale: ja })}`}
                        {event.eventEndDate && ` 〜 ${format(new Date(event.eventEndDate), "HH:mm", { locale: ja })}`}
                      </>
                    )}
                </span>
              </div>

              {event.location && (
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>{event.location}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>
                  参加: {event.attendingCount}
                  {event.capacity !== null && `/${event.capacity}`}人
                  {event.waitlistCount > 0 && (
                    <span className="text-yellow-600 ml-1">(待ち{event.waitlistCount}人)</span>
                  )}
                  {event.observingCount > 0 && (
                    <span className="text-blue-600 ml-1">(見学{event.observingCount}人)</span>
                  )}
                </span>
              </div>

              {event.feeVisible && event.fee !== null && (
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>参加費: {event.fee.toLocaleString()}円</span>
                </div>
              )}

              {event.deadlineEnabled && event.deadline && (
                <div
                  className={`flex items-center gap-2 ${
                    isDeadlinePassed ? "text-red-600" : "text-gray-600"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>
                    締め切り: {format(new Date(event.deadline), "M月d日(E) HH:mm", { locale: ja })}
                    {isDeadlinePassed && " (締め切り済み)"}
                  </span>
                </div>
              )}

              {event.description && (
                <div className="pt-3 border-t">
                  <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              <div className="pt-2 text-xs text-gray-500">作成者: {event.createdBy}</div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
        {!isPast && canRespond && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">出欠登録</h2>
            </CardHeader>
            <CardContent>
              <AttendanceForm
                eventId={eventId}
                currentAttendance={event.myAttendance}
                isDeadlinePassed={!!isDeadlinePassed}
                onSubmit={handleAttendanceSubmit}
              />
            </CardContent>
          </Card>
        )}

        {!canRespond && <GuestContactCard />}

        {canViewAttendees && event.attendees && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">参加者一覧</h2>
            </CardHeader>
            <CardContent>
              {event.attendees.length === 0 ? (
                <p className="text-gray-500 text-sm">まだ回答がありません</p>
              ) : (
                <AttendeeList attendees={event.attendees} />
              )}
            </CardContent>
          </Card>
        )}

        {canViewExpenses && event.attendees && (
          <AdminAttendanceManager
            eventId={event.id}
            attendees={event.attendees}
            eventFee={event.fee}
            onUpdated={() => fetchEvent()}
          />
        )}

        {canViewExpenses && event.expenses && (
          <ExpensesCard
            eventId={event.id}
            expenses={event.expenses}
            onUpdated={() => fetchEvent()}
          />
        )}
        </div>
      </main>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="イベントを削除"
        message="このイベントを削除しますか？この操作は取り消せません。"
        confirmText="削除する"
        variant="danger"
        loading={deleting}
      />

      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="イベントを中止"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            イベントを中止します。削除と違い、参加者には「中止」と表示されます。
          </p>
          <div>
            <label htmlFor="cancel-reason" className="block text-xs text-gray-600 mb-1">
              中止理由 (任意、メンバーに表示されます)
            </label>
            <textarea
              id="cancel-reason"
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="例: 会場の都合により中止"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setCancelModalOpen(false)} disabled={cancelling}>
              キャンセル
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleCancel} loading={cancelling}>
              中止する
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
