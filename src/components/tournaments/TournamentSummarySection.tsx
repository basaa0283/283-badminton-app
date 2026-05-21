"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import {
  TOURNAMENT_CATEGORIES,
  TOURNAMENT_CATEGORY_LABEL,
  TOURNAMENT_TIERS,
  TOURNAMENT_TIER_BADGE_CLASS,
  TournamentCategory,
  TournamentTier,
} from "@/lib/tournament-meta";
import type { PodiumCount, TournamentSummary } from "@/lib/tournament-summary";

interface Props {
  userId: string;
}

// プロフィール / メンバー詳細に表示する「大会実績サマリ」セクション。
// API 側で空オブジェクトが返ってきたら何も描画しない (= 公開 OFF / 集計対象なし)。
export function TournamentSummarySection({ userId }: Props) {
  const [summary, setSummary] = useState<TournamentSummary | null>(null);

  useEffect(() => {
    fetch(`/api/members/${userId}/tournament-results/summary`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setSummary(json.data ?? {});
        else setSummary({});
      })
      .catch(() => setSummary({}));
  }, [userId]);

  if (summary === null) return null;
  const presentCategories = TOURNAMENT_CATEGORIES.filter((c) => summary[c]);
  if (presentCategories.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-gray-900">大会実績サマリ</h2>
        <p className="text-xs text-gray-500 mt-1">
          全成績から集計した「優勝🥇 / 準優勝🥈 / ベスト4🥉」の回数を、種目別 × Tier 別に表示しています。
          0 件の種目・Tier は省略。
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {presentCategories.map((c) => (
            <CategoryBlock
              key={c}
              category={c}
              byTier={summary[c] ?? {}}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryBlock({
  category,
  byTier,
}: {
  category: TournamentCategory;
  byTier: Partial<Record<TournamentTier, PodiumCount>>;
}) {
  const presentTiers = TOURNAMENT_TIERS.filter((t) => byTier[t]);
  if (presentTiers.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-800 mb-1">
        {TOURNAMENT_CATEGORY_LABEL[category]} ({category})
      </h3>
      <ul className="space-y-1">
        {presentTiers.map((t) => {
          const entry = byTier[t]!;
          return (
            <li key={t} className="flex items-center gap-2 text-sm">
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${TOURNAMENT_TIER_BADGE_CLASS[t]}`}
              >
                Tier{t}
              </span>
              <span className="text-gray-800">
                {entry.gold > 0 && <span className="mr-3">🥇 {entry.gold}</span>}
                {entry.silver > 0 && <span className="mr-3">🥈 {entry.silver}</span>}
                {entry.bronze > 0 && <span>🥉 {entry.bronze}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
