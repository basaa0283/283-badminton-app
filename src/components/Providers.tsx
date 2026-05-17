"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef } from "react";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";

// JWT に該当する DB ユーザーが居ない場合 (古いCookieが残っている等) は自動でサインアウトする。
// /login にいるときは何もしない (signOutループ防止)。
function StaleSessionGuard() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const triggered = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (pathname?.startsWith("/login")) return;
    // session.user.id が無い = session callback で dbUser 未発見
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId && !triggered.current) {
      triggered.current = true;
      signOut({ callbackUrl: "/login" });
    }
  }, [status, session, pathname]);

  return null;
}

// 規約・プライバシーポリシーに同意していない (または旧バージョン同意) ユーザーは
// /onboarding/terms にリダイレクトする。
// /login, /onboarding/*, /privacy, /terms, /api/* は対象外。
const TERMS_EXEMPT_PREFIXES = [
  "/login",
  "/onboarding",
  "/privacy",
  "/terms",
  "/invite", // 招待リンクは LINE ログイン直後に通るので除外
  "/api",
];

function TermsAcceptanceGuard() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!pathname) return;
    if (TERMS_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return;

    const accepted = session?.user?.termsAcceptedVersion;
    if (accepted !== CURRENT_TERMS_VERSION) {
      const next = encodeURIComponent(pathname);
      router.replace(`/onboarding/terms?next=${next}`);
    }
  }, [status, session, pathname, router]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <StaleSessionGuard />
      <TermsAcceptanceGuard />
      {children}
    </SessionProvider>
  );
}
