"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Header } from "@/components/layout/Header";
import { AttendanceForm } from "@/components/events/AttendanceForm";
import { AttendeeList } from "@/components/events/AttendeeList";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/Modal";
import { permissions, UserRole } from "@/lib/permissions";

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  eventEndDate: string | null;
  location: string | null;
  capacity: number | null;
  fee: number | null;
  feeVisible: boolean;
  deadline: string | null;
  deadlineEnabled: boolean;
  createdBy: string;
  createdById: string;
  attendingCount: number;
  waitlistCount: number;
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
  }> | null;
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
  const eventDate = new Date(event.eventDate);
  const isDeadlinePassed =
    event.deadlineEnabled && event.deadline && new Date(event.deadline) < new Date();
  const isPast = eventDate < new Date();

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
              <h1 className="text-xl font-bold text-gray-900">{event.title}</h1>
              {canEdit && (
                <div className="flex gap-2">
                  <Link href={`/events/${eventId}/edit`}>
                    <Button size="sm" variant="secondary">
                      編集
                    </Button>
                  </Link>
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
                  {format(eventDate, "yyyy年M月d日(E) HH:mm", { locale: ja })}
                  {event.eventEndDate && ` 〜 ${format(new Date(event.eventEndDate), "HH:mm", { locale: ja })}`}
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

        {!isPast && (
          <Card className="mb-4">
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

        {!canViewAttendees && (
          <Card>
            <CardContent>
              <p className="text-gray-500 text-sm text-center py-4">
                参加者一覧は一般メンバー以上のみ閲覧できます
              </p>
            </CardContent>
          </Card>
        )}
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
    </div>
  );
}
