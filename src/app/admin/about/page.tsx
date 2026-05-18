"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";
import { permissions, UserRole } from "@/lib/permissions";

/**
 * /admin/about - サークル概要ページ (`/about`) の本文を編集する管理画面。
 * SystemSetting.aboutPageContent を読み書きする。
 */
export default function AdminAboutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      const role = session.user.role as UserRole;
      if (!permissions.canAccessAdmin(role)) router.push("/");
    }
  }, [session, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/admin/settings")
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            setContent(json.data.aboutPageContent || "");
            setOriginalContent(json.data.aboutPageContent || "");
          }
        })
        .finally(() => setLoading(false));
    }
  }, [status]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aboutPageContent: content }),
      });
      const data = await res.json();
      if (data.success) {
        setOriginalContent(content);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  const dirty = content !== originalContent;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/admin" className="text-blue-600 text-sm hover:underline">
            ← 管理に戻る
          </Link>
          <Link
            href="/about"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 text-sm hover:underline"
          >
            公開ページを開く ↗
          </Link>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-4">サークル概要ページ</h1>
        <p className="text-sm text-gray-600 mb-2">
          公開ページ <code>/about</code> の本文です (Markdown 対応、未ログインでも閲覧可)。
        </p>
        <p className="text-xs text-gray-500 mb-4">
          ※ 「お問い合わせ」セクションは <code>/admin</code> で設定した公式 LINE URL から自動表示されます。本文には書かなくて OK です。
        </p>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreview(false)}
                  className={`text-xs px-3 py-1 rounded-full ${
                    !showPreview ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                  }`}
                >
                  編集
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className={`text-xs px-3 py-1 rounded-full ${
                    showPreview ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                  }`}
                >
                  プレビュー
                </button>
              </div>
              {dirty && (
                <span className="text-xs text-amber-700">未保存の変更があります</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showPreview ? (
              <div className="min-h-[300px] border border-gray-200 rounded-lg p-4 bg-gray-50">
                {content.trim() ? (
                  <Markdown source={content} />
                ) : (
                  <p className="text-gray-400 text-sm">プレビューするテキストがありません</p>
                )}
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                placeholder={"# ２８ばど について\n\nサークルの紹介を Markdown で書いてください。\n\n## 練習の流れ\n- ...\n"}
              />
            )}
            <div className="mt-3 flex items-center gap-2">
              {saved && <span className="text-sm text-green-700">保存しました</span>}
              <div className="flex-1" />
              <Button onClick={handleSave} loading={saving} disabled={!dirty}>
                保存
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-xs text-gray-500">
          Markdown 記法: <code># 見出し</code>、<code>- リスト</code>、
          <code>**太字**</code>、<code>[リンク](URL)</code>、<code>&gt; 引用</code> など。
        </p>
      </main>
    </div>
  );
}
