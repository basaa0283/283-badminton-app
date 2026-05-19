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

export type ClassGender = "male" | "female" | "mixed";

export interface ClassRow {
  gender: ClassGender;
  name: string;
}

export interface TournamentFormValues {
  name: string;
  heldAt: string; // "YYYY-MM-DD"
  tier: TournamentTier;
  format: TournamentFormat;
  location: string;
  description: string;
  classes: ClassRow[];
}

interface Props {
  initial?: Partial<TournamentFormValues>;
  submitLabel: string;
  onSubmit: (values: TournamentFormValues) => Promise<void>;
}

const GENDER_GROUPS: { key: ClassGender; label: string }[] = [
  { key: "male", label: "男子の部" },
  { key: "female", label: "女子の部" },
  { key: "mixed", label: "ミックスの部" },
];

export function TournamentForm({ initial, submitLabel, onSubmit }: Props) {
  const [values, setValues] = useState<TournamentFormValues>({
    name: initial?.name ?? "",
    heldAt: initial?.heldAt ?? "",
    tier: (initial?.tier as TournamentTier) ?? "city",
    format: (initial?.format as TournamentFormat) ?? "tournament",
    location: initial?.location ?? "",
    description: initial?.description ?? "",
    classes: initial?.classes ?? [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof TournamentFormValues>(k: K, v: TournamentFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const addClass = (gender: ClassGender) => {
    update("classes", [...values.classes, { gender, name: "" }]);
  };
  const updateClassName = (index: number, name: string) => {
    update(
      "classes",
      values.classes.map((c, i) => (i === index ? { ...c, name } : c))
    );
  };
  const removeClass = (index: number) => {
    update(
      "classes",
      values.classes.filter((_, i) => i !== index)
    );
  };

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
    if (values.classes.some((c) => !c.name.trim())) {
      setError("クラス名が空のものがあります");
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

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div>
          <h3 className="text-sm font-medium text-gray-700">ランク区分 (クラス)</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            大会内にある「部」「クラス」を性別ごとに登録してください。クラス分けが無い大会 (XD のみなど) はそのままで OK。
          </p>
        </div>
        {GENDER_GROUPS.map((g) => {
          const rows = values.classes
            .map((c, idx) => ({ c, idx }))
            .filter(({ c }) => c.gender === g.key);
          return (
            <div key={g.key} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{g.label}</span>
                <button
                  type="button"
                  onClick={() => addClass(g.key)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  ＋クラスを追加
                </button>
              </div>
              {rows.length === 0 ? (
                <p className="text-xs text-gray-400">登録なし</p>
              ) : (
                <ul className="space-y-2">
                  {rows.map(({ c, idx }) => (
                    <li key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => updateClassName(idx, e.target.value)}
                        placeholder="例: 1部 / ベテラン50"
                        className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeClass(idx)}
                        className="text-xs text-red-600 hover:underline shrink-0"
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
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
