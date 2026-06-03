"use client";

import { useLogPageView } from "@/lib/use-log-page-view";

// server component なページから view ログを記録するための薄いラッパ。
// (useLogPageView を直接呼べない server component で <LogPageView action="..." /> として埋め込む)
export function LogPageView({ action }: { action: string }) {
  useLogPageView(action);
  return null;
}
