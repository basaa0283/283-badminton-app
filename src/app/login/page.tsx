"use client";

import { signIn, useSession } from "next-auth/react";
import { useLiff } from "@/hooks/useLiff";
import { liff } from "@/lib/liff";
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
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const addDebug = (msg: string) =>
    setDebugLog((prev) => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] ${msg}`]);

  // 既にログイン済みの場合はホームにリダイレクト
  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/");
    }
  }, [status, session, router]);

  const [autoSignInTried, setAutoSignInTried] = useState(false);

  useEffect(() => {
    // LIFF環境でログイン済みなら、ID Token を取得して LIFF 経由のサインイン
    // 失敗時の無限リダイレクトループを防ぐため、1セッションで1回だけ実行
    if (
      autoSignInTried ||
      !isInitialized ||
      !isInClient() ||
      !isLiffLoggedIn ||
      !profile ||
      status === "authenticated" ||
      status === "loading"
    ) {
      return;
    }
    let idToken: string | null = null;
    try {
      idToken = liff?.getIDToken?.() ?? null;
    } catch {
      // not logged in
    }
    if (!idToken) return;

    setAutoSignInTried(true);
    addDebug("auto-signin: calling signIn(liff)");
    (async () => {
      try {
        const result = await signIn("liff", {
          idToken,
          callbackUrl: "/",
          redirect: false,
        });
        addDebug(`auto-signin result: error=${result?.error ?? "none"}, url=${result?.url ?? "none"}`);
        if (result?.url && !result?.error) {
          window.location.href = result.url;
        }
      } catch (err) {
        addDebug(`auto-signin threw: ${String(err)}`);
      }
    })();
  }, [autoSignInTried, isInitialized, isLiffLoggedIn, profile, status, isInClient]);

  // LIFF環境で強制的に再認証する（getIDToken が null/失敗時の復旧）
  const forceLiffRelogin = () => {
    try {
      if (liff && liff.isLoggedIn?.()) {
        liff.logout();
      }
      liff?.login?.();
    } catch (err) {
      console.error("[handleLogin] liff re-login failed:", err);
    }
  };

  const handleLogin = async () => {
    addDebug("handleLogin called");
    addDebug(`isInitialized=${isInitialized}, isInClient=${isInClient()}, isLiffLoggedIn=${isLiffLoggedIn}`);

    if (!isInitialized || !isInClient()) {
      addDebug("falling back to LINE OAuth");
      await signIn("line", { callbackUrl: "/" });
      void liffLogin;
      return;
    }

    // LIFF未ログイン → liff.login() で認証フローへ
    if (!isLiffLoggedIn) {
      addDebug("not logged in to LIFF, calling liff.login()");
      try {
        liff?.login?.();
      } catch (err) {
        addDebug(`liff.login threw: ${String(err)}`);
      }
      return;
    }

    // LIFFログイン済み → ID Token取得を試みる
    let idToken: string | null = null;
    try {
      idToken = liff?.getIDToken?.() ?? null;
    } catch (err) {
      addDebug(`getIDToken threw: ${String(err)}`);
    }
    addDebug(`idToken=${idToken ? `${idToken.substring(0, 20)}...` : "null"}`);

    if (!idToken) {
      addDebug("calling forceLiffRelogin");
      forceLiffRelogin();
      return;
    }

    addDebug("calling signIn(liff)");
    try {
      const result = await signIn("liff", {
        idToken,
        callbackUrl: "/",
        redirect: false,
      });
      addDebug(`signIn result: error=${result?.error ?? "none"}, url=${result?.url ?? "none"}`);
      if (result?.error) {
        forceLiffRelogin();
        return;
      }
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      addDebug(`signIn threw: ${String(err)}`);
    }

    void liffLogin;
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

        {/* DEBUG: LIFF状態とイベントログ（後で削除予定）*/}
        <div className="mt-6 border-t pt-3 text-xs text-gray-500 space-y-1 break-all">
          <div className="font-semibold text-gray-700">DEBUG</div>
          <div>isInitialized: {String(isInitialized)}</div>
          <div>isInClient: {isInitialized ? String(isInClient()) : "(待機中)"}</div>
          <div>isLiffLoggedIn: {String(isLiffLoggedIn)}</div>
          <div>profile: {profile ? profile.displayName : "null"}</div>
          <div>liff.getIDToken: {isInitialized ? (() => {
            try {
              return liff?.getIDToken?.() ? "あり" : "なし";
            } catch {
              return "(エラー)";
            }
          })() : "(待機中)"}</div>
          <div>session status: {status}</div>
          {debugLog.length > 0 && (
            <div className="mt-2 pt-2 border-t">
              <div className="font-semibold">events:</div>
              {debugLog.map((line, i) => (
                <div key={i} className="font-mono">{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
