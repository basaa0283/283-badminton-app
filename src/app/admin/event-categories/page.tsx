"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { permissions, UserRole } from "@/lib/permissions";

interface EventCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  order: number;
}

const COLOR_PRESETS = [
  "#3B82F6", "#8B5CF6", "#10B981", "#EF4444", "#F59E0B",
  "#EC4899", "#14B8A6", "#6B7280",
];

export default function EventCategoriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const fetchCategories = async () => {
    const res = await fetch("/api/admin/event-categories");
    const data = await res.json();
    if (data.success) setCategories(data.data);
  };

  useEffect(() => {
    if (status === "authenticated") fetchCategories().finally(() => setLoading(false));
  }, [status]);

  const handleAdd = async () => {
    if (submitRef.current) return;
    if (!name.trim()) return;
    submitRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/event-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          color,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "登録に失敗しました");
        return;
      }
      setName("");
      setDescription("");
      setShowForm(false);
      await fetchCategories();
    } finally {
      setSubmitting(false);
      submitRef.current = false;
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteRef.current === id) return;
    deleteRef.current = id;
    try {
      if (!confirm("この種別を削除しますか？関連イベントの種別は未指定になります。")) return;
      await fetch(`/api/admin/event-categories/${id}`, { method: "DELETE" });
      await fetchCategories();
    } finally {
      deleteRef.current = null;
    }
  };

  const handleUpdateColor = async (id: string, newColor: string) => {
    await fetch(`/api/admin/event-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: newColor }),
    });
    await fetchCategories();
  };

  const startEditDesc = (c: EventCategory) => {
    setEditingDescId(c.id);
    setEditingDesc(c.description ?? "");
  };

  const saveDesc = async (id: string) => {
    await fetch(`/api/admin/event-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: editingDesc.trim() || null }),
    });
    setEditingDescId(null);
    await fetchCategories();
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
          <h1 className="text-xl font-bold text-gray-900">イベント種別タグ</h1>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              + 追加
            </Button>
          )}
        </div>

        {!loading && categories.length === 0 && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <p className="text-sm text-gray-700">
                種別がまだ登録されていません。右上の「+ 追加」から登録してください。
              </p>
            </CardContent>
          </Card>
        )}

        {showForm && (
          <Card className="mb-4">
            <CardHeader>
              <h2 className="font-semibold text-gray-900 text-sm">新しい種別を追加</h2>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">{error}</div>
              )}
              <div className="space-y-3">
                <div>
                  <label htmlFor="cat-name" className="block text-xs text-gray-600 mb-1">名称</label>
                  <input
                    id="cat-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="例: シングル練"
                  />
                </div>
                <div>
                  <label htmlFor="cat-desc" className="block text-xs text-gray-600 mb-1">
                    説明文 <span className="text-gray-400">(任意)</span>
                  </label>
                  <textarea
                    id="cat-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="このタグの意味や対象を簡潔に。ホバー / タップで表示されます。"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">色</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        aria-label={`色 ${c}`}
                        className={`w-8 h-8 rounded-full border-2 ${
                          color === c ? "border-gray-900" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" className="flex-1 text-sm" onClick={() => { setShowForm(false); setName(""); setDescription(""); setError(null); }} disabled={submitting}>
                    キャンセル
                  </Button>
                  <Button className="flex-1 text-sm" onClick={handleAdd} loading={submitting} disabled={!name.trim()}>
                    登録
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : categories.length > 0 ? (
          <div className="space-y-2">
            {categories.map((c) => (
              <Card key={c.id}>
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                        style={{ backgroundColor: c.color ?? "#6B7280" }}
                      >
                        {c.name}
                      </span>
                      <div className="flex gap-1">
                        {COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleUpdateColor(c.id, preset)}
                            aria-label={`色 ${preset}`}
                            className={`w-4 h-4 rounded-full ${c.color === preset ? "ring-2 ring-gray-700" : ""}`}
                            style={{ backgroundColor: preset }}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      削除
                    </button>
                  </div>

                  {editingDescId === c.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingDesc}
                        onChange={(e) => setEditingDesc(e.target.value)}
                        maxLength={500}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="このタグの意味や対象を簡潔に"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditingDescId(null)}>
                          キャンセル
                        </Button>
                        <Button size="sm" onClick={() => saveDesc(c.id)}>
                          保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs ${c.description ? "text-gray-700" : "text-gray-400 italic"} whitespace-pre-wrap flex-1`}>
                        {c.description || "(説明未設定)"}
                      </p>
                      <button
                        type="button"
                        onClick={() => startEditDesc(c)}
                        className="text-xs text-blue-600 hover:underline shrink-0"
                      >
                        編集
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
