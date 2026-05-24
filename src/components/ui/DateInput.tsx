"use client";

import { useMemo } from "react";
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

  const { year, month, day } = parseDate(value);

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

  const update = (next: { year?: string; month?: string; day?: string }) => {
    const y = next.year ?? year;
    const m = next.month ?? month;
    let d = next.day ?? day;

    if (y && m && d) {
      const max = daysInMonth(parseInt(y, 10), parseInt(m, 10));
      if (parseInt(d, 10) > max) d = pad(max);
    }

    if (y && m && d) {
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange("");
    }
  };

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      <Select
        value={year}
        onChange={(v) => update({ year: v })}
        options={yearOptions}
        placeholder="年"
      />
      <Select
        value={month}
        onChange={(v) => update({ month: v })}
        options={monthOptions}
        placeholder="月"
      />
      <Select
        value={day}
        onChange={(v) => update({ day: v })}
        options={dayOptions}
        placeholder="日"
      />
    </div>
  );
}
