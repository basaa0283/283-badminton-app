"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";

type State = "loading" | "success" | "error";

// 確認メールのリンク先。認証不要 (メールを開ける = 本人確認とみなす)。
// 副作用は POST で実行する (GET だと prefetch で誤発火するため)。
function EmailVerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<State>("loading");
  const [maskedEmail, setMaskedEmail] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    // useEffect 再実行時に二重コールしない
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/email/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!data.success) {
          setState("error");
          return;
        }
        setMaskedEmail(data.data.email);
        setState("success");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  return (
    <>
      {state === "loading" && (
        <p className="text-center text-gray-500">確認しています...</p>
      )}

      {state === "success" && (
        <div className="text-center space-y-6">
          <div className="text-5xl">✅</div>
          <p className="text-lg font-bold text-gray-900">
            メール通知を有効にしました
          </p>
          <p className="text-sm text-gray-500">{maskedEmail}</p>
          <p className="text-xs text-gray-500">
            受け取る通知の種類はプロフィール画面から変更できます
          </p>
          <Link
            href="/"
            className="block w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700"
          >
            ホームへ
          </Link>
        </div>
      )}

      {state === "error" && (
        <div className="text-center space-y-6">
          <p className="text-red-600 font-medium">リンクが無効です</p>
          <p className="text-sm text-gray-500">
            リンクの有効期限 (24時間) が切れている可能性があります。
            プロフィール画面から確認メールを再送してください。
          </p>
          <Link
            href="/profile"
            className="block w-full bg-gray-100 text-gray-700 rounded-lg py-2 font-medium hover:bg-gray-200"
          >
            プロフィールへ
          </Link>
        </div>
      )}
    </>
  );
}

export default function EmailVerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md px-4">
        <Card>
          <CardContent className="py-8">
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-8">
              283バドミントン
            </h1>
            <Suspense fallback={<p className="text-center text-gray-500">読み込み中...</p>}>
              <EmailVerifyContent />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
