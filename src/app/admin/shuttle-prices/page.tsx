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

interface ShuttlePrice {
  id: string;
  effectiveFrom: string;
  casePrice: number;
  shuttlesPerCase: number;
  memo: string | null;
  createdAt: string;
}

export default function ShuttlePricesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [prices, setPrices] = useState<ShuttlePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [casePrice, setCasePrice] = useState("");
  const [shuttlesPerCase, setShuttlesPerCase] = useState("120");
  const [memo, setMemo] = useState("");

  // 二重実行ガード (state では React の更新タイミング差で防げないケースがある)
  const submittingRef = useRef(false);
  const deletingRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      const role = session.user.role as UserRole;
      if (!permissions.canAccessAdmin(role)) router.push("/");
    }
  }, [session, router]);

  const fetchPrices = async () => {
    const res = await fetch("/api/admin/shuttle-prices");
    const data = await res.json();
    if (data.success) setPrices(data.data);
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchPrices().finally(() => setLoading(false));
    }
  }, [status]);

  const resetForm = () => {
    setEffectiveFrom(today);
    setCasePrice("");
    setShuttlesPerCase("120");
    setMemo("");
    setError(null);
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/shuttle-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveFrom: new Date(effectiveFrom).toISOString(),
          casePrice: Number(casePrice),
          shuttlesPerCase: Number(shuttlesPerCase),
          memo: memo.trim() || null,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "登録に失敗しました");
        return;
      }
      resetForm();
      setShowForm(false);
      await fetchPrices();
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingRef.current === id) return;
    deletingRef.current = id;
    try {
      if (!confirm("この単価を削除しますか？")) return;
      await fetch(`/api/admin/shuttle-prices/${id}`, { method: "DELETE" });
      await fetchPrices();
    } finally {
      deletingRef.current = null;
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
          <h1 className="text-xl font-bold text-gray-900">シャトル単価管理</h1>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              + 単価を追加
            </Button>
          )}
        </div>

        <p className="text-xs text-gray-500 mb-4">
          各イベントの開催日に対し、開催日以前の最新の単価が自動適用されます。1ケース = {120}個（10本 × 12個）が標準。
        </p>

        {showForm && (
          <Card className="mb-4">
            <CardHeader>
              <h2 className="font-semibold text-gray-900 text-sm">新しい単価を追加</h2>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">{error}</div>
              )}
              <div className="space-y-3">
                <div>
                  <label htmlFor="sp-from" className="block text-xs text-gray-600 mb-1">適用開始日</label>
                  <input
                    id="sp-from"
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="sp-case" className="block text-xs text-gray-600 mb-1">
                    ケース価格 (円) — 1ケース = 10本×12個 = 120個
                  </label>
                  <input
                    id="sp-case"
                    type="number"
                    min={1}
                    value={casePrice}
                    onChange={(e) => setCasePrice(e.target.value)}
                    placeholder="例: 63110"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="sp-count" className="block text-xs text-gray-600 mb-1">ケース内の個数</label>
                  <input
                    id="sp-count"
                    type="number"
                    min={1}
                    value={shuttlesPerCase}
                    onChange={(e) => setShuttlesPerCase(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="sp-memo" className="block text-xs text-gray-600 mb-1">メモ (任意)</label>
                  <input
                    id="sp-memo"
                    type="text"
                    maxLength={500}
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="例: ヨネックス AS50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="secondary"
                    className="flex-1 text-sm"
                    onClick={() => { resetForm(); setShowForm(false); }}
                    disabled={submitting}
                  >
                    キャンセル
                  </Button>
                  <Button
                    className="flex-1 text-sm"
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={!casePrice || !effectiveFrom}
                  >
                    登録
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : prices.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              単価が登録されていません
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {prices.map((p) => {
              const perPiece = p.casePrice / p.shuttlesPerCase;
              return (
                <Card key={p.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {format(new Date(p.effectiveFrom), "yyyy/M/d", { locale: ja })} 〜
                        </div>
                        <div className="text-xs text-gray-500">
                          ケース {p.casePrice.toLocaleString()}円 / 1個あたり {perPiece.toFixed(1)}円 (
                          {p.shuttlesPerCase}個入り)
                        </div>
                        {p.memo && <div className="text-xs text-gray-400 mt-0.5">{p.memo}</div>}
                      </div>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
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
