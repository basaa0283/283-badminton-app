"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { AttendanceStatusBadge } from "@/components/ui/Badge";
import { permissions, UserRole } from "@/lib/permissions";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface AttendanceHistoryItem {
  id: string;
  status: string;
  comment: string | null;
  changedAt: string;
  user: {
    id: string;
    nickname: string;
  };
  event: {
    id: string;
    title: string;
    eventDate: string;
  };
}

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [histories, setHistories] = useState<AttendanceHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      const role = session.user.role as UserRole;
      if (!permissions.canAccessAdmin(role)) {
        router.push("/");
      }
    }
  }, [session, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/history?type=attendance&limit=100");
      const json = await res.json();
      if (json.success) {
        setHistories(json.data.histories);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "MM/dd HH:mm", { locale: ja });
  };

  const formatEventDate = (dateString: string) => {
    return format(new Date(dateString), "M/d(E)", { locale: ja });
  };

  const handleHistoryClick = (eventId: string) => {
    router.push(`/events/${eventId}`);
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">出欠回答履歴</h1>

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : histories.length === 0 ? (
          <p className="text-center py-8 text-gray-500">データがありません</p>
        ) : (
          <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
            {histories.map((history) => (
              <div
                key={history.id}
                className="px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                onClick={() => handleHistoryClick(history.event.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-gray-900 truncate">
                      {history.user.nickname}
                    </span>
                    <AttendanceStatusBadge status={history.status} />
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDateTime(history.changedAt)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  <span className="text-gray-400 mr-2">{formatEventDate(history.event.eventDate)}</span>
                  {history.event.title}
                </div>
                {history.comment && (
                  <div className="text-sm text-gray-400 mt-1">
                    {history.comment}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
