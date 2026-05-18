"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";

/**
 * 利用規約・プライバシーポリシー同意画面
 *
 * 未同意ユーザーがアプリ機能にアクセスする前に必ず通る。
 * 同意済みでも規約バージョンが上がれば再度ここに飛ばされる (Providers の guard 参照)。
 *
 * useSearchParams を使うため Suspense で包んでいる (Next.js 15+ の要請)。
 */
export default function OnboardingTermsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      }
    >
      <OnboardingTermsContent />
    </Suspense>
  );
}

function OnboardingTermsContent() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 未ログインなら /login へ
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  const isRevision =
    !!session?.user?.termsAcceptedVersion &&
    session.user.termsAcceptedVersion !== CURRENT_TERMS_VERSION;

  const handleAccept = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/terms", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "保存に失敗しました");
        return;
      }
      await update(); // session の termsAcceptedVersion を最新化
      router.replace(next);
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="py-8 space-y-5">
            <div className="text-center space-y-2">
              <h1 className="text-xl font-bold text-gray-900">
                {isRevision ? "規約が更新されました" : "ご利用にあたって"}
              </h1>
              <p className="text-sm text-gray-600">
                {isRevision
                  ? "最新の利用規約・プライバシーポリシーをご確認の上、改めてご同意ください。"
                  : "ご利用前に、サークルの方針と利用規約・プライバシーポリシーをご確認ください。"}
              </p>
              <p className="text-xs text-gray-400">バージョン: {CURRENT_TERMS_VERSION}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 space-y-2">
              <p>
                <Link
                  href="/about"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  サークルについて (運営方針・練習の流れ) を読む ↗
                </Link>
              </p>
              <p>
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  利用規約 を読む ↗
                </Link>
              </p>
              <p>
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  プライバシーポリシー を読む ↗
                </Link>
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4"
              />
              <span>利用規約とプライバシーポリシーに同意します</span>
            </label>

            {error && (
              <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleAccept}
              loading={submitting}
              disabled={!agreed}
            >
              同意して利用を開始
            </Button>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="block w-full text-center text-xs text-gray-500 hover:underline"
            >
              同意せずにログアウト
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
