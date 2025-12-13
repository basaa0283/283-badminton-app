"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { permissions, UserRole } from "@/lib/permissions";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

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
                <div className="text-3xl mb-2">📊</div>
                <h2 className="font-semibold text-gray-900">履歴管理</h2>
                <p className="text-sm text-gray-500 mt-1">ログイン・出欠回答履歴を確認</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
