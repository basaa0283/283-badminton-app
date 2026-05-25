"use client";

import { useEffect, useMemo, useState } from "react";
import { Select, type SelectOption } from "./Select";

type Props = {
  value: string;
  onChange: (value: string) => void;
  minYear?: number;
  maxYear?: number;
  className?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

function parseDate(value: string): { year: string; month: string; day: string } {
  if (!value) return { year: "", month: "", day: "" };
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return { year: "", month: "", day: "" };
  return { year: m[1], month: m[2], day: m[3] };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// <input type="date"> は Android LINE WebView でネイティブピッカーが起動しないため、
// 自前 Select 3 つ (年/月/日) で代替する。value は YYYY-MM-DD 形式。
//
// 設計の要: 年/月/日 を「内部 state」で個別に保持する。
// 親に通知する value は「3 つ揃った時だけ "YYYY-MM-DD"、それ以外は空文字」だが、
// UI 上の各セレクトは内部 state に基づいて表示する。
// これをしないと「年だけ選んだ → 親 value="" → 再 render で Select の value も "" に戻る →
// 表示が "年" のまま」になり、ユーザーには「タップしても変わらない」ように見える。
export function DateInput({
  value,
  onChange,
  minYear,
  maxYear,
  className = "",
}: Props) {
  const now = new Date();
  const maxY = maxYear ?? now.getFullYear() + 5;
  const minY = minYear ?? 1950;

  const initial = parseDate(value);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);

  // 親が完全な値 (YYYY-MM-DD) で外部更新した時のみ内部 state を同期する。
  // value === "" のときに同期すると、commit("") で空が返った直後に内部 state が
  // リセットされ、ユーザーの入力途中 (年だけ選択など) を維持できなくなる。
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const p = parseDate(value);
      setYear(p.year);
      setMonth(p.month);
      setDay(p.day);
    }
  }, [value]);

  const yearOptions: SelectOption[] = useMemo(() => {
    const arr: SelectOption[] = [];
    for (let y = maxY; y >= minY; y--) {
      arr.push({ value: String(y), label: `${y}年` });
    }
    return arr;
  }, [minY, maxY]);

  const monthOptions: SelectOption[] = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: pad(i + 1),
        label: `${i + 1}月`,
      })),
    [],
  );

  const dayOptions: SelectOption[] = useMemo(() => {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const max = y && m ? daysInMonth(y, m) : 31;
    return Array.from({ length: max }, (_, i) => ({
      value: pad(i + 1),
      label: `${i + 1}日`,
    }));
  }, [year, month]);

  const commit = (y: string, m: string, d: string) => {
    if (y && m && d) {
      const max = daysInMonth(parseInt(y, 10), parseInt(m, 10));
      const safeD = Math.min(parseInt(d, 10), max);
      onChange(`${y}-${m}-${pad(safeD)}`);
    } else {
      onChange("");
    }
  };

  const handleYear = (v: string) => {
    setYear(v);
    commit(v, month, day);
  };
  const handleMonth = (v: string) => {
    setMonth(v);
    commit(year, v, day);
  };
  const handleDay = (v: string) => {
    setDay(v);
    commit(year, month, v);
  };

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      <Select value={year} onChange={handleYear} options={yearOptions} placeholder="年" />
      <Select value={month} onChange={handleMonth} options={monthOptions} placeholder="月" />
      <Select value={day} onChange={handleDay} options={dayOptions} placeholder="日" />
    </div>
  );
}
