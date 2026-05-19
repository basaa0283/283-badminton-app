"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  TOURNAMENT_TIERS,
  TOURNAMENT_TIER_LABEL,
  TOURNAMENT_FORMATS,
  TOURNAMENT_FORMAT_LABEL,
  TournamentTier,
  TournamentFormat,
} from "@/lib/tournament-meta";

export interface TournamentFormValues {
  name: string;
  heldAt: string; // "YYYY-MM-DD"
  tier: TournamentTier;
  format: TournamentFormat;
  classCount: string; // 入力中は文字列
  location: string;
  description: string;
}

interface Props {
  initial?: Partial<TournamentFormValues>;
  submitLabel: string;
  onSubmit: (values: TournamentFormValues) => Promise<void>;
}

export function TournamentForm({ initial, submitLabel, onSubmit }: Props) {
  const [values, setValues] = useState<TournamentFormValues>({
    name: initial?.name ?? "",
    heldAt: initial?.heldAt ?? "",
    tier: (initial?.tier as TournamentTier) ?? "city",
    format: (initial?.format as TournamentFormat) ?? "tournament",
    classCount: initial?.classCount ?? "",
    location: initial?.location ?? "",
    description: initial?.description ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof TournamentFormValues>(k: K, v: TournamentFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) {
      setError("大会名を入力してください");
      return;
    }
    if (!values.heldAt) {
      setError("開催日を入力してください");
      return;
    }
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">大会名 *</label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="例: 足立区民バドミントン大会 2026春"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">開催日 *</label>
        <input
          type="date"
          value={values.heldAt}
          onChange={(e) => update("heldAt", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">大会階級 *</label>
        <select
          value={values.tier}
          onChange={(e) => update("tier", e.target.value as TournamentTier)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
        >
          {TOURNAMENT_TIERS.map((t) => (
            <option key={t} value={t}>
              {TOURNAMENT_TIER_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">形式 *</label>
        <select
          value={values.format}
          onChange={(e) => update("format", e.target.value as TournamentFormat)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
        >
          {TOURNAMENT_FORMATS.map((f) => (
            <option key={f} value={f}>
              {TOURNAMENT_FORMAT_LABEL[f]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">部の数</label>
        <input
          type="number"
          min={1}
          max={20}
          value={values.classCount}
          onChange={(e) => update("classCount", e.target.value)}
          placeholder="例: 4 (4部制の場合)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
        <p className="text-xs text-gray-500 mt-1">部分けが無い場合は空欄。</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">会場</label>
        <input
          type="text"
          value={values.location}
          onChange={(e) => update("location", e.target.value)}
          placeholder="例: 足立区総合スポーツセンター"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
        <textarea
          rows={3}
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="参加資格・特記事項など"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
      )}

      <Button type="submit" loading={submitting} className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
