"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { permissions, UserRole } from "@/lib/permissions";

type AccessRow = { day: string; logins: number };
type ActionRow = { day: string } & Record<string, number | string>;
type AnnouncementRow = {
  id: string;
  title: string;
  publishedAt: string;
  readCount: number;
  targetCount: number;
  rate: number;
};
type AnalyticsData = {
  accessByDay: AccessRow[];
  actionsByDay: ActionRow[];
  trackedActions: string[];
  activeUsers: { last7: number; last30: number };
  announcements: AnnouncementRow[];
};

const ACTION_LABEL: Record<string, string> = {
  "event.create": "イベント作成",
  "attendance.update": "出欠回答",
  "tournament.create": "大会登録",
  "tournament_result.create": "成績登録",
  "announcement.create": "お知らせ投稿",
};
const ACTION_COLOR: Record<string, string> = {
  "event.create": "#3B82F6",
  "attendance.update": "#10B981",
  "tournament.create": "#8B5CF6",
  "tournament_result.create": "#EC4899",
  "announcement.create": "#F59E0B",
};

function fmtDate(day: string) {
  // "2026-06-02" → "6/2"
  const [, m, d] = day.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      router.push("/");
      return;
    }
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, [session, router]);

  if (status === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">利用状況ダッシュボード</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← 管理画面トップ
          </Link>
        </div>

        {!data ? (
          <Card>
            <CardContent>
              <p className="text-sm text-gray-600">データを取得できませんでした。</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent>
                  <p className="text-xs text-gray-500">過去 7 日のアクティブユーザー</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {data.activeUsers.last7}
                    <span className="text-sm text-gray-500 font-normal ml-1">人</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <p className="text-xs text-gray-500">過去 30 日のアクティブユーザー</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {data.activeUsers.last30}
                    <span className="text-sm text-gray-500 font-normal ml-1">人</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-900">
                  日別ログイン unique user (直近 30 日)
                </h2>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.accessByDay} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="day" tickFormatter={fmtDate} fontSize={11} stroke="#9CA3AF" />
                      <YAxis allowDecimals={false} fontSize={11} stroke="#9CA3AF" />
                      <Tooltip
                        labelFormatter={(v) => fmtDate(String(v))}
                        formatter={(v) => [`${Number(v)} 人`, "ログイン"] as [string, string]}
                      />
                      <Line
                        type="monotone"
                        dataKey="logins"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-900">
                  主要操作の件数推移 (直近 30 日)
                </h2>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.actionsByDay} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="day" tickFormatter={fmtDate} fontSize={11} stroke="#9CA3AF" />
                      <YAxis allowDecimals={false} fontSize={11} stroke="#9CA3AF" />
                      <Tooltip labelFormatter={(v) => fmtDate(String(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {data.trackedActions.map((a) => (
                        <Bar
                          key={a}
                          dataKey={a}
                          stackId="actions"
                          fill={ACTION_COLOR[a] ?? "#9CA3AF"}
                          name={ACTION_LABEL[a] ?? a}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-900">
                  お知らせ既読率 (直近 20 件)
                </h2>
              </CardHeader>
              <CardContent>
                {data.announcements.length === 0 ? (
                  <p className="text-sm text-gray-500">お知らせがまだありません。</p>
                ) : (
                  <ul className="space-y-2">
                    {data.announcements.map((a) => {
                      const pct = Math.round(a.rate * 100);
                      return (
                        <li key={a.id} className="text-sm">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium text-gray-900 truncate flex-1">
                              {a.title}
                            </span>
                            <span className="text-xs text-gray-500 shrink-0">
                              {a.readCount} / {a.targetCount} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-gray-400 text-center">
              ※ 操作ログを記録し始めた時点以降のデータのみ集計されます。
            </p>
          </>
        )}
      </main>
    </div>
  );
}
