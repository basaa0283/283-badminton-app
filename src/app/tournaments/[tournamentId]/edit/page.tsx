"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { TournamentForm, TournamentFormValues, ClassRow } from "@/components/tournaments/TournamentForm";
import { permissions, UserRole } from "@/lib/permissions";
import {
  TournamentTier,
  TournamentFormat,
  TournamentCategory,
  TournamentOpenness,
  Prefecture,
} from "@/lib/tournament-meta";

interface TournamentDetail {
  id: string;
  name: string;
  heldAt: string;
  tier: string;
  openness: string;
  prefecture: string | null;
  format: string;
  location: string | null;
  description: string | null;
  createdById: string;
  classes: {
    category: TournamentCategory;
    name: string | null;
    order: number;
    approvalStatus: "approved" | "pending";
  }[];
}

export default function EditTournamentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const [data, setData] = useState<TournamentDetail | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    const role = session.user.role as UserRole;
    if (!permissions.canManageTournaments(role)) {
      router.push("/tournaments");
      return;
    }
    fetch(`/api/tournaments/${tournamentId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) {
          router.push("/tournaments");
          return;
        }
        const t = json.data;
        if (t.createdById !== session.user.id && !permissions.canApproveTournaments(role)) {
          alert("他の人が登録した大会は管理者のみ編集できます");
          router.push(`/tournaments/${tournamentId}`);
          return;
        }
        setData(t);
      });
  }, [session, router, tournamentId]);

  const handleSubmit = async (values: TournamentFormValues) => {
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        heldAt: new Date(`${values.heldAt}T00:00:00`).toISOString(),
        tier: values.tier,
        openness: values.openness,
        prefecture: values.prefecture || null,
        format: values.format,
        location: values.location || null,
        description: values.description || null,
        classes: values.classes.map((c, idx) => ({
          category: c.category,
          name: c.name,
          order: idx,
        })),
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || "保存に失敗しました");
    router.push(`/tournaments/${tournamentId}`);
  };

  if (status === "loading" || !session || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  const heldDay = data.heldAt.slice(0, 10);
  // 編集 UI には approved な class のみ載せる。pending な追加申請は admin の個別承認待ち。
  const initialClasses: ClassRow[] = [...data.classes]
    .filter((c) => c.approvalStatus === "approved")
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ category: c.category, name: c.name }));

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <h1 className="text-lg font-bold text-gray-900">大会情報を編集</h1>
            <p className="text-xs text-gray-500 mt-1">
              一般メンバーの編集後は再度承認が必要になります。クラスを差し替えると、紐づいていた成績はクラス未選択に戻ります。
            </p>
          </CardHeader>
          <CardContent>
            <TournamentForm
              submitLabel="保存する"
              onSubmit={handleSubmit}
              initial={{
                name: data.name,
                heldAt: heldDay,
                tier: data.tier as TournamentTier,
                openness: (data.openness as TournamentOpenness) ?? "open",
                prefecture: (data.prefecture as Prefecture | null) ?? "",
                format: data.format as TournamentFormat,
                location: data.location ?? "",
                description: data.description ?? "",
                classes: initialClasses,
              }}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
