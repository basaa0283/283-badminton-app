"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef } from "react";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";

/**
 * オンボーディング系のガードを通さない (= 普通に描画する) パスのプレフィックス。
 * /onboarding 配下は終端ページ自体なので除外、/privacy /terms /invite /api は
 * ガード対象外。/about (公開のサークル紹介) と /release-notes は未ログインでも
 * 開ける公開ページなので、規約同意画面からのリンクで遷移可能にする。
 */
const EXEMPT_PREFIXES = [
  "/login",
  "/onboarding",
  "/privacy",
  "/terms",
  "/about",
  "/release-notes",
  "/invite",
  "/api",
];

// JWT に該当する DB ユーザーが居ない場合 (古いCookieが残っている等) は自動でサインアウトする。
// /login にいるときは何もしない (signOutループ防止)。
function StaleSessionGuard() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const triggered = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (pathname?.startsWith("/login")) return;
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId && !triggered.current) {
      triggered.current = true;
      signOut({ callbackUrl: "/login" });
    }
  }, [status, session, pathname]);

  return null;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-gray-500 text-sm">読み込み中...</div>
    </div>
  );
}

/**
 * 規約未同意 / 承認待ち のユーザーが保護対象のページを開こうとした場合に、
 * - 子コンポーネントを描画せず、ローディング画面を表示する
 * - 同期的に router.replace で onboarding 系へ飛ばす
 *
 * こうしないと描画 → useEffect で redirect の順になって、ホームなど
 * 行き先のページが一瞬見えてしまう (flash) ため、保護対象ページは
 * 「リダイレクトが終わるまで描画させない」運用にする。
 */
function OnboardingGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const exempt = useMemo(() => {
    if (!pathname) return true;
    return EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
  }, [pathname]);

  const needsTermsRedirect =
    status === "authenticated" &&
    !exempt &&
    session?.user?.termsAcceptedVersion !== CURRENT_TERMS_VERSION;

  const needsPendingRedirect =
    status === "authenticated" &&
    !exempt &&
    !needsTermsRedirect && // 規約同意が先
    session?.user?.role === "pending";

  useEffect(() => {
    if (needsTermsRedirect && pathname) {
      const next = encodeURIComponent(pathname);
      router.replace(`/onboarding/terms?next=${next}`);
    } else if (needsPendingRedirect) {
      router.replace("/onboarding/pending");
    }
  }, [needsTermsRedirect, needsPendingRedirect, pathname, router]);

  if (needsTermsRedirect || needsPendingRedirect) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <StaleSessionGuard />
      <OnboardingGate>{children}</OnboardingGate>
    </SessionProvider>
  );
}
