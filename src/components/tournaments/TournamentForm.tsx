"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  TOURNAMENT_TIERS,
  TOURNAMENT_TIER_LABEL,
  TOURNAMENT_FORMATS,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_CATEGORIES,
  TOURNAMENT_CATEGORY_LABEL,
  TOURNAMENT_OPENNESS,
  TOURNAMENT_OPENNESS_LABEL,
  PREFECTURES,
  PREFECTURE_LABEL,
  TournamentTier,
  TournamentFormat,
  TournamentCategory,
  TournamentOpenness,
  Prefecture,
} from "@/lib/tournament-meta";

export interface ClassRow {
  category: TournamentCategory;
  name: string | null; // null = クラス分け無し
  tier: TournamentTier | null; // null = 未指定 (admin が後で補完)
}

export interface TournamentFormValues {
  name: string;
  heldAt: string; // "YYYY-MM-DD"
  openness: TournamentOpenness;
  prefecture: Prefecture | "";
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

function presentCategories(classes: ClassRow[]): TournamentCategory[] {
  const set = new Set(classes.map((c) => c.category));
  return TOURNAMENT_CATEGORIES.filter((c) => set.has(c));
}

export function TournamentForm({ initial, submitLabel, onSubmit }: Props) {
  const [values, setValues] = useState<TournamentFormValues>({
    name: initial?.name ?? "",
    heldAt: initial?.heldAt ?? "",
    openness: (initial?.openness as TournamentOpenness) ?? "open",
    prefecture: (initial?.prefecture as Prefecture | "") ?? "",
    format: (initial?.format as TournamentFormat) ?? "tournament",
    location: initial?.location ?? "",
    description: initial?.description ?? "",
    classes: initial?.classes ?? [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addCategorySelect, setAddCategorySelect] = useState<TournamentCategory | "">("");

  const update = <K extends keyof TournamentFormValues>(k: K, v: TournamentFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const present = presentCategories(values.classes);

  const addCategory = (category: TournamentCategory) => {
    update("classes", [...values.classes, { category, name: "", tier: null }]);
    setAddCategorySelect("");
  };

  const addClassRow = (category: TournamentCategory) => {
    update("classes", [...values.classes, { category, name: "", tier: null }]);
  };

  const removeRow = (index: number) => {
    update(
      "classes",
      values.classes.filter((_, i) => i !== index)
    );
  };

  const updateRowName = (index: number, name: string | null) => {
    update(
      "classes",
      values.classes.map((c, i) => (i === index ? { ...c, name } : c))
    );
  };

  const updateRowTier = (index: number, tier: TournamentTier | null) => {
    update(
      "classes",
      values.classes.map((c, i) => (i === index ? { ...c, tier } : c))
    );
  };

  const toggleNoClasses = (category: TournamentCategory) => {
    const rows = values.classes.filter((c) => c.category === category);
    const noneRow = rows.find((c) => c.name === null);
    if (noneRow) {
      // 既に「クラス分け無し」状態 → "" の空行に戻す
      update(
        "classes",
        values.classes.map((c) =>
          c.category === category && c.name === null ? { ...c, name: "" } : c
        )
      );
    } else {
      // この category の行をすべて 1 行 (name=null) に集約 (tier はリセット)
      const others = values.classes.filter((c) => c.category !== category);
      update("classes", [...others, { category, name: null, tier: null }]);
    }
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
    if (values.classes.some((c) => c.name === "")) {
      setError("クラス名が空の行があります。クラス名を入れるか、「クラス分けなし」にしてください。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const cleaned = values.classes.map((c) => ({
        ...c,
        name: c.name === "" ? null : c.name,
      }));
      await onSubmit({ ...values, classes: cleaned });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const availableToAdd = TOURNAMENT_CATEGORIES.filter((c) => !present.includes(c));

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
        <label className="block text-sm font-medium text-gray-700 mb-1">参加区分 *</label>
        <select
          value={values.openness}
          onChange={(e) => update("openness", e.target.value as TournamentOpenness)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
        >
          {TOURNAMENT_OPENNESS.map((o) => (
            <option key={o} value={o}>
              {TOURNAMENT_OPENNESS_LABEL[o]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">開催地 (都道府県)</label>
        <select
          value={values.prefecture}
          onChange={(e) => update("prefecture", e.target.value as Prefecture | "")}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
        >
          <option value="">未選択</option>
          {PREFECTURES.map((p) => (
            <option key={p} value={p}>
              {PREFECTURE_LABEL[p]}
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
          <h3 className="text-sm font-medium text-gray-700">種目とクラス</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            この大会で実施されていた種目と部 (1部 / 2部 等) を登録し、各クラスに Tier を付けます。分からない部の Tier は空欄で OK (管理者が後で補完できます)。
          </p>
        </div>

        {present.map((category) => {
          const rows = values.classes
            .map((c, idx) => ({ c, idx }))
            .filter(({ c }) => c.category === category);
          const hasNoClasses = rows.some(({ c }) => c.name === null);
          return (
            <div key={category} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {TOURNAMENT_CATEGORY_LABEL[category]} ({category})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    update(
                      "classes",
                      values.classes.filter((c) => c.category !== category)
                    )
                  }
                  className="text-xs text-red-600 hover:underline"
                >
                  種目ごと削除
                </button>
              </div>
              <label className="inline-flex items-center gap-1 text-xs text-gray-600 mb-2">
                <input
                  type="checkbox"
                  checked={hasNoClasses}
                  onChange={() => toggleNoClasses(category)}
                />
                クラス分けなし
              </label>
              {rows.length === 0 ? (
                <p className="text-xs text-gray-400">クラス未登録</p>
              ) : (
                <ul className="space-y-2">
                  {rows.map(({ c, idx }) => (
                    <li key={idx} className="flex items-center gap-2 flex-wrap">
                      {!hasNoClasses && (
                        <input
                          type="text"
                          value={c.name ?? ""}
                          onChange={(e) => updateRowName(idx, e.target.value)}
                          placeholder="例: 1部 / ベテラン50"
                          className="flex-1 min-w-[8rem] px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      )}
                      <select
                        value={c.tier ?? ""}
                        onChange={(e) =>
                          updateRowTier(idx, (e.target.value || null) as TournamentTier | null)
                        }
                        className="px-2 py-1 border border-gray-300 rounded text-sm bg-white min-w-[10rem]"
                      >
                        <option value="">Tier 未指定</option>
                        {TOURNAMENT_TIERS.map((t) => (
                          <option key={t} value={t}>
                            {TOURNAMENT_TIER_LABEL[t]}
                          </option>
                        ))}
                      </select>
                      {!hasNoClasses && (
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="text-xs text-red-600 hover:underline shrink-0"
                        >
                          削除
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!hasNoClasses && (
                <button
                  type="button"
                  onClick={() => addClassRow(category)}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  ＋クラスを追加
                </button>
              )}
            </div>
          );
        })}

        {availableToAdd.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={addCategorySelect}
              onChange={(e) => setAddCategorySelect(e.target.value as TournamentCategory)}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
            >
              <option value="">種目を選択...</option>
              {availableToAdd.map((c) => (
                <option key={c} value={c}>
                  {TOURNAMENT_CATEGORY_LABEL[c]} ({c})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!addCategorySelect}
              onClick={() => addCategorySelect && addCategory(addCategorySelect)}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            >
              ＋種目を追加
            </button>
          </div>
        )}
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
