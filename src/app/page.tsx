"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { AnnouncementBanner } from "@/components/announcements/AnnouncementBanner";
import { AdminAlertsBanner } from "@/components/admin/AdminAlertsBanner";
import { ProfileCompletionBanner } from "@/components/home/ProfileCompletionBanner";
import { permissions, UserRole } from "@/lib/permissions";
import { useLogPageView } from "@/lib/use-log-page-view";

interface PublicLinks {
  officialLineUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [links, setLinks] = useState<PublicLinks | null>(null);
  useLogPageView("home.view");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/public-links")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setLinks(json.data);
      })
      .catch(() => {});
  }, [status]);

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

  const role = session.user.role as UserRole;
  const isAdmin = role === "admin" || role === "subadmin";
  const canViewTournaments = permissions.canViewTournaments(role);

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <AnnouncementBanner />

        {isAdmin && <AdminAlertsBanner />}

        <ProfileCompletionBanner />

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

          {canViewTournaments && (
            <Link
              href="/tournaments"
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="text-2xl mb-2">🏆</div>
              <div className="font-medium">大会記録</div>
              <div className="text-sm text-gray-500">過去の大会と成績の登録</div>
            </Link>
          )}

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

        {/* リンクバナー (サークルについて / 公式 LINE / Instagram / YouTube)。
            URL が未設定の外部リンクは出さない。サークルについては必ず表示。 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">リンク</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/about"
              className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
            >
              <div className="text-2xl mb-1">📖</div>
              <div className="text-sm font-medium text-amber-900">サークルについて</div>
            </Link>
            {links?.officialLineUrl && (
              <a
                href={links.officialLineUrl}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
              >
                <div className="text-2xl mb-1">💬</div>
                <div className="text-sm font-medium text-green-900">公式 LINE</div>
              </a>
            )}
            {links?.instagramUrl && (
              <a
                href={links.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-pink-50 hover:bg-pink-100 transition-colors"
              >
                <div className="text-2xl mb-1">📷</div>
                <div className="text-sm font-medium text-pink-900">Instagram</div>
              </a>
            )}
            {links?.youtubeUrl && (
              <a
                href={links.youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
              >
                <div className="text-2xl mb-1">▶️</div>
                <div className="text-sm font-medium text-red-900">YouTube</div>
              </a>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
