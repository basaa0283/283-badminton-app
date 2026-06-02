"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { permissions, UserRole } from "@/lib/permissions";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface ActivityLogItem {
  id: string;
  createdAt: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: string | null;
  user: { id: string; nickname: string } | null;
}

interface Pagination {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

// action の人間向けラベル。未登録は action そのままを表示。
const ACTION_LABEL: Record<string, string> = {
  "auth.login": "ログイン",
  "event.list_view": "イベント一覧を閲覧",
  "event.view": "イベント詳細を閲覧",
  "event.create": "イベントを登録",
  "event.update": "イベントを編集",
  "event.cancel": "イベントを中止",
  "event.delete": "イベントを削除",
  "attendance.update": "出欠を登録/変更",
  "announcement.list_view": "お知らせ一覧を閲覧",
  "announcement.create": "お知らせを投稿",
  "announcement.update": "お知らせを編集",
  "announcement.delete": "お知らせを削除",
  "member.approve": "メンバーを承認",
  "member.reject": "メンバーを却下",
  "member.role_change": "メンバーのロールを変更",
  "member.update": "メンバー情報を編集",
  "member.delete": "メンバーを削除",
  "member.merge": "メンバーをマージ",
  "profile.self_update": "プロフィールを編集 (本人)",
  "tournament.list_view": "大会一覧を閲覧",
  "tournament.view": "大会詳細を閲覧",
  "tournament.create": "大会を登録",
  "tournament.update": "大会を編集",
  "tournament.delete": "大会を削除",
  "tournament.approve": "大会を承認",
  "tournament.reject": "大会を却下",
  "tournament_result.create": "成績を登録",
  "tournament_result.update": "成績を編集",
  "tournament_result.delete": "成績を削除",
};

const PAGE_SIZE = 100;

export default function AdminActivityLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [logs, setLogs] = useState<ActivityLogItem[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);

  // フィルタ
  const [actionFilter, setActionFilter] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [offset, setOffset] = useState(0);

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

    setLoading(true);
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    fetch(`/api/admin/activity-log?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setLogs(json.data);
          setPagination(json.pagination);
        } else {
          setLogs([]);
        }
      })
      .finally(() => setLoading(false));
  }, [session, router, actionFilter, from, to, offset]);

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
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">操作ログ</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← 管理画面トップ
          </Link>
        </div>

        <Card className="mb-3">
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  種別フィルタ (action prefix)
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setOffset(0);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">すべて</option>
                  <option value="auth.">ログイン</option>
                  <option value="event.">イベント関連</option>
                  <option value="attendance.">出欠回答</option>
                  <option value="announcement.">お知らせ関連</option>
                  <option value="member.">メンバー管理</option>
                  <option value="profile.">プロフィール編集</option>
                  <option value="tournament.">大会関連</option>
                  <option value="tournament_result.">成績関連</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setOffset(0);
                    }}
                    className="block w-full min-w-0 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setOffset(0);
                    }}
                    className="block w-full min-w-0 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              {pagination && (
                <p className="text-xs text-gray-500">
                  全 {pagination.total} 件中 {pagination.offset + 1}–
                  {Math.min(pagination.offset + (logs?.length ?? 0), pagination.total)} 件表示
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {logs === null ? (
          <div className="text-gray-500 text-sm">読み込み中...</div>
        ) : logs.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-gray-600">条件に一致するログがありません。</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => {
              let metadataObj: Record<string, unknown> | null = null;
              if (l.metadata) {
                try {
                  metadataObj = JSON.parse(l.metadata);
                } catch {
                  // ignore parse error
                }
              }
              return (
                <Card key={l.id}>
                  <CardContent>
                    <div className="text-xs text-gray-500">
                      {format(new Date(l.createdAt), "yyyy/MM/dd HH:mm:ss", { locale: ja })}
                    </div>
                    <div className="text-sm font-medium text-gray-900 mt-0.5">
                      {l.user?.nickname ?? "(不明)"} → {ACTION_LABEL[l.action] ?? l.action}
                    </div>
                    {(l.entityType || metadataObj) && (
                      <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                        {l.entityType && (
                          <div>
                            <span className="text-gray-400">対象:</span> {l.entityType}
                            {l.entityId ? ` (${l.entityId.slice(0, 8)}…)` : ""}
                          </div>
                        )}
                        {metadataObj && Object.keys(metadataObj).length > 0 && (
                          <pre className="bg-gray-50 p-1.5 rounded text-[10px] overflow-auto max-h-20">
                            {JSON.stringify(metadataObj, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {pagination && pagination.total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between">
            <Button
              size="sm"
              variant="secondary"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              ← 前へ
            </Button>
            <span className="text-xs text-gray-500">
              {Math.floor(offset / PAGE_SIZE) + 1} /{" "}
              {Math.max(1, Math.ceil(pagination.total / PAGE_SIZE))}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={!pagination.hasMore || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              次へ →
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
