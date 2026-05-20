"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  TOURNAMENT_CATEGORIES,
  TOURNAMENT_CATEGORY_LABEL,
  TournamentCategory,
} from "@/lib/tournament-meta";

interface Props {
  onSubmit: (payload: {
    category: TournamentCategory;
    name: string | null;
    proposalNote: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}

export function ClassProposalForm({ onSubmit, onCancel }: Props) {
  const [category, setCategory] = useState<TournamentCategory>("MD");
  const [name, setName] = useState("");
  const [noClasses, setNoClasses] = useState(false);
  const [proposalNote, setProposalNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noClasses && !name.trim()) {
      setError("クラス名を入れるか「クラス分けなし」にチェックしてください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        category,
        name: noClasses ? null : name.trim(),
        proposalNote: proposalNote.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "申請に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">種目 *</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as TournamentCategory)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
        >
          {TOURNAMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {TOURNAMENT_CATEGORY_LABEL[c]} ({c})
            </option>
          ))}
        </select>
      </div>
      <label className="inline-flex items-center gap-1 text-xs text-gray-600">
        <input type="checkbox" checked={noClasses} onChange={(e) => setNoClasses(e.target.checked)} />
        クラス分けなし
      </label>
      {!noClasses && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">クラス名 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 1部 / ベテラン50"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">申請コメント</label>
        <textarea
          rows={2}
          value={proposalNote}
          onChange={(e) => setProposalNote(e.target.value)}
          placeholder="この大会にこの種目・クラスが実在することを示す情報 (公式サイト URL など)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>
      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting} className="flex-1">
          キャンセル
        </Button>
        <Button type="submit" loading={submitting} className="flex-1">
          申請する
        </Button>
      </div>
    </form>
  );
}
