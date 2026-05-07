"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useLiff } from "@/hooks/useLiff";
import { liff } from "@/lib/liff";

type State = "loading" | "valid" | "invalid" | "expired" | "already_logged_in";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isInitialized: liffReady, isInClient, isLiffLoggedIn, login: liffLogin } = useLiff();
  const token = params.token as string;

  const [state, setState] = useState<State>("loading");
  const [nickname, setNickname] = useState("");
  const [isLineIAB, setIsLineIAB] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && /Line\//.test(navigator.userAgent)) {
      setIsLineIAB(true);
    }
  }, []);

  // LIFF コンテキスト判定（SDK初期化後）
  const inLiff = liffReady && isInClient();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated") {
      setState("already_logged_in");
      return;
    }

    validateToken();
  }, [status, token]);

  const validateToken = async () => {
    try {
      const res = await fetch(`/api/invite/${token}`);
      const data = await res.json();

      if (!data.success) {
        setState(data.error?.code === "EXPIRED" ? "expired" : "invalid");
        return;
      }

      setNickname(data.data.nickname);
      setState("valid");
    } catch {
      setState("invalid");
    }
  };

  const handleLogin = () => {
    if (inLiff) {
      // LIFF経由のログイン
      if (!isLiffLoggedIn) {
        liffLogin();
        return;
      }
      const idToken = liff?.getIDToken?.();
      if (idToken) {
        signIn("liff", { idToken, callbackUrl: `/invite/complete?token=${token}` });
      } else {
        liffLogin();
      }
      return;
    }
    signIn("line", { callbackUrl: `/invite/complete?token=${token}` });
  };

  const handleCompleteAsCurrentUser = () => {
    router.push(`/invite/complete?token=${token}`);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // LINE IAB検出時、LIFF環境ならそのまま動作させる。LIFFでなければ外部ブラウザ誘導。
  if (isLineIAB && !inLiff) {
    const isAndroid = /Android/.test(navigator.userAgent);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-full max-w-md px-4">
          <Card>
            <CardContent className="py-8">
              <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
                283バドミントン
              </h1>
              <div className="text-center space-y-4">
                <div className="text-4xl">🌐</div>
                <p className="font-bold text-gray-900">ブラウザで開いてください</p>
                <p className="text-sm text-gray-600">
                  LINEアプリ内ではログインできません。
                  {isAndroid
                    ? "右上の「︙」→「他のアプリで開く」→ Chrome を選んでください。"
                    : "右下の「︙」→「ブラウザで開く」を選んでください。"}
                </p>
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 break-all">
                  {typeof window !== "undefined" ? window.location.href : ""}
                </div>
                <Button onClick={handleCopy} className="w-full">
                  {copied ? "コピーしました！" : "URLをコピー"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md px-4">
        <Card>
          <CardContent className="py-8">
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
              283バドミントン
            </h1>
            <p className="text-center text-gray-500 mb-8">参加招待</p>

            {state === "loading" && (
              <p className="text-center text-gray-500">確認中...</p>
            )}

            {state === "valid" && (
              <div className="text-center space-y-6">
                <p className="text-gray-700">
                  <span className="font-bold">{nickname}</span> さんへの招待です。
                </p>
                <p className="text-sm text-gray-500">
                  LINEアカウントでログインして、サークルへの参加を完了してください。
                </p>
                <Button onClick={handleLogin} className="w-full bg-[#06C755] hover:bg-[#05b34d]">
                  <span className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 5.82 2 10.5c0 2.67 1.35 5.04 3.47 6.61.17.12.27.31.27.52l-.04 1.92c-.01.28.26.49.53.4l2.14-.69c.15-.05.31-.04.45.02 1.01.36 2.09.55 3.18.55 5.52 0 10-3.82 10-8.5S17.52 2 12 2z" />
                    </svg>
                    LINEでログインして参加
                  </span>
                </Button>
              </div>
            )}

            {state === "already_logged_in" && (
              <div className="text-center space-y-6">
                <p className="text-gray-700">
                  現在 <span className="font-bold">{session?.user.nickname}</span> としてログイン中です。
                </p>
                <p className="text-sm text-gray-500">
                  このアカウントで招待を受け入れますか？
                </p>
                <Button onClick={handleCompleteAsCurrentUser} className="w-full">
                  このアカウントで参加する
                </Button>
              </div>
            )}

            {state === "expired" && (
              <div className="text-center space-y-4">
                <p className="text-red-600 font-medium">招待リンクの有効期限が切れています</p>
                <p className="text-sm text-gray-500">管理者に新しい招待リンクを発行してもらってください。</p>
              </div>
            )}

            {state === "invalid" && (
              <div className="text-center space-y-4">
                <p className="text-red-600 font-medium">無効な招待リンクです</p>
                <p className="text-sm text-gray-500">リンクが正しいか確認してください。</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
