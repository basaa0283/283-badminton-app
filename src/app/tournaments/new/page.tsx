"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { TournamentForm, TournamentFormValues } from "@/components/tournaments/TournamentForm";
import { permissions, UserRole } from "@/lib/permissions";

export default function NewTournamentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    const role = session.user.role as UserRole;
    if (!permissions.canManageTournaments(role)) router.push("/tournaments");
  }, [session, router]);

  const handleSubmit = async (values: TournamentFormValues) => {
    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        // T00:00:00Z (UTC) で保存して TZ ズレを避ける。表示側は日付だけ使うので
        // 時刻はゼロ固定で問題ない。
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
              登録後、管理者の承認が完了するまで他のメンバーには表示されません。
            </p>
          </CardHeader>
          <CardContent>
            <TournamentForm submitLabel="登録する" onSubmit={handleSubmit} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
