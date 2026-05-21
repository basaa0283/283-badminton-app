"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { permissions, UserRole } from "@/lib/permissions";
import {
  TOURNAMENT_OPENNESS_LABEL,
  TournamentOpenness,
  PREFECTURE_LABEL,
  Prefecture,
  TOURNAMENT_CATEGORIES,
  TOURNAMENT_CATEGORY_BADGE_CLASS,
  TournamentCategory,
} from "@/lib/tournament-meta";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface TournamentItem {
  id: string;
  name: string;
  heldAt: string;
  openness: string;
  prefecture: string | null;
  format: string;
  location: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  createdBy: { id: string; nickname: string } | null;
  resultCount: number;
  categories: string[];
}

const STATUS_BADGE: Record<TournamentItem["approvalStatus"], { label: string; className: string }> = {
  pending: { label: "承認待ち", className: "bg-amber-100 text-amber-800" },
  approved: { label: "", className: "" },
  rejected: { label: "却下", className: "bg-red-100 text-red-800" },
};

const INITIAL_MONTHS = 12;
const LOAD_MORE_STEP = 12;
const MAX_MONTHS = 240; // 上限 20 年 (API と合わせる)

export default function TournamentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentItem[] | null>(null);
  const [monthsBack, setMonthsBack] = useState(INITIAL_MONTHS);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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
    setLoadingMore(true);
    fetch(`/api/tournaments?monthsBack=${monthsBack}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          // 同じ件数なら、それ以上前は無いと判断 (初回は除外)
          if (tournaments !== null && json.data.length === tournaments.length && monthsBack > INITIAL_MONTHS) {
            setReachedEnd(true);
          }
          setTournaments(json.data);
        } else {
          setTournaments([]);
        }
      })
      .finally(() => setLoadingMore(false));
    // tournaments を依存に入れると無限ループになるので意図的に除外
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, router, monthsBack]);

  const loadMore = () => {
    setMonthsBack((m) => Math.min(m + LOAD_MORE_STEP, MAX_MONTHS));
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  const role = session.user.role as UserRole;
  const isApprover = permissions.canApproveTournaments(role);
  const pendingCount = tournaments?.filter((t) => t.approvalStatus === "pending").length ?? 0;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">大会一覧</h1>
          <Link href="/tournaments/new">
            <Button size="sm">大会を登録</Button>
          </Link>
        </div>

        {isApprover && pendingCount > 0 && (
          <Card className="mb-4 border-2 border-amber-300">
            <CardContent>
              <p className="text-sm text-amber-900">
                承認待ちの大会が {pendingCount} 件あります。下の一覧で「承認待ち」バッジの大会を確認してください。
              </p>
            </CardContent>
          </Card>
        )}

        {tournaments === null ? (
          <div className="text-gray-500 text-sm">読み込み中...</div>
        ) : tournaments.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-gray-600">
                まだ大会が登録されていません。出場した大会を登録すると、自分の成績を記録できます。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => {
              const badge = STATUS_BADGE[t.approvalStatus];
              return (
                <Link key={t.id} href={`/tournaments/${t.id}`}>
                  <Card hover className="mb-3">
                    <CardContent>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h2 className="font-semibold text-gray-900">{t.name}</h2>
                        <div className="flex items-center gap-1 shrink-0">
                          {badge.label && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        {format(new Date(t.heldAt), "yyyy年M月d日(E)", { locale: ja })}
                        {t.prefecture ? ` ・ ${PREFECTURE_LABEL[t.prefecture as Prefecture] ?? t.prefecture}` : ""}
                        {t.location ? ` ・ ${t.location}` : ""}
                      </div>
                      {t.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {TOURNAMENT_CATEGORIES.filter((c) => t.categories.includes(c)).map((c) => (
                            <span
                              key={c}
                              className={`text-xs px-1.5 py-0.5 rounded font-medium ${TOURNAMENT_CATEGORY_BADGE_CLASS[c as TournamentCategory]}`}
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {TOURNAMENT_OPENNESS_LABEL[t.openness as TournamentOpenness] ?? t.openness}
                        {" ・ "}
                        成績登録: {t.resultCount}件
                        {t.createdBy ? ` ・ 登録者: ${t.createdBy.nickname}` : ""}
                      </div>
                      {t.approvalStatus === "rejected" && t.rejectionReason && (
                        <div className="text-xs text-red-700 mt-1">却下理由: {t.rejectionReason}</div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {tournaments !== null && tournaments.length > 0 && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="text-xs text-gray-500">
              直近 {monthsBack} か月分 + 今後の大会を表示中
            </div>
            {!reachedEnd && monthsBack < MAX_MONTHS && (
              <Button size="sm" variant="secondary" onClick={loadMore} loading={loadingMore}>
                もっと前を見る (+{LOAD_MORE_STEP}か月)
              </Button>
            )}
            {reachedEnd && (
              <div className="text-xs text-gray-400">これより前の大会はありません</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
