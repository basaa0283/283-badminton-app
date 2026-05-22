"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import {
  TOURNAMENT_CATEGORIES,
  TOURNAMENT_CATEGORY_LABEL,
  TournamentCategory,
  rankOptionsFor,
  tierRank,
} from "@/lib/tournament-meta";

export interface ClassOption {
  id: string;
  category: TournamentCategory;
  name: string | null;
  tier?: string | null;
}

export interface ResultFormValues {
  category: TournamentCategory;
  tournamentClassId: string; // "" = 未選択 / クラス無し
  rank: string;
  partnerName: string;
  note: string;
  isPublic: boolean; // この成績をサークル内に公開するか
}

interface Props {
  initial?: Partial<ResultFormValues>;
  classOptions: ClassOption[]; // 大会に紐づくクラス全て
  tournamentFormat: string;    // tournament / league / league_then_tournament / other
  submitLabel: string;
  onSubmit: (values: ResultFormValues) => Promise<void>;
  onCancel?: () => void;
}

const RANK_OTHER = "__other__";

export function ResultForm({
  initial,
  classOptions,
  tournamentFormat,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  // 大会に登録された種目だけを許す。何も登録されていない場合は空配列。
  const availableCategories = useMemo(
    () =>
      TOURNAMENT_CATEGORIES.filter((cat) =>
        classOptions.some((c) => c.category === cat)
      ),
    [classOptions]
  );

  const defaultCategory =
    (initial?.category as TournamentCategory | undefined) ??
    (availableCategories[0] ?? "MS");

  const rankOptions = rankOptionsFor(tournamentFormat);

  // 初期値の rank が候補リストに一致するか判定し、しなければ「その他」を選んで入力欄に出す。
  const initialRank = initial?.rank ?? "";
  const initialRankIsOption = initialRank !== "" && (rankOptions as readonly string[]).includes(initialRank);
  const [rankSelect, setRankSelect] = useState<string>(
    initialRank === "" ? "" : initialRankIsOption ? initialRank : RANK_OTHER
  );
  const [rankOther, setRankOther] = useState<string>(
    initialRank === "" || initialRankIsOption ? "" : initialRank
  );

  const [values, setValues] = useState<Omit<ResultFormValues, "rank">>({
    category: defaultCategory,
    tournamentClassId: initial?.tournamentClassId ?? "",
    partnerName: initial?.partnerName ?? "",
    note: initial?.note ?? "",
    isPublic: initial?.isPublic ?? false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const isDoubles = ["MD", "WD", "XD"].includes(values.category);

  const filteredClasses = useMemo(
    () =>
      classOptions
        .filter((c) => c.category === values.category)
        // Tier 高い順 (S が上)。同 Tier は name 昇順でフォールバック。
        .sort(
          (a, b) =>
            tierRank(a.tier ?? null) - tierRank(b.tier ?? null) ||
            (a.name ?? "").localeCompare(b.name ?? "")
        ),
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

  // この種目にクラスが存在し、かつクラス分けが「ない」(name=null) 1 行だけの構成
  // ではない (= 1部/2部 のような実在クラスが並んでいる) 場合はクラス選択必須。
  // 集計時に Tier を引けなくなる事故を防ぐため。
  const namedClassExists = filteredClasses.some((c) => c.name !== null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (namedClassExists && !values.tournamentClassId) {
      setError("クラス (部) を選択してください。クラス分けがない大会のみ未選択で OK です。");
      return;
    }

    // 結果欄: select が "その他" なら自由入力テキスト、空なら未入力、それ以外は select の値
    const rank =
      rankSelect === ""
        ? ""
        : rankSelect === RANK_OTHER
          ? rankOther.trim()
          : rankSelect;

    setSubmitting(true);
    try {
      await onSubmit({
        category: values.category,
        tournamentClassId: values.tournamentClassId,
        rank,
        partnerName: values.partnerName,
        note: values.note,
        isPublic: values.isPublic,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (availableCategories.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        この大会には登録された種目がありません。先に「種目・クラスの追加申請」から種目を追加してください。
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">種目 *</label>
        <select
          value={values.category}
          onChange={(e) => handleCategoryChange(e.target.value as TournamentCategory)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
        >
          {availableCategories.map((c) => (
            <option key={c} value={c}>
              {TOURNAMENT_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      {filteredClasses.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            クラス (部){namedClassExists ? " *" : ""}
          </label>
          <select
            value={values.tournamentClassId}
            onChange={(e) => update("tournamentClassId", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="">{namedClassExists ? "選択してください" : "選択しない"}</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? "クラス分けなし"}
              </option>
            ))}
          </select>
          {namedClassExists && (
            <p className="text-xs text-gray-500 mt-1">
              この大会にはクラス分けがあるので、該当する部を選んでください。
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">成績</label>
        <select
          value={rankSelect}
          onChange={(e) => setRankSelect(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
        >
          <option value="">選択しない</option>
          {rankOptions.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={RANK_OTHER}>その他 (自由入力)</option>
        </select>
        {rankSelect === RANK_OTHER && (
          <input
            type="text"
            value={rankOther}
            onChange={(e) => setRankOther(e.target.value)}
            placeholder="例: 3位 / ベスト6 / 棄権"
            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        )}
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

      <div className="border-t border-gray-100 pt-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isPublic}
            onChange={(e) => update("isPublic", e.target.checked)}
            className="w-4 h-4"
          />
          <span>この成績をサークル内に公開する</span>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          公開した成績は、他メンバーのプロフィール大会実績欄や、この大会の成績一覧に表示されます。
          オフ (デフォルト) なら自分と管理者だけが閲覧できます。
          別途プロフィールで「サマリ公開」をオンにすると、登録した <strong>全成績</strong> の集計 (Tier × 種目別のメダル数) も他メンバーに表示されます。
        </p>
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
