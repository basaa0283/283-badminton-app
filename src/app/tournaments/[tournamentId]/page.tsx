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

interface ClassRow {
  id: string;
  gender: "male" | "female" | "mixed";
  name: string;
  order: number;
}

interface ResultRow {
  id: string;
  userId: string;
  category: string;
  tournamentClassId: string | null;
  rank: string | null;
  partnerName: string | null;
  note: string | null;
  user: { id: string; nickname: string; profileImageUrl: string | null };
  tournamentClass: ClassRow | null;
}

interface TournamentDetail {
  id: string;
  name: string;
  heldAt: string;
  tier: string;
  format: string;
  location: string | null;
  description: string | null;
  createdById: string;
  createdBy: { id: string; nickname: string } | null;
  approvalStatus: "pending" | "approved" | "rejected";
  approvedAt: string | null;
  rejectionReason: string | null;
  classes: ClassRow[];
  results: ResultRow[];
}

const GENDER_LABEL: Record<"male" | "female" | "mixed", string> = {
  male: "男子",
  female: "女子",
  mixed: "ミックス",
};

export default function TournamentDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const [data, setData] = useState<TournamentDetail | null>(null);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [addingResult, setAddingResult] = useState(false);
  const [approving, setApproving] = useState(false);

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
  const isApprover = permissions.canApproveTournaments(role);
  const isAdmin = permissions.canAccessAdmin(role);
  const isCreator = data.createdById === session.user.id;
  const canEditTournament = isApprover || isCreator;
  const isApproved = data.approvalStatus === "approved";

  const handleCreateResult = async (values: ResultFormValues) => {
    const res = await fetch(`/api/tournaments/${tournamentId}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: values.category,
        tournamentClassId: values.tournamentClassId || null,
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
        tournamentClassId: values.tournamentClassId || null,
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
    const res = await fetch(`/api/tournament-results/${resultId}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) {
      alert(json.error?.message || "削除に失敗しました");
      return;
    }
    await fetchDetail();
  };

  const handleDeleteTournament = async () => {
    if (
      !confirm("この大会と紐づく全ての成績を削除します。元には戻せません。実行しますか？")
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

  const handleApprove = async () => {
    if (!confirm("この大会を承認しますか？承認するとメンバー全員に公開されます。")) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/approval`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || "承認に失敗しました");
        return;
      }
      await fetchDetail();
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt("却下理由を入力してください (登録者に通知されます)");
    if (reason === null) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/approval`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejectionReason: reason || null }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || "却下に失敗しました");
        return;
      }
      await fetchDetail();
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {data.approvalStatus === "pending" && (
          <Card className="border-2 border-amber-300">
            <CardContent>
              <p className="text-sm text-amber-900">
                この大会は<strong>承認待ち</strong>です。承認されるまで他のメンバーには表示されず、成績登録もできません。
              </p>
              {isApprover && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={handleApprove} loading={approving}>
                    承認する
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleReject} disabled={approving}>
                    却下
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {data.approvalStatus === "rejected" && (
          <Card className="border-2 border-red-300">
            <CardContent>
              <p className="text-sm text-red-900">
                この大会は<strong>却下</strong>されています。
                {data.rejectionReason ? (
                  <span className="block mt-1">却下理由: {data.rejectionReason}</span>
                ) : null}
              </p>
              {isApprover && (
                <div className="mt-3">
                  <Button size="sm" onClick={handleApprove} loading={approving}>
                    やはり承認する
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
              {data.classes.length > 0 && (
                <div className="mt-2">
                  <dt className="text-gray-500 mb-1">ランク区分:</dt>
                  <dd>
                    <ul className="space-y-1">
                      {(["male", "female", "mixed"] as const).map((g) => {
                        const rows = data.classes.filter((c) => c.gender === g);
                        if (rows.length === 0) return null;
                        return (
                          <li key={g} className="text-gray-800">
                            <span className="text-gray-500 mr-1">{GENDER_LABEL[g]}:</span>
                            {rows.map((r) => r.name).join(" / ")}
                          </li>
                        );
                      })}
                    </ul>
                  </dd>
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
              {data.approvedAt && data.approvalStatus === "approved" && (
                <div className="text-xs text-gray-400">
                  承認日時: {format(new Date(data.approvedAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                </div>
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
              {!addingResult && isApproved && (
                <Button size="sm" onClick={() => setAddingResult(true)}>
                  自分の成績を追加
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!isApproved && (
              <p className="text-xs text-gray-500 mb-2">承認されると成績登録が開放されます。</p>
            )}
            {addingResult && (
              <div className="mb-4 p-3 border border-gray-200 rounded-lg">
                <ResultForm
                  classOptions={data.classes}
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
                          classOptions={data.classes}
                          initial={{
                            category: r.category as TournamentCategory,
                            tournamentClassId: r.tournamentClassId ?? "",
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
                              {r.tournamentClass && (
                                <span className="text-gray-500"> ({r.tournamentClass.name})</span>
                              )}
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
