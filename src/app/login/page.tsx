"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [showTrouble, setShowTrouble] = useState(false);

  // 既にログイン済みの場合はホームにリダイレクト
  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/");
    }
  }, [status, session, router]);

  const handleLogin = async () => {
    await signIn("line", { callbackUrl: "/" });
  };

  const handleDevLogin = async (userId: string) => {
    await signIn("dev-login", { userId, callbackUrl: "/" });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-b from-blue-50 to-gray-100 px-4 py-8">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <div className="flex justify-center mb-3">
          <img src="/logo.png" alt="２８ばど" className="h-20 w-auto max-w-full" />
        </div>
        <h1 className="text-xl font-bold text-center mb-1 text-gray-900">
          出欠管理アプリ
        </h1>
        <p className="text-gray-500 text-center text-sm mb-6">
          サークルの練習・イベントの出欠を簡単に
        </p>
        {status === "loading" ? (
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

            <div className="pt-2 text-center">
              <Link
                href="/preview"
                className="text-sm text-blue-600 hover:underline"
              >
                初めての方 (参加検討中) はこちら →
              </Link>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowTrouble((v) => !v)}
                className="w-full text-xs text-gray-500 underline"
              >
                {showTrouble ? "閉じる" : "ログインできない場合は?"}
              </button>
              {showTrouble && (
                <div className="mt-2 text-xs text-gray-700 space-y-3 bg-gray-50 p-3 rounded-lg leading-relaxed">
                  <p>
                    「LINEでログイン」を押してもログイン画面に戻ってしまう場合、端末のキャッシュをクリアしてから再度お試しください。
                  </p>
                  <div>
                    <strong className="block text-gray-900 mb-0.5">
                      ① LINE アプリのキャッシュ削除
                    </strong>
                    <p>
                      LINE アプリ → 設定 → トーク → データの削除 → 「キャッシュ」にチェック → 削除
                    </p>
                  </div>
                  <div>
                    <strong className="block text-gray-900 mb-0.5">
                      ② ブラウザのキャッシュ削除
                    </strong>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        <span className="font-medium">iPhone (Safari):</span>{" "}
                        設定 → Safari → 「履歴と Web サイトデータを消去」
                      </li>
                      <li>
                        <span className="font-medium">Android (Chrome):</span>{" "}
                        Chrome → 右上 ︙ → 履歴 → 「閲覧履歴データの削除」
                      </li>
                    </ul>
                  </div>
                  <p className="text-gray-600">
                    上記でも解消しない場合は、公式 LINE アカウント宛にご連絡ください。
                  </p>
                </div>
              )}
            </div>

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
