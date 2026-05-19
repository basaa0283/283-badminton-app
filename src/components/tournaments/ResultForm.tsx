"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  TOURNAMENT_CATEGORIES,
  TOURNAMENT_CATEGORY_LABEL,
  TournamentCategory,
} from "@/lib/tournament-meta";

export interface ResultFormValues {
  category: TournamentCategory;
  className: string;
  rank: string;
  partnerName: string;
  note: string;
}

interface Props {
  initial?: Partial<ResultFormValues>;
  submitLabel: string;
  onSubmit: (values: ResultFormValues) => Promise<void>;
  onCancel?: () => void;
}

export function ResultForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<ResultFormValues>({
    category: (initial?.category as TournamentCategory) ?? "MS",
    className: initial?.className ?? "",
    rank: initial?.rank ?? "",
    partnerName: initial?.partnerName ?? "",
    note: initial?.note ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof ResultFormValues>(k: K, v: ResultFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const isDoubles = ["MD", "WD", "XD"].includes(values.category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">種目 *</label>
        <select
          value={values.category}
          onChange={(e) => update("category", e.target.value as TournamentCategory)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
        >
          {TOURNAMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {TOURNAMENT_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">部・クラス</label>
        <input
          type="text"
          value={values.className}
          onChange={(e) => update("className", e.target.value)}
          placeholder="例: 3部 / ベテラン50"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">成績</label>
        <input
          type="text"
          value={values.rank}
          onChange={(e) => update("rank", e.target.value)}
          placeholder="例: 優勝 / 準優勝 / ベスト4 / 1回戦敗退"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {isDoubles && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">相方</label>
          <input
            type="text"
            value={values.partnerName}
            onChange={(e) => update("partnerName", e.target.value)}
            placeholder="ペアの名前 (サークル外でも可)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
        <textarea
          rows={2}
          value={values.note}
          onChange={(e) => update("note", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting} className="flex-1">
            キャンセル
          </Button>
        )}
        <Button type="submit" loading={submitting} className="flex-1">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
