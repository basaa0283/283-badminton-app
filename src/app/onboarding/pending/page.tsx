"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/**
 * 承認待ち画面
 *
 * 新規 LINE ログインで作られた pending ロールのユーザーが規約同意後に
 * 遷移してくる画面。管理者がロールを付与するまでここに留まる。
 */
export default function OnboardingPendingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [officialLineUrl, setOfficialLineUrl] = useState<string>("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // 管理者が承認したら role が変わる。session を定期的に refetch し、
  // role が pending から外れたら自動でホームに飛ばす。
  useEffect(() => {
    if (status !== "authenticated") return;
    const role = session?.user?.role;
    if (role && role !== "pending") {
      router.replace("/");
    }
  }, [status, session, router]);

  // 30秒ごとに session を refetch (承認後に画面遷移を促す)
  useEffect(() => {
    if (status !== "authenticated") return;
    const id = setInterval(() => {
      update();
    }, 30_000);
    return () => clearInterval(id);
  }, [status, update]);

  useEffect(() => {
    fetch("/api/site-info")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setOfficialLineUrl(json.data.officialLineUrl || "");
      })
      .catch(() => {});
  }, []);

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  const nickname = session?.user?.nickname || "ゲスト";

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="py-8 space-y-5 text-center">
            <div className="text-5xl">⏳</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">
                管理者の承認をお待ちください
              </h1>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{nickname}</span> さん、ご登録ありがとうございます。
                サークル管理者が内容を確認しますので、しばらくお待ちください。
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-900 text-left">
              <p className="font-medium mb-1">参加希望の方は</p>
              <p>
                公式 LINE から自己紹介と参加希望の旨をご連絡いただけるとスムーズです。
              </p>
            </div>

            {officialLineUrl && (
              <a
                href={officialLineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#06C755] hover:bg-[#05b34d] text-white font-bold py-2.5 px-5 rounded-lg text-sm w-full"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.48 2 2 5.82 2 10.5c0 2.67 1.35 5.04 3.47 6.61.17.12.27.31.27.52l-.04 1.92c-.01.28.26.49.53.4l2.14-.69c.15-.05.31-.04.45.02 1.01.36 2.09.55 3.18.55 5.52 0 10-3.82 10-8.5S17.52 2 12 2z" />
                </svg>
                公式 LINE で連絡する
              </a>
            )}

            <p className="text-xs text-gray-400">
              承認されると、画面が自動で切り替わります。
            </p>

            <div className="pt-2">
              <Button
                variant="secondary"
                className="w-full text-sm"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                ログアウト
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
