"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type State = "loading" | "success" | "error";

function InviteCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const token = searchParams.get("token");

  const [state, setState] = useState<State>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (!token) {
      setErrorMessage("トークンが見つかりません");
      setState("error");
      return;
    }

    completeInvitation();
  }, [status, token]);

  const completeInvitation = async () => {
    try {
      const res = await fetch("/api/invite/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!data.success) {
        setErrorMessage(data.error?.message || "招待の完了に失敗しました");
        setState("error");
        return;
      }

      await update();
      setState("success");
    } catch {
      setErrorMessage("エラーが発生しました");
      setState("error");
    }
  };

  return (
    <>
      {state === "loading" && (
        <p className="text-center text-gray-500">処理中...</p>
      )}

      {state === "success" && (
        <div className="text-center space-y-6">
          <div className="text-5xl">🎉</div>
          <p className="text-xl font-bold text-gray-900">参加登録が完了しました！</p>
          <p className="text-sm text-gray-500">
            {session?.user.nickname} さん、ようこそ！
          </p>
          <Button onClick={() => router.push("/")} className="w-full">
            ホームへ
          </Button>
        </div>
      )}

      {state === "error" && (
        <div className="text-center space-y-6">
          <p className="text-red-600 font-medium">{errorMessage}</p>
          <Button variant="secondary" onClick={() => router.push("/")} className="w-full">
            ホームへ
          </Button>
        </div>
      )}
    </>
  );
}

export default function InviteCompletePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md px-4">
        <Card>
          <CardContent className="py-8">
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-8">
              283バドミントン
            </h1>
            <Suspense fallback={<p className="text-center text-gray-500">読み込み中...</p>}>
              <InviteCompleteContent />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
