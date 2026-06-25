"use client";

import { useEffect } from "react";

// ページ表示時に 1 回だけ閲覧ログを記録する。
// /api/activity-log/view が ALLOWED で弾く action は無視される。
// 未ログインでも投げてしまうが、サーバー側で 401 で落ちるだけなので問題なし。
export function useLogPageView(action: string) {
  useEffect(() => {
    fetch("/api/activity-log/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      keepalive: true,
    }).catch(() => {});
  }, [action]);
}
