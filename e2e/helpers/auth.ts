import type { Page } from "@playwright/test";

/**
 * dev-login プロバイダで指定ユーザーとしてログインしセッションを確立する。
 * 戻り値の `page` は / 直下にいる。
 *
 * - page.request を使う (page.context() と cookie 共有)。
 * - ログイン後に利用規約への同意も自動で済ませる。
 *   E2E 全テストが TermsAcceptanceGuard で /onboarding/terms に
 *   飛ばされて壊れるのを防ぐため。
 */
export async function loginAs(page: Page, userId: string): Promise<void> {
  const csrfRes = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  await page.request.post("/api/auth/callback/dev-login", {
    form: {
      csrfToken,
      userId,
      callbackUrl: "/",
      json: "true",
    },
  });

  // 規約同意 (失敗しても致命的ではないので catch して握り潰す)。
  await page.request.post("/api/onboarding/terms").catch(() => {});

  await page.goto("/28bad");

  // セッション確立を UI で待つ (Header のユーザーメニューボタンは認証時のみ
  // 描画される)。これを待たずに次の page.goto を始めると、初回セッション取得
  // fetch が navigation で中断され、next-auth が「未認証」と誤判定 → ホームが
  // /login へ push → goto が interrupted で落ちる (特に WebKit で顕在化するレース)。
  await page
    .locator('button[aria-haspopup="menu"]')
    .waitFor({ timeout: 15_000 });

  // next-auth v4 は初回セッション取得後に localStorage 経由の同期通知を行い、
  // WebKit では自ページにもエコーして直後にもう 1 回セッション fetch が走る。
  // その fetch が次の page.goto で中断されると null セッション扱いになり
  // /login へ誤リダイレクトされるため、ネットワークが静まるまで待つ。
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** 環境変数から管理者の userId を取得。未設定時は test.skip と組み合わせる。 */
export function adminUserId(): string | undefined {
  return process.env.E2E_ADMIN_USER_ID;
}
