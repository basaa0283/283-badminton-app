"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { TournamentForm, TournamentFormValues } from "@/components/tournaments/TournamentForm";
import { permissions, UserRole } from "@/lib/permissions";
import { TournamentTier, TournamentFormat } from "@/lib/tournament-meta";

interface TournamentDetail {
  id: string;
  name: string;
  heldAt: string;
  tier: string;
  format: string;
  classCount: number | null;
  location: string | null;
  description: string | null;
  createdById: string;
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
        if (t.createdById !== session.user.id && !permissions.canAccessAdmin(role)) {
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
        format: values.format,
        classCount: values.classCount ? parseInt(values.classCount, 10) : null,
        location: values.location || null,
        description: values.description || null,
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

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <h1 className="text-lg font-bold text-gray-900">大会情報を編集</h1>
          </CardHeader>
          <CardContent>
            <TournamentForm
              submitLabel="保存する"
              onSubmit={handleSubmit}
              initial={{
                name: data.name,
                heldAt: heldDay,
                tier: data.tier as TournamentTier,
                format: data.format as TournamentFormat,
                classCount: data.classCount?.toString() ?? "",
                location: data.location ?? "",
                description: data.description ?? "",
              }}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
