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

type AccessRow = { day: string; activeUsers: number };
type ActionRow = { day: string } & Record<string, number | string>;
type ViewRow = { day: string; pv: number };
type ViewsByPageRow = {
  action: string;
  label: string;
  last30: number;
  last7: number;
};
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
  viewsByDay: ViewRow[];
  viewsByPage: ViewsByPageRow[];
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

type LineQuota = {
  configured: boolean;
  quotaType?: string;
  limit?: number | null;
  used?: number;
  remaining?: number | null;
};

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [lineQuota, setLineQuota] = useState<LineQuota | null>(null);
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
    fetch("/api/admin/line-quota")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setLineQuota(json.data);
      })
      .catch(() => {});
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
            {lineQuota?.configured && lineQuota.limit !== null && lineQuota.limit !== undefined && (
              <Card
                className={
                  (lineQuota.remaining ?? 0) <= 20
                    ? "border-2 border-red-300 bg-red-50"
                    : (lineQuota.remaining ?? 0) <= 50
                      ? "border-2 border-amber-300 bg-amber-50"
                      : ""
                }
              >
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600">今月の LINE 通知送信</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {lineQuota.used ?? 0}
                        <span className="text-base text-gray-500 font-normal">
                          {" / "}{lineQuota.limit} 通
                        </span>
                      </p>
                      <p className={`text-xs mt-1 ${(lineQuota.remaining ?? 0) <= 20 ? "text-red-700 font-medium" : "text-gray-600"}`}>
                        残り {lineQuota.remaining} 通
                        {(lineQuota.remaining ?? 0) <= 20 && " (上限間近)"}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>フリープラン: 200 通/月</p>
                      <p className="mt-0.5">超過すると以降の月内 push 送信は失敗します</p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={`h-full ${(lineQuota.remaining ?? 0) <= 20 ? "bg-red-500" : (lineQuota.remaining ?? 0) <= 50 ? "bg-amber-500" : "bg-blue-500"}`}
                      style={{
                        width: `${Math.min(100, ((lineQuota.used ?? 0) / (lineQuota.limit || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

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
                  日別アクティブユーザー (直近 30 日)
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  その日に何らかの操作 or 閲覧があった unique user 数 (LINE 再認証ではありません)
                </p>
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
                        formatter={(v) => [`${Number(v)} 人`, "アクティブ"] as [string, string]}
                      />
                      <Line
                        type="monotone"
                        dataKey="activeUsers"
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
                  日別ページビュー (直近 30 日)
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  ホーム / イベント / 大会 / メンバー詳細などの閲覧件数合算
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.viewsByDay} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="day" tickFormatter={fmtDate} fontSize={11} stroke="#9CA3AF" />
                      <YAxis allowDecimals={false} fontSize={11} stroke="#9CA3AF" />
                      <Tooltip
                        labelFormatter={(v) => fmtDate(String(v))}
                        formatter={(v) => [`${Number(v)} 件`, "PV"] as [string, string]}
                      />
                      <Line
                        type="monotone"
                        dataKey="pv"
                        stroke="#10B981"
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
                  ページ別ページビュー (直近 30 日)
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  どのページがよく見られているかランキング
                </p>
              </CardHeader>
              <CardContent>
                {data.viewsByPage.every((v) => v.last30 === 0) ? (
                  <p className="text-sm text-gray-500">まだ閲覧ログがありません。</p>
                ) : (
                  <ul className="space-y-2">
                    {(() => {
                      const max = Math.max(1, ...data.viewsByPage.map((v) => v.last30));
                      return data.viewsByPage.map((v) => {
                        const pct = Math.round((v.last30 / max) * 100);
                        return (
                          <li key={v.action} className="text-sm">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-medium text-gray-900 truncate flex-1">
                                {v.label}
                              </span>
                              <span className="text-xs text-gray-500 shrink-0">
                                {v.last30} 件 (うち 7 日: {v.last7})
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </li>
                        );
                      });
                    })()}
                  </ul>
                )}
                <p className="text-xs text-gray-400 mt-3">
                  メンバー詳細は「誰が誰のページを見たか」が個別ログに残ります (操作ログから検索可)。
                </p>
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
