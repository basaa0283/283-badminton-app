"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type State = "confirm" | "processing" | "success" | "error";

// 通知メールの配信停止リンク先。認証不要。
// メールクライアントのリンク先読み (prefetch) で誤って配信停止しないよう、
// ページを開いただけでは何もせず「配信停止する」ボタンの押下で初めて POST する。
function EmailUnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<State>(token ? "confirm" : "error");

  const handleUnsubscribe = async () => {
    setState("processing");
    try {
      const res = await fetch("/api/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      setState(data.success ? "success" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <>
      {(state === "confirm" || state === "processing") && (
        <div className="text-center space-y-6">
          <p className="text-lg font-bold text-gray-900">
            メール通知の配信停止
          </p>
          <p className="text-sm text-gray-500">
            283バドミントンからのすべてのメール通知を停止します。よろしいですか？
          </p>
          <Button
            onClick={handleUnsubscribe}
            loading={state === "processing"}
            className="w-full"
          >
            配信停止する
          </Button>
        </div>
      )}

      {state === "success" && (
        <div className="text-center space-y-6">
          <p className="text-lg font-bold text-gray-900">配信を停止しました</p>
          <p className="text-sm text-gray-500">
            プロフィール画面からいつでも再開できます
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
            通知設定はプロフィール画面からも変更できます
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

export default function EmailUnsubscribePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md px-4">
        <Card>
          <CardContent className="py-8">
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-8">
              283バドミントン
            </h1>
            <Suspense fallback={<p className="text-center text-gray-500">読み込み中...</p>}>
              <EmailUnsubscribeContent />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
