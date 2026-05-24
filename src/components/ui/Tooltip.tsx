"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

type Props = {
  content: string | null | undefined;
  children: ReactNode;
  className?: string;
};

// タップで説明文を吹き出し表示するツールチップ。
// - content が空なら children をそのまま返す (装飾なし)。
// - タップで開く。もう一度タップ or 画面の他の場所をタップで閉じる。
// - ホバー対応はあえて入れない (モバイルで mouseEnter → click → mouseLeave が
//   連続発火して「タップした瞬間に閉じる」現象が起きるため)。
//
// Android LINE WebView でも標準 onClick で動くシンプルな実装。
// (Select と同様、document リスナーは使わずオーバーレイ div で閉じる)
export function Tooltip({ content, children, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  // 外側クリックで閉じる。Select と同じ思想で document.click を
  // setTimeout(0) で遅延登録 (オーバーレイ方式は iOS の stacking context で
  // ハマるので不採用)。
  useEffect(() => {
    if (!open) return;
    let listener: ((e: MouseEvent) => void) | null = null;
    const timer = setTimeout(() => {
      listener = (e: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener("click", listener);
    }, 0);

    return () => {
      clearTimeout(timer);
      if (listener) {
        document.removeEventListener("click", listener);
      }
    };
  }, [open]);

  if (!content || !content.trim()) {
    return <>{children}</>;
  }

  return (
    <span ref={wrapperRef} className={`relative inline-block ${className}`}>
      {/* iOS Safari は <span onClick> を発火しないことがあるため、トリガーは
         必ず <button> で実装する。 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="cursor-pointer"
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-0 top-full mt-1 max-w-xs w-max bg-gray-900 text-white text-xs px-2 py-1.5 rounded shadow-lg whitespace-pre-wrap"
        >
          {content}
        </span>
      )}
    </span>
  );
}
