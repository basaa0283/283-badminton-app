"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { permissions, UserRole } from "@/lib/permissions";
import { SEVERITY_STYLE, Severity } from "@/lib/announcement";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audienceMember: boolean;
  audienceVisitor: boolean;
  audienceGuest: boolean;
  severity: string;
  publishedAt: string;
  createdBy?: { nickname: string } | null;
}

function audienceLabel(a: Pick<Announcement, "audienceMember" | "audienceVisitor" | "audienceGuest">): string {
  const targets: string[] = [];
  if (a.audienceMember) targets.push("一般");
  if (a.audienceVisitor) targets.push("ビジター");
  if (a.audienceGuest) targets.push("ゲスト");
  return targets.length === 3 ? "全員" : targets.length === 0 ? "(なし)" : targets.join(" / ");
}

export default function AdminAnnouncementsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceMember, setAudienceMember] = useState(true);
  const [audienceVisitor, setAudienceVisitor] = useState(true);
  const [audienceGuest, setAudienceGuest] = useState(true);
  const [severity, setSeverity] = useState<Severity>("info");

  const submitRef = useRef(false);
  const deleteRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      const role = session.user.role as UserRole;
      if (!permissions.canAccessAdmin(role)) router.push("/");
    }
  }, [session, router]);

  const fetchItems = async () => {
    const res = await fetch("/api/admin/announcements");
    const data = await res.json();
    if (data.success) setItems(data.data);
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchItems().finally(() => setLoading(false));
    }
  }, [status]);

  const resetForm = () => {
    setTitle("");
    setBody("");
    setAudienceMember(true);
    setAudienceVisitor(true);
    setAudienceGuest(true);
    setSeverity("info");
    setEditingId(null);
    setError(null);
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setAudienceMember(a.audienceMember);
    setAudienceVisitor(a.audienceVisitor);
    setAudienceGuest(a.audienceGuest);
    setSeverity((a.severity as Severity) || "info");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (submitRef.current) return;
    if (!title.trim() || !body.trim()) return;
    submitRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const isEdit = !!editingId;
      const url = isEdit
        ? `/api/admin/announcements/${editingId}`
        : "/api/admin/announcements";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          audienceMember,
          audienceVisitor,
          audienceGuest,
          severity,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "保存に失敗しました");
        return;
      }
      resetForm();
      setShowForm(false);
      await fetchItems();
    } finally {
      setSubmitting(false);
      submitRef.current = false;
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteRef.current === id) return;
    deleteRef.current = id;
    try {
      if (!confirm("このお知らせを削除しますか？")) return;
      await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      await fetchItems();
    } finally {
      deleteRef.current = null;
    }
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

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-4">
          <Link href="/admin" className="text-blue-600 text-sm hover:underline">
            ← 管理に戻る
          </Link>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">お知らせ管理</h1>
          {!showForm && (
            <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
              + 新規投稿
            </Button>
          )}
        </div>

        {showForm && (
          <Card className="mb-4">
            <CardHeader>
              <h2 className="font-semibold text-gray-900 text-sm">
                {editingId ? "お知らせを編集" : "新しいお知らせ"}
              </h2>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">{error}</div>
              )}
              <div className="space-y-3">
                <div>
                  <label htmlFor="ann-title" className="block text-xs text-gray-600 mb-1">タイトル</label>
                  <input
                    id="ann-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="例: アプリをv1.5.0に更新しました"
                  />
                </div>
                <div>
                  <label htmlFor="ann-body" className="block text-xs text-gray-600 mb-1">本文</label>
                  <textarea
                    id="ann-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={5}
                    maxLength={4000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="詳細を記入"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">対象 (複数選択可、admin/subadmin は常に閲覧可)</label>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={audienceMember}
                        onChange={(e) => setAudienceMember(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      一般
                    </label>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={audienceVisitor}
                        onChange={(e) => setAudienceVisitor(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      ビジター
                    </label>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={audienceGuest}
                        onChange={(e) => setAudienceGuest(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      ゲスト
                    </label>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={severity === "important"}
                    onChange={(e) => setSeverity(e.target.checked ? "important" : "info")}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  重要なお知らせとして強調表示する
                </label>
                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" className="flex-1 text-sm" onClick={() => { resetForm(); setShowForm(false); }} disabled={submitting}>
                    キャンセル
                  </Button>
                  <Button className="flex-1 text-sm" onClick={handleSave} loading={submitting} disabled={!title.trim() || !body.trim()}>
                    {editingId ? "更新" : "投稿"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              まだお知らせはありません
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((a) => {
              const sev = (a.severity as Severity) || "info";
              const style = SEVERITY_STYLE[sev] ?? SEVERITY_STYLE.info;
              return (
                <Card key={a.id} className={`${style.bg} ${style.border} border`}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2 mb-1 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${style.text} bg-white/60`}>
                        {style.label}
                      </span>
                      <span className="text-gray-500">
                        {format(new Date(a.publishedAt), "yyyy/M/d", { locale: ja })}
                      </span>
                      <span className="text-gray-500">対象: {audienceLabel(a)}</span>
                    </div>
                    <h2 className="font-bold text-gray-900 mb-1">{a.title}</h2>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{a.body}</p>
                    <div className="mt-2 flex gap-3">
                      <button onClick={() => startEdit(a)} className="text-xs text-blue-600 hover:underline">
                        編集
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="text-xs text-red-500 hover:underline">
                        削除
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
