"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { RoleBadge, AttendanceStatusBadge } from "@/components/ui/Badge";
import { permissions, UserRole } from "@/lib/permissions";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type TabType = "login" | "attendance";

interface UserActivity {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  role: string;
  lastActiveAt: string | null;
  createdAt: string;
}

interface AttendanceHistoryItem {
  id: string;
  status: string;
  comment: string | null;
  changedAt: string;
  user: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
    role: string;
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
  const [activeTab, setActiveTab] = useState<TabType>("login");
  const [loginData, setLoginData] = useState<UserActivity[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceHistoryItem[]>([]);
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
  }, [session, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/history?type=${activeTab}&limit=100`);
      const json = await res.json();
      if (json.success) {
        if (activeTab === "login") {
          setLoginData(json.data.users);
        } else {
          setAttendanceData(json.data.histories);
        }
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "未操作";
    return format(new Date(dateString), "yyyy/MM/dd HH:mm", { locale: ja });
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "たった今";
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    return "";
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
        <h1 className="text-xl font-bold text-gray-900 mb-4">履歴管理</h1>

        {/* タブ */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab("login")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "login"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            ログイン履歴
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "attendance"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            出欠回答履歴
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : activeTab === "login" ? (
          <div className="space-y-2">
            {loginData.length === 0 ? (
              <p className="text-center py-8 text-gray-500">データがありません</p>
            ) : (
              loginData.map((user) => (
                <Card key={user.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      {user.profileImageUrl ? (
                        <img
                          src={user.profileImageUrl}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500">{user.nickname[0]}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {user.nickname}
                          </span>
                          <RoleBadge role={user.role} />
                        </div>
                        <div className="text-sm text-gray-500">
                          最終操作: {formatDateTime(user.lastActiveAt)}
                          {user.lastActiveAt && (
                            <span className="ml-2 text-gray-400">
                              ({formatRelativeTime(user.lastActiveAt)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {attendanceData.length === 0 ? (
              <p className="text-center py-8 text-gray-500">データがありません</p>
            ) : (
              attendanceData.map((history) => (
                <Card key={history.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      {history.user.profileImageUrl ? (
                        <img
                          src={history.user.profileImageUrl}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500">{history.user.nickname[0]}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">
                            {history.user.nickname}
                          </span>
                          <RoleBadge role={history.user.role} />
                          <AttendanceStatusBadge status={history.status} />
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {history.event.title}
                        </div>
                        {history.comment && (
                          <div className="text-sm text-gray-500 mt-1">
                            コメント: {history.comment}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {formatDateTime(history.changedAt)}
                          {history.changedAt && (
                            <span className="ml-2">
                              ({formatRelativeTime(history.changedAt)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
