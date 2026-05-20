"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import {
  TOURNAMENT_CATEGORY_LABEL,
  TournamentCategory,
  rankEmoji,
} from "@/lib/tournament-meta";

interface ResultWithTournament {
  id: string;
  category: string;
  rank: string | null;
  partnerName: string | null;
  note: string | null;
  tournament: {
    id: string;
    name: string;
    heldAt: string;
    location: string | null;
  };
  tournamentClass: {
    id: string;
    category: string;
    name: string | null;
    tier: string | null;
  } | null;
}

interface Props {
  userId: string;
}

// メンバー詳細 / プロフィール画面の中に置く「大会実績」サマリ。
// /api/members/[userId]/tournament-results を呼んで新しい順に並べる。
export function TournamentResultsSection({ userId }: Props) {
  const [results, setResults] = useState<ResultWithTournament[] | null>(null);

  useEffect(() => {
    fetch(`/api/members/${userId}/tournament-results`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setResults(json.data);
        else setResults([]);
      })
      .catch(() => setResults([]));
  }, [userId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">大会実績</h2>
          <Link href="/tournaments" className="text-xs text-blue-600 hover:underline">
            大会一覧へ
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {results === null ? (
          <p className="text-xs text-gray-500">読み込み中...</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-gray-600">
            まだ大会実績がありません。
            <Link href="/tournaments" className="text-blue-600 hover:underline ml-1">
              大会一覧
            </Link>{" "}
            から登録できます。
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {results.map((r) => (
              <li key={r.id} className="py-2">
                <Link href={`/tournaments/${r.tournament.id}`} className="block hover:bg-gray-50 -mx-3 px-3 py-1 rounded">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 line-clamp-1">
                        {r.tournament.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {format(new Date(r.tournament.heldAt), "yyyy年M月d日", { locale: ja })}
                      </div>
                    </div>
                    {r.tournamentClass && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                          r.tournamentClass.tier
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {r.tournamentClass.tier ? `Tier${r.tournamentClass.tier}` : "Tier未指定"}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    {TOURNAMENT_CATEGORY_LABEL[r.category as TournamentCategory] ?? r.category}
                    {r.tournamentClass?.name ? ` (${r.tournamentClass.name})` : ""}
                    {r.rank ? ` ・ ${rankEmoji(r.rank)}${r.rank}` : ""}
                  </div>
                  {r.partnerName && (
                    <div className="text-xs text-gray-500 mt-0.5">相方: {r.partnerName}</div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
