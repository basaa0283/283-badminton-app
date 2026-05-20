"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import {
  TOURNAMENT_CATEGORIES,
  TOURNAMENT_CATEGORY_LABEL,
  TournamentCategory,
} from "@/lib/tournament-meta";

export interface ClassOption {
  id: string;
  category: TournamentCategory;
  name: string | null;
}

export interface ResultFormValues {
  category: TournamentCategory;
  tournamentClassId: string; // "" = 未選択 / クラス無し
  rank: string;
  partnerName: string;
  note: string;
}

interface Props {
  initial?: Partial<ResultFormValues>;
  classOptions: ClassOption[]; // 大会に紐づくクラス全て
  submitLabel: string;
  onSubmit: (values: ResultFormValues) => Promise<void>;
  onCancel?: () => void;
}

export function ResultForm({ initial, classOptions, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<ResultFormValues>({
    category: (initial?.category as TournamentCategory) ?? "MS",
    tournamentClassId: initial?.tournamentClassId ?? "",
    rank: initial?.rank ?? "",
    partnerName: initial?.partnerName ?? "",
    note: initial?.note ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof ResultFormValues>(k: K, v: ResultFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const isDoubles = ["MD", "WD", "XD"].includes(values.category);

  // 種目 (category) が一致するクラスのみ select に出す。
  // 同一種目内に name=null (クラス分け無し) と name 有り (1部/2部) が混在することは
  // 運用上想定しないが、混ざっていてもそのまま表示する。
  const filteredClasses = useMemo(
    () => classOptions.filter((c) => c.category === values.category),
    [classOptions, values.category]
  );

  const handleCategoryChange = (next: TournamentCategory) => {
    setValues((prev) => {
      const stillValid =
        prev.tournamentClassId === "" ||
        classOptions.some((c) => c.id === prev.tournamentClassId && c.category === next);
      return {
        ...prev,
        category: next,
        tournamentClassId: stillValid ? prev.tournamentClassId : "",
      };
    });
  };

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
          onChange={(e) => handleCategoryChange(e.target.value as TournamentCategory)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
        >
          {TOURNAMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {TOURNAMENT_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      {filteredClasses.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">クラス (部)</label>
          <select
            value={values.tournamentClassId}
            onChange={(e) => update("tournamentClassId", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="">選択しない</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? "クラス分けなし"}
              </option>
            ))}
          </select>
        </div>
      )}

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
