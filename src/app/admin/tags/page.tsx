"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { permissions, UserRole } from "@/lib/permissions";

interface MemberTag {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  userCount: number;
  eventCount: number;
}

interface MemberRow {
  id: string;
  nickname: string;
  role: string;
}

// /admin/tags - メンバータグ CRUD ページ。
// タグは「特定メンバーだけにイベントを公開する」用途で使う。
export default function AdminTagsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tags, setTags] = useState<MemberTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      const role = session.user.role as UserRole;
      if (!permissions.canAccessAdmin(role)) router.push("/");
    }
  }, [session, router]);

  const fetchTags = async () => {
    const res = await fetch("/api/admin/tags");
    const json = await res.json();
    if (json.success) setTags(json.data);
    setLoading(false);
  };

  useEffect(() => {
    if (status === "authenticated") fetchTags();
  }, [status]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          color: newColor.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "作成に失敗しました");
        return;
      }
      setNewName("");
      setNewDescription("");
      setNewColor("");
      await fetchTags();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string, userCount: number, eventCount: number) => {
    if (
      !confirm(
        `タグ「${name}」を削除します。\n` +
          `・付与中メンバー: ${userCount} 人 (タグ紐付けが解除される)\n` +
          `・利用イベント: ${eventCount} 件 (タグ未指定 = 全員公開に戻る)\n` +
          `実行しますか？`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/tags/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) {
      alert(json.error?.message || "削除に失敗しました");
      return;
    }
    await fetchTags();
  };

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
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-4">
          <Link href="/admin" className="text-blue-600 text-sm hover:underline">
            ← 管理に戻る
          </Link>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">メンバータグ管理</h1>
        <p className="text-sm text-gray-600 mb-4">
          タグを作って特定のメンバーに付与し、イベントを「このタグ持ちだけに公開」できます。
        </p>

        <Card className="mb-4">
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">新規タグ作成</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="タグ名 (例: 選抜練習)"
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="説明 (任意)"
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  placeholder="バッジ色 (#hex、任意)"
                  maxLength={20}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <Button onClick={handleCreate} loading={creating} disabled={!newName.trim()}>
                  作成
                </Button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">タグ一覧 ({tags.length})</h2>
          </CardHeader>
          <CardContent>
            {tags.length === 0 ? (
              <p className="text-sm text-gray-500">まだタグがありません。</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {tags.map((t) => (
                  <TagRow
                    key={t.id}
                    tag={t}
                    onDelete={() => handleDelete(t.id, t.name, t.userCount, t.eventCount)}
                    onRefresh={fetchTags}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function TagRow({
  tag,
  onDelete,
  onRefresh,
}: {
  tag: MemberTag;
  onDelete: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && members.length === 0) {
      setLoadingAssign(true);
      try {
        const [mRes, aRes] = await Promise.all([
          fetch("/api/members"),
          fetch(`/api/admin/tags/${tag.id}/users`),
        ]);
        const m = await mRes.json();
        const a = await aRes.json();
        if (m.success) {
          setMembers(
            (m.data as MemberRow[]).filter(
              (mm) => mm.role !== "pending" && mm.role !== "guest",
            ),
          );
        }
        if (a.success) setAssignedIds(new Set(a.data.userIds as string[]));
      } finally {
        setLoadingAssign(false);
      }
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tags/${tag.id}/users`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [...assignedIds] }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || "保存に失敗しました");
        return;
      }
      await onRefresh();
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
          style={{ backgroundColor: tag.color || "#6B7280" }}
        >
          {tag.name}
        </span>
        {tag.description && (
          <span className="text-xs text-gray-500">{tag.description}</span>
        )}
        <span className="text-xs text-gray-400">
          👤 {tag.userCount} / 📅 {tag.eventCount}
        </span>
        <div className="flex-1" />
        <button
          onClick={toggleExpand}
          className="text-xs text-blue-600 hover:underline"
        >
          {expanded ? "閉じる" : "メンバー割当て"}
        </button>
        <button
          onClick={onDelete}
          className="text-xs text-red-600 hover:underline"
        >
          削除
        </button>
      </div>
      {expanded && (
        <div className="mt-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
          {loadingAssign ? (
            <p className="text-xs text-gray-500">メンバー読み込み中...</p>
          ) : (
            <>
              <div className="max-h-60 overflow-auto space-y-1">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={assignedIds.has(m.id)}
                      onChange={(e) => {
                        setAssignedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(m.id);
                          else next.delete(m.id);
                          return next;
                        });
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span>{m.nickname}</span>
                    <span className="text-xs text-gray-400">({m.role})</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={save} loading={saving}>
                  保存 ({assignedIds.size} 人)
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}
