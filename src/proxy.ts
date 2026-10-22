import { NextRequest, NextResponse } from "next/server";

// マルチテナント P2: URL サブパス (/<tenant-slug>/...) の解決。
// 設計: docs/superpowers/specs/2026-09-04-multi-tenant-business-design.md
//
// 方式: ページファイルは移動せず、middleware で rewrite する。
//   /283bad/events → 内部では /events を描画 (URL バーは /283bad/events のまま)
//   旧 URL /events → /283bad/events へリダイレクト (LINE メッセージ内の旧リンク救済)
// API (/api/...) と認証コールバックはスラッグ無しのまま (LINE Login の
// コールバック URL 設定を変えないため)。テナントは cookie で伝搬する。
//
// 先頭セグメントが slug 形式で、下記のグローバルページ・テナントページ名でなければ
// テナント slug とみなして rewrite する。slug が DB に実在するかは middleware では
// 見ない (DB に触れないため)。実在しない slug はアプリ側 (getCurrentTenantId) で
// 「存在しないテナント」に解決され、データは何も見えない。
const DEFAULT_SLUG = "28bad";
const SLUG_SEGMENT = /^[a-z0-9][a-z0-9-]{2,29}$/;

// テナント外のグローバルページ (slug と誤認しないよう除外)
const GLOBAL_PAGE_SEGMENTS = new Set([
  "login",
  "about",
  "preview",
  "terms",
  "privacy",
  "email",
  "invite",
  "onboarding",
  "platform",
  "apply",
]);

// 過去に使っていた slug からのリダイレクト (旧リンク救済)
const LEGACY_SLUG_REDIRECTS: Record<string, string> = {
  "283bad": "28bad",
};

export const TENANT_COOKIE = "tenant-slug";

// テナント配下として扱うページ (旧 URL からのリダイレクト対象)。
// これ以外 (login/about/preview/terms/privacy/email/invite/onboarding 等) は
// テナント外のグローバルページとしてそのまま通す。
const TENANT_PAGE_PREFIXES = [
  "/events",
  "/members",
  "/admin",
  "/tournaments",
  "/profile",
  "/release-notes",
  "/announcements",
];

function isTenantPage(pathname: string): boolean {
  if (pathname === "/") return true;
  return TENANT_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. 旧 slug は新 slug へリダイレクト (旧リンク・ブックマーク救済)
  const m0 = pathname.match(/^\/([a-z0-9-]+)(\/.*)?$/);
  if (m0 && LEGACY_SLUG_REDIRECTS[m0[1]]) {
    const url = request.nextUrl.clone();
    url.pathname = `/${LEGACY_SLUG_REDIRECTS[m0[1]]}${m0[2] ?? ""}`;
    return NextResponse.redirect(url);
  }

  // 1. /<slug>/... 形式: slug を剥がして内部パスに rewrite + cookie セット
  const m = pathname.match(/^\/([a-z0-9-]+)(\/.*)?$/);
  if (
    m &&
    SLUG_SEGMENT.test(m[1]) &&
    !GLOBAL_PAGE_SEGMENTS.has(m[1]) &&
    !isTenantPage(`/${m[1]}`)
  ) {
    const slug = m[1];
    const innerPath = m[2] || "/";
    const url = request.nextUrl.clone();
    url.pathname = innerPath;
    const res = NextResponse.rewrite(url);
    res.cookies.set(TENANT_COOKIE, slug, { path: "/", sameSite: "lax" });
    return res;
  }

  // 2. スラッグ無しのテナントページ (/events 等): いま居るテナント (cookie) の
  //    URL へリダイレクト。アプリ内リンクは slug 無しで書かれているため、これで
  //    テナント内の遷移が維持される。cookie が無ければデフォルトテナントへ。
  if (isTenantPage(pathname)) {
    const cookieSlug = request.cookies.get(TENANT_COOKIE)?.value;
    const slug =
      cookieSlug && SLUG_SEGMENT.test(cookieSlug) && !GLOBAL_PAGE_SEGMENTS.has(cookieSlug)
        ? cookieSlug
        : DEFAULT_SLUG;
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // 3. それ以外 (グローバルページ・未知パス) はそのまま
  return NextResponse.next();
}

export const config = {
  // API・Next 内部・静的ファイルは対象外
  matcher: ["/((?!api|_next|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
