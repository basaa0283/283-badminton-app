"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { permissions, UserRole, getRoleName } from "@/lib/permissions";

export function Header() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  const role = session.user.role as UserRole;
  const isAdmin = permissions.canAccessAdmin(role);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900">
            283バドミントン
          </Link>

          <div className="flex items-center gap-3">
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
          </div>
        </div>

        <nav className="flex gap-1 mt-3 -mx-2 overflow-x-auto">
          <NavLink href="/events">イベント</NavLink>
          <NavLink href="/members">メンバー</NavLink>
          <NavLink href="/profile">プロフィール</NavLink>
          {isAdmin && <NavLink href="/admin">管理</NavLink>}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg whitespace-nowrap"
          >
            ログアウト
          </button>
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
