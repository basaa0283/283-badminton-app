"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { permissions, UserRole, getRoleName } from "@/lib/permissions";

export function Header() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  if (!session?.user) return null;

  const role = session.user.role as UserRole;
  const isAdmin = permissions.canAccessAdmin(role);
  const canViewTournaments = permissions.canViewTournaments(role);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="ホームに戻る" className="hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="２８ばど" className="h-9 w-auto" />
          </Link>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-3 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
            >
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">{session.user.nickname}</div>
                <div className="text-xs text-gray-500">{getRoleName(role)}</div>
              </div>
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
              >
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                >
                  プロフィール
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut({ callbackUrl: "/login" });
                  }}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-100"
                  role="menuitem"
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>

        <nav className="flex gap-1 mt-3 -mx-2 overflow-x-auto">
          <NavLink href="/events">イベント一覧</NavLink>
          <NavLink href="/announcements">お知らせ</NavLink>
          {canViewTournaments && <NavLink href="/tournaments">大会記録</NavLink>}
          {isAdmin && <NavLink href="/members">メンバー</NavLink>}
          {isAdmin && <NavLink href="/admin">管理</NavLink>}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg whitespace-nowrap"
    >
      {children}
    </Link>
  );
}
