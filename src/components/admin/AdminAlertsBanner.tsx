"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Alerts {
  pendingCount: number;
}

/**
 * 管理者ホームに出す通知バナー。
 * - 承認待ちユーザーが居れば「参加リクエストが届いています」を表示。
 * - 件数 0 / fetch 失敗時は何も出さない。
 * - 呼び出し側で admin / subadmin チェックを通してから render すること。
 */
export function AdminAlertsBanner() {
  const [alerts, setAlerts] = useState<Alerts | null>(null);

  useEffect(() => {
    fetch("/api/admin/alerts")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAlerts(json.data);
      })
      .catch(() => {});
  }, []);

  if (!alerts) return null;
  if (alerts.pendingCount <= 0) return null;

  return (
    <Link
      href="/admin/members"
      className="block mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">📥</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900">
              参加リクエストが {alerts.pendingCount} 件届いています
            </p>
            <p className="text-xs text-amber-800 truncate">
              タップしてメンバー管理画面で承認 / 却下してください。
            </p>
          </div>
        </div>
        <span className="text-amber-700 shrink-0">→</span>
      </div>
    </Link>
  );
}
