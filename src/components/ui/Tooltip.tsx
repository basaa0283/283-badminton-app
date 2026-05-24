"use client";

import { ReactNode, useState } from "react";

type Props = {
  content: string | null | undefined;
  children: ReactNode;
  className?: string;
};

// タップ/ホバーで説明文を吹き出し表示するツールチップ。
// - content が空なら children をそのまま返す (装飾なし)。
// - スマホでは onClick で開閉。同じ要素をもう一度タップ or 画面の他の場所をタップで閉じる。
// - PC では onMouseEnter / onMouseLeave でも開く (タップ操作と共存)。
//
// Android LINE WebView でも標準 onClick で動くシンプルな実装。
// (Select と同様、document リスナーは使わずオーバーレイ div で閉じる)
export function Tooltip({ content, children, className = "" }: Props) {
  const [open, setOpen] = useState(false);

  if (!content || !content.trim()) {
    return <>{children}</>;
  }

  return (
    <span className={`relative inline-block ${className}`}>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="cursor-help"
      >
        {children}
      </span>
      {open && (
        <>
          {/* タップで閉じるためのオーバーレイ (PC のホバー操作には mouseLeave が効くので問題なし) */}
          <span
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            aria-hidden="true"
          />
          <span
            role="tooltip"
            className="absolute z-50 left-0 top-full mt-1 max-w-xs w-max bg-gray-900 text-white text-xs px-2 py-1.5 rounded shadow-lg whitespace-pre-wrap"
          >
            {content}
          </span>
        </>
      )}
    </span>
  );
}
