"use client";

import { useMemo } from "react";
import { Select, type SelectOption } from "./Select";

const NOW = new Date();

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface BirthdateInputProps {
  value: string;
  onChange: (value: string) => void;
  idPrefix?: string;
}

export function BirthdateInput({ value, onChange }: BirthdateInputProps) {
  const [y, m, d] =
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-") : ["", "", ""];

  const yearOptions: SelectOption[] = useMemo(() => {
    const arr: SelectOption[] = [];
    for (let i = 0; i <= 100; i++) {
      const year = NOW.getFullYear() - i;
      arr.push({ value: String(year), label: `${year}年` });
    }
    return arr;
  }, []);

  const monthOptions: SelectOption[] = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: pad2(i + 1),
        label: `${i + 1}月`,
      })),
    [],
  );

  const maxD = y && m ? daysInMonth(Number(y), Number(m)) : 31;

  const dayOptions: SelectOption[] = useMemo(
    () =>
      Array.from({ length: maxD }, (_, i) => ({
        value: pad2(i + 1),
        label: `${i + 1}日`,
      })),
    [maxD],
  );

  const setY = (newY: string) => {
    if (!newY) {
      onChange("");
      return;
    }
    const mm = m || "01";
    const dd = d || "01";
    const max = daysInMonth(Number(newY), Number(mm));
    const safeD = Math.min(Number(dd), max);
    onChange(`${newY}-${mm}-${pad2(safeD)}`);
  };
  const setM = (newM: string) => {
    const yy = y || String(NOW.getFullYear() - 30);
    const mm = newM || m || "01";
    const dd = d || "01";
    const max = daysInMonth(Number(yy), Number(mm));
    const safeD = Math.min(Number(dd), max);
    onChange(`${yy}-${pad2(Number(mm))}-${pad2(safeD)}`);
  };
  const setD = (newD: string) => {
    const yy = y || String(NOW.getFullYear() - 30);
    const mm = m || "01";
    const dd = newD || d || "01";
    onChange(`${yy}-${pad2(Number(mm))}-${pad2(Number(dd))}`);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <Select
        value={y || ""}
        onChange={setY}
        options={yearOptions}
        placeholder="年"
      />
      <Select
        value={m || ""}
        onChange={setM}
        options={monthOptions}
        placeholder="月"
      />
      <Select
        value={d || ""}
        onChange={setD}
        options={dayOptions}
        placeholder="日"
      />
    </div>
  );
}
