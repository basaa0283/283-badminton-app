"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { permissions, UserRole } from "@/lib/permissions";

type AppSettings = {
  notifyReminderEnabled: boolean;
  notifyWaitlistEnabled: boolean;
  contactEmail: string;
};

type SettingKey = "notifyReminderEnabled" | "notifyWaitlistEnabled";

const NOTIFY_ITEMS: { key: SettingKey; label: string; description: string }[] = [
  { key: "notifyReminderEnabled", label: "リマインダー通知", description: "イベント24時間前・2時間前に参加者へ通知" },
  { key: "notifyWaitlistEnabled", label: "キャンセル待ち通知", description: "繰り上がり時に対象者へ通知" },
];

function Toggle({ enabled, disabled, onToggle }: { enabled: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        enabled ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [toggling, setToggling] = useState<SettingKey | null>(null);
  const [contactEmailInput, setContactEmailInput] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      const role = session.user.role as UserRole;
      if (!permissions.canAccessAdmin(role)) router.push("/");
    }
  }, [session, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/admin/settings")
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            setSettings(json.data);
            setContactEmailInput(json.data.contactEmail || "");
          }
        });
    }
  }, [session]);

  const handleSaveContact = async () => {
    if (savingContact) return;
    setSavingContact(true);
    setContactSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactEmail: contactEmailInput.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setSettings((prev) =>
          prev ? { ...prev, contactEmail: contactEmailInput.trim() } : prev
        );
        setContactSaved(true);
        setTimeout(() => setContactSaved(false), 2000);
      }
    } finally {
      setSavingContact(false);
    }
  };

  const handleToggle = async (key: SettingKey) => {
    if (!settings || toggling) return;
    setToggling(key);
    const next = !settings[key];
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    });
    const json = await res.json();
    if (json.success) setSettings((prev) => prev ? { ...prev, [key]: next } : prev);
    setToggling(null);
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

          <Link href="/admin/expense-report">
            <Card hover>
              <CardContent className="py-6">
                <div className="text-3xl mb-2">💰</div>
                <h2 className="font-semibold text-gray-900">経費レポート</h2>
                <p className="text-sm text-gray-500 mt-1">イベントごとの収支を確認</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/shuttle-prices">
            <Card hover>
              <CardContent className="py-6">
                <div className="text-3xl mb-2">🏸</div>
                <h2 className="font-semibold text-gray-900">シャトル単価</h2>
                <p className="text-sm text-gray-500 mt-1">期間ごとの単価を管理</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/event-categories">
            <Card hover>
              <CardContent className="py-6">
                <div className="text-3xl mb-2">🏷️</div>
                <h2 className="font-semibold text-gray-900">イベント種別</h2>
                <p className="text-sm text-gray-500 mt-1">タグの追加・編集</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/announcements">
            <Card hover>
              <CardContent className="py-6">
                <div className="text-3xl mb-2">📢</div>
                <h2 className="font-semibold text-gray-900">お知らせ管理</h2>
                <p className="text-sm text-gray-500 mt-1">アプリ内のお知らせ投稿</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow divide-y divide-gray-100">
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-700">通知設定（LINE）</h2>
          </div>
          {NOTIFY_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              </div>
              <Toggle
                enabled={settings ? settings[item.key] : true}
                disabled={toggling !== null || settings === null}
                onToggle={() => handleToggle(item.key)}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">お問い合わせ先</h2>
            <p className="text-xs text-gray-500 mt-0.5">フッターの「お問い合わせ」リンクの宛先メールアドレス。空欄なら非表示。</p>
          </div>
          <div className="px-4 py-3 flex items-center gap-2">
            <input
              type="email"
              value={contactEmailInput}
              onChange={(e) => setContactEmailInput(e.target.value)}
              placeholder="例: admin@example.com"
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              onClick={handleSaveContact}
              disabled={savingContact || settings === null}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
            >
              {savingContact ? "保存中..." : contactSaved ? "保存しました" : "保存"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
