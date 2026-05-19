"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ResultForm, ResultFormValues } from "@/components/tournaments/ResultForm";
import { permissions, UserRole } from "@/lib/permissions";
import {
  TOURNAMENT_TIER_LABEL,
  TournamentTier,
  TOURNAMENT_FORMAT_LABEL,
  TournamentFormat,
  TOURNAMENT_CATEGORY_LABEL,
  TournamentCategory,
} from "@/lib/tournament-meta";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface ResultRow {
  id: string;
  userId: string;
  category: string;
  className: string | null;
  rank: string | null;
  partnerName: string | null;
  note: string | null;
  user: { id: string; nickname: string; profileImageUrl: string | null };
}

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
  createdBy: { id: string; nickname: string } | null;
  results: ResultRow[];
}

export default function TournamentDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const [data, setData] = useState<TournamentDetail | null>(null);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [addingResult, setAddingResult] = useState(false);

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${tournamentId}`);
    const json = await res.json();
    if (json.success) setData(json.data);
  }, [tournamentId]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    const role = session.user.role as UserRole;
    if (!permissions.canViewTournaments(role)) {
      router.push("/");
      return;
    }
    fetchDetail();
  }, [session, router, fetchDetail]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="text-gray-500 text-sm">読み込み中...</div>
        </main>
      </div>
    );
  }

  const role = session.user.role as UserRole;
  const isAdmin = permissions.canAccessAdmin(role);
  const isCreator = data.createdById === session.user.id;
  const canEditTournament = isAdmin || isCreator;
  const myResults = data.results.filter((r) => r.userId === session.user.id);

  const handleCreateResult = async (values: ResultFormValues) => {
    const res = await fetch(`/api/tournaments/${tournamentId}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: values.category,
        className: values.className || null,
        rank: values.rank || null,
        partnerName: values.partnerName || null,
        note: values.note || null,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || "保存に失敗しました");
    setAddingResult(false);
    await fetchDetail();
  };

  const handleUpdateResult = (resultId: string) => async (values: ResultFormValues) => {
    const res = await fetch(`/api/tournament-results/${resultId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: values.category,
        className: values.className || null,
        rank: values.rank || null,
        partnerName: values.partnerName || null,
        note: values.note || null,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || "更新に失敗しました");
    setEditingResultId(null);
    await fetchDetail();
  };

  const handleDeleteResult = async (resultId: string) => {
    if (!confirm("この成績を削除しますか？")) return;
    const res = await fetch(`/api/tournament-results/${resultId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!json.success) {
      alert(json.error?.message || "削除に失敗しました");
      return;
    }
    await fetchDetail();
  };

  const handleDeleteTournament = async () => {
    if (
      !confirm(
        "この大会と紐づく全ての成績を削除します。元には戻せません。実行しますか？"
      )
    )
      return;
    const res = await fetch(`/api/tournaments/${tournamentId}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) {
      alert(json.error?.message || "削除に失敗しました");
      return;
    }
    router.push("/tournaments");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-lg font-bold text-gray-900">{data.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0">
                {TOURNAMENT_TIER_LABEL[data.tier as TournamentTier] ?? data.tier}
              </span>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {format(new Date(data.heldAt), "yyyy年M月d日(E)", { locale: ja })}
              {data.location ? ` ・ ${data.location}` : ""}
            </div>
          </CardHeader>
          <CardContent>
            <dl className="text-sm space-y-1">
              <div>
                <dt className="text-gray-500 inline mr-2">形式:</dt>
                <dd className="inline">
                  {TOURNAMENT_FORMAT_LABEL[data.format as TournamentFormat] ?? data.format}
                </dd>
              </div>
              {data.classCount !== null && (
                <div>
                  <dt className="text-gray-500 inline mr-2">部の数:</dt>
                  <dd className="inline">{data.classCount}部制</dd>
                </div>
              )}
              {data.description && (
                <div className="mt-2">
                  <dt className="text-gray-500 mb-1">メモ:</dt>
                  <dd className="whitespace-pre-wrap text-gray-800">{data.description}</dd>
                </div>
              )}
              {data.createdBy && (
                <div className="text-xs text-gray-400 mt-2">登録者: {data.createdBy.nickname}</div>
              )}
            </dl>
            {canEditTournament && (
              <div className="mt-3 flex gap-2">
                <Link href={`/tournaments/${tournamentId}/edit`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full">
                    大会情報を編集
                  </Button>
                </Link>
                <Button variant="secondary" size="sm" onClick={handleDeleteTournament}>
                  削除
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">成績</h2>
              {!addingResult && (
                <Button size="sm" onClick={() => setAddingResult(true)}>
                  自分の成績を追加
                </Button>
              )}
            </div>
            {myResults.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                同じ大会で複数種目に出場した場合は、種目ごとに追加してください。
              </p>
            )}
          </CardHeader>
          <CardContent>
            {addingResult && (
              <div className="mb-4 p-3 border border-gray-200 rounded-lg">
                <ResultForm
                  submitLabel="追加"
                  onSubmit={handleCreateResult}
                  onCancel={() => setAddingResult(false)}
                />
              </div>
            )}
            {data.results.length === 0 ? (
              <p className="text-sm text-gray-600">まだ誰も成績を登録していません。</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.results.map((r) => {
                  const isMine = r.userId === session.user.id;
                  const canEdit = isAdmin || isMine;
                  const editing = editingResultId === r.id;
                  return (
                    <li key={r.id} className="py-3">
                      {editing ? (
                        <ResultForm
                          initial={{
                            category: r.category as TournamentCategory,
                            className: r.className ?? "",
                            rank: r.rank ?? "",
                            partnerName: r.partnerName ?? "",
                            note: r.note ?? "",
                          }}
                          submitLabel="保存"
                          onSubmit={handleUpdateResult(r.id)}
                          onCancel={() => setEditingResultId(null)}
                        />
                      ) : (
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900">
                              <span className="font-medium">{r.user.nickname}</span>
                              <span className="text-gray-500 mx-2">/</span>
                              <span>
                                {TOURNAMENT_CATEGORY_LABEL[r.category as TournamentCategory] ?? r.category}
                              </span>
                              {r.className && <span className="text-gray-500"> ({r.className})</span>}
                            </div>
                            {r.rank && <div className="text-sm text-gray-700 mt-0.5">成績: {r.rank}</div>}
                            {r.partnerName && (
                              <div className="text-xs text-gray-500 mt-0.5">相方: {r.partnerName}</div>
                            )}
                            {r.note && (
                              <div className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{r.note}</div>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                onClick={() => setEditingResultId(r.id)}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDeleteResult(r.id)}
                                className="text-xs text-red-600 hover:underline"
                              >
                                削除
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
