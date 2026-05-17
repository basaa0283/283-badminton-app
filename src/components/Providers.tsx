"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef } from "react";

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

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <StaleSessionGuard />
      {children}
    </SessionProvider>
  );
}
