"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { permissions, UserRole } from "@/lib/permissions";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notificationEnabled, setNotificationEnabled] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      const role = session.user.role as UserRole;
      if (!permissions.canAccessAdmin(role)) {
        router.push("/");
      }
    }
  }, [session, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/admin/settings")
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setNotificationEnabled(json.data.notificationEnabled);
        });
    }
  }, [session]);

  const handleToggle = async () => {
    if (notificationEnabled === null || toggling) return;
    setToggling(true);
    const next = !notificationEnabled;
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationEnabled: next }),
    });
    const json = await res.json();
    if (json.success) setNotificationEnabled(next);
    setToggling(false);
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">管理</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/events/new">
            <Card hover>
              <CardContent className="py-6">
                <div className="text-3xl mb-2">📅</div>
                <h2 className="font-semibold text-gray-900">イベント作成</h2>
                <p className="text-sm text-gray-500 mt-1">新しいイベントを作成します</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/members">
            <Card hover>
              <CardContent className="py-6">
                <div className="text-3xl mb-2">👥</div>
                <h2 className="font-semibold text-gray-900">メンバー管理</h2>
                <p className="text-sm text-gray-500 mt-1">メンバーの権限を変更します</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/history">
            <Card hover>
              <CardContent className="py-6">
                <div className="text-3xl mb-2">📋</div>
                <h2 className="font-semibold text-gray-900">出欠回答履歴</h2>
                <p className="text-sm text-gray-500 mt-1">出欠の変更履歴を確認</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow px-4 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">通知設定</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-900">LINE通知</p>
              <p className="text-xs text-gray-500 mt-0.5">新イベント・リマインダー・キャンセル待ち繰り上がり</p>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling || notificationEnabled === null}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                notificationEnabled ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  notificationEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
