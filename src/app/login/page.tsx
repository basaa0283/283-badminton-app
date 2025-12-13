"use client";

import { signIn, useSession } from "next-auth/react";
import { useLiff } from "@/hooks/useLiff";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// 開発環境かどうか
const isDevelopment = process.env.NODE_ENV === "development";

// テストユーザー一覧
const TEST_USERS = [
  { id: "admin-user-1", name: "管理太郎", role: "admin" },
  { id: "subadmin-user-1", name: "副管理花子", role: "subadmin" },
  { id: "member-user-1", name: "田中一郎", role: "member" },
  { id: "member-user-2", name: "佐藤美咲", role: "member" },
  { id: "visitor-user-1", name: "伊藤さん", role: "visitor" },
  { id: "guest-user-1", name: "新規ゲスト", role: "guest" },
];

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isInitialized, isLiffLoggedIn, profile, login: liffLogin, isInClient } = useLiff();
  const [showDevLogin, setShowDevLogin] = useState(false);

  // 既にログイン済みの場合はホームにリダイレクト
  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/");
    }
  }, [status, session, router]);

  useEffect(() => {
    // LIFF内でログイン済みの場合、NextAuthでサインイン
    if (isInitialized && isLiffLoggedIn && profile && status !== "authenticated") {
      signIn("line", { callbackUrl: "/" });
    }
  }, [isInitialized, isLiffLoggedIn, profile, status]);

  const handleLogin = async () => {
    // LIFF環境の場合はLIFFログイン、それ以外はNextAuth
    if (isInitialized && isInClient()) {
      liffLogin();
    } else {
      await signIn("line", { callbackUrl: "/" });
    }
  };

  const handleDevLogin = async (userId: string) => {
    await signIn("dev-login", { userId, callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          283バドミントン
        </h1>
        <p className="text-gray-600 text-center mb-8">
          出欠管理アプリ
        </p>

        {(!isInitialized || status === "loading") ? (
          <div className="text-center text-gray-500">
            読み込み中...
          </div>
        ) : status === "authenticated" ? (
          <div className="text-center text-gray-500">
            リダイレクト中...
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleLogin}
              className="w-full bg-[#06C755] hover:bg-[#05b34d] text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 5.82 2 10.5c0 2.67 1.35 5.04 3.47 6.61.17.12.27.31.27.52l-.04 1.92c-.01.28.26.49.53.4l2.14-.69c.15-.05.31-.04.45.02 1.01.36 2.09.55 3.18.55 5.52 0 10-3.82 10-8.5S17.52 2 12 2z" />
              </svg>
              LINEでログイン
            </button>

            {/* 開発環境のみ: テストユーザーでログイン */}
            {isDevelopment && (
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowDevLogin(!showDevLogin)}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
                >
                  {showDevLogin ? "開発用ログインを閉じる" : "開発用ログイン"}
                </button>

                {showDevLogin && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-400 text-center mb-2">
                      テストユーザーを選択
                    </p>
                    {TEST_USERS.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleDevLogin(user.id)}
                        className="w-full py-2 px-3 text-sm text-left bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center justify-between transition-colors"
                      >
                        <span>{user.name}</span>
                        <span className="text-xs text-gray-400">{user.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
