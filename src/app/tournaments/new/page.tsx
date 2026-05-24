"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TournamentForm, TournamentFormValues } from "@/components/tournaments/TournamentForm";
import { DateInput } from "@/components/ui/DateInput";
import { permissions, UserRole } from "@/lib/permissions";

interface ExistingTournament {
  id: string;
  name: string;
  prefecture: string | null;
  location: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
}

export default function NewTournamentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 2 ステップ構成: 先に「開催日」を選択 → 同日の既存大会を提示 → 同じものが無ければフォーム
  const [step, setStep] = useState<"date" | "form">("date");
  const [heldDay, setHeldDay] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [existing, setExisting] = useState<ExistingTournament[] | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    const role = session.user.role as UserRole;
    if (!permissions.canManageTournaments(role)) router.push("/tournaments");
  }, [session, router]);

  const handleDateNext = async () => {
    if (!heldDay) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/tournaments?date=${heldDay}`);
      const json = await res.json();
      if (json.success) setExisting(json.data);
      else setExisting([]);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (values: TournamentFormValues) => {
    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        heldAt: new Date(`${values.heldAt}T00:00:00Z`).toISOString(),
        openness: values.openness,
        prefecture: values.prefecture || null,
        format: values.format,
        location: values.location || null,
        description: values.description || null,
        classes: values.classes.map((c, idx) => ({
          category: c.category,
          name: c.name,
          tier: c.tier,
          order: idx,
        })),
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || "保存に失敗しました");
    router.push(`/tournaments/${json.data.id}`);
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
        <Card>
          <CardHeader>
            <h1 className="text-lg font-bold text-gray-900">大会を登録</h1>
            <p className="text-xs text-gray-500 mt-1">
              先に開催日を入力すると、その日に既に登録されている大会を表示します。重複登録を避けるためのステップです。
            </p>
          </CardHeader>
          <CardContent>
            {step === "date" ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開催日 *
                  </label>
                  <DateInput value={heldDay} onChange={setHeldDay} />
                </div>
                <Button onClick={handleDateNext} loading={checking} disabled={!heldDay} className="w-full">
                  次へ
                </Button>

                {existing !== null && (
                  <div className="border-t border-gray-100 pt-4">
                    {existing.length === 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-700">
                          この日付に登録された大会はまだありません。新規登録に進めます。
                        </p>
                        <Button onClick={() => setStep("form")} className="w-full">
                          新規に大会を作成する
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-amber-900">
                          この日付には既に <strong>{existing.length} 件</strong> の大会が登録されています。同じ大会ならそちらの詳細から成績登録できます。違う大会なら下のボタンで新規登録に進めます。
                        </p>
                        <ul className="divide-y divide-gray-100">
                          {existing.map((t) => (
                            <li key={t.id} className="py-2">
                              <Link
                                href={`/tournaments/${t.id}`}
                                className="block hover:bg-gray-50 -mx-3 px-3 py-1 rounded"
                              >
                                <div className="text-sm font-medium text-gray-900">{t.name}</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {t.prefecture ?? ""}
                                  {t.location ? ` ・ ${t.location}` : ""}
                                  {t.approvalStatus !== "approved" && (
                                    <span className="ml-1 text-amber-700">(承認待ち)</span>
                                  )}
                                </div>
                              </Link>
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant="secondary"
                          onClick={() => setStep("form")}
                          className="w-full"
                        >
                          これらとは別の大会を新規登録する
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <TournamentForm
                submitLabel="登録する"
                onSubmit={handleSubmit}
                initial={{ heldAt: heldDay }}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
