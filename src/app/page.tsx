"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { AnnouncementBanner } from "@/components/announcements/AnnouncementBanner";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const isAdmin = session.user.role === "admin" || session.user.role === "subadmin";

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <AnnouncementBanner />

        {/* クイックアクション */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Link
            href="/events"
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
          >
            <div className="text-2xl mb-2">📅</div>
            <div className="font-medium">イベント一覧</div>
            <div className="text-sm text-gray-500">出欠を確認・登録</div>
          </Link>

          {isAdmin && (
            <Link
              href="/members"
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="text-2xl mb-2">👥</div>
              <div className="font-medium">メンバー</div>
              <div className="text-sm text-gray-500">メンバー一覧</div>
            </Link>
          )}

          <Link
            href="/profile"
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
          >
            <div className="text-2xl mb-2">👤</div>
            <div className="font-medium">プロフィール</div>
            <div className="text-sm text-gray-500">自分の情報を編集</div>
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="text-2xl mb-2">⚙️</div>
              <div className="font-medium">管理</div>
              <div className="text-sm text-gray-500">イベント・メンバー管理</div>
            </Link>
          )}
        </div>

      </main>
    </div>
  );
}
