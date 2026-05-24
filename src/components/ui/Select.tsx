"use client";

import { useState } from "react";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type Props<T extends string = string> = {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

// HTML <select> は Android LINE WebView でタップしてもドロップダウンが
// 開かないため、自前で開閉ロジックを持つ代替コンポーネント。
//
// 「外側クリックで閉じる」は document リスナーではなく fixed overlay で実装
// (古い WebView で document リスナーと同じタップで二重発火し、開いた瞬間
// 閉じてしまう事象を回避するため)。
export function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "選択してください",
  disabled = false,
  className = "",
}: Props<T>) {
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between gap-2 ${
          disabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
        }`}
      >
        <span className={`truncate ${selected ? "text-gray-900" : "text-gray-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <ul
            role="listbox"
            className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg"
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value} role="option" aria-selected={isSelected}>
                  {/* iOS Safari は <li> や <div> の onClick を発火しないことが
                     あるため、option は必ず <button> でラップする。 */}
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${
                      isSelected
                        ? "bg-blue-50 text-blue-900 font-medium"
                        : "text-gray-900"
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
