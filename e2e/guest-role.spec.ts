import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

/**
 * ゲストロール (閲覧専用) の UX リグレッションテスト。
 *
 * 仕様:
 *   - ゲストは visibleToGuest=true なカテゴリのイベントのみ閲覧可能
 *   - ゲストは出欠登録できない (フォーム非表示 + API 403)
 *   - ゲストは「閲覧専用モード」バナー表示
 *
 * テスト用データはすべて E2E プレフィックス付きで作成し finally で削除。
 * 残骸はパイプラインの cleanup ジョブが回収する。
 */
test.describe("ゲストロール (閲覧専用)", () => {
  test("visibleToGuest=true のイベントだけ見え、出欠フォームが出ない", async ({ page, browserName }) => {
    const admin = adminUserId();
    test.skip(!admin, "E2E_ADMIN_USER_ID 未設定のためスキップ");
    // WebKit (mobile-safari) は admin → guest のセッション切り替えで
    // dev-login の Set-Cookie が安定せず /events で再ログイン誘導されることがある。
    // ロール挙動の検証はブラウザ非依存なので chromium / mobile-chrome に任せ、
    // WebKit ではスキップする。
    test.skip(browserName === "webkit", "WebKit のセッション切替不安定のためスキップ");

    let visibleEventId: string | undefined;
    let hiddenEventId: string | undefined;
    let guestUserId: string | undefined;

    try {
      // ----- セットアップ (admin として) -----
      await loginAs(page, admin!);

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // ゲストに見えるはずのイベント (visibleToGuest=true)
      const visEvRes = await page.request.post("/api/events", {
        data: {
          title: `E2E guest visible ${Date.now()}`,
          eventDate: futureDate,
          visibleToGuest: true,
          notifyMembers: false,
        },
      });
      visibleEventId = (await visEvRes.json()).data.id as string;

      // ゲストには隠すべきイベント (デフォルト visibleToGuest=false)
      const hidEvRes = await page.request.post("/api/events", {
        data: {
          title: `E2E guest hidden ${Date.now()}`,
          eventDate: futureDate,
          notifyMembers: false,
        },
      });
      hiddenEventId = (await hidEvRes.json()).data.id as string;

      // ゲストユーザー作成: 仮アカウントは visitor で作成 → PUT で guest に変更
      const userRes = await page.request.post("/api/admin/members", {
        data: { nickname: `E2E_guest_${Date.now()}` },
      });
      guestUserId = (await userRes.json()).data.id as string;
      await page.request.put(`/api/members/${guestUserId}`, {
        data: { role: "guest" },
      });

      // ----- ゲストとしてログインし直し -----
      // WebKit はセッション cookie の上書きが不安定なので、
      // 旧 admin セッションを明示的に消してから guest としてログインする。
      await page.context().clearCookies();
      await loginAs(page, guestUserId);

      // ----- /events を開いて検証 -----
      await page.goto("/events");

      // 閲覧専用バナー
      await expect(page.getByText(/閲覧専用モード/)).toBeVisible();

      // 「新規作成」ボタンが出ない
      await expect(page.getByRole("link", { name: "新規作成" })).toHaveCount(0);

      // 見えるイベントは表示される
      await expect(
        page.getByText(`E2E guest visible`, { exact: false })
      ).toBeVisible();

      // 隠すイベントは見えない (タイトル一致なし)
      await expect(page.getByText(`E2E guest hidden`, { exact: false })).toHaveCount(0);

      // ----- イベント詳細を開いて出欠フォームがないことを検証 -----
      await page.goto(`/events/${visibleEventId}`);
      await expect(page.getByRole("heading", { name: /E2E guest visible/ })).toBeVisible();
      // 出欠登録カード見出しがないこと (出欠フォームが描画されていない)
      await expect(page.getByRole("heading", { name: "出欠登録" })).toHaveCount(0);

      // ----- 隠しイベントの詳細は 404 で返るので画面に出ない -----
      const hiddenGetRes = await page.request.get(`/api/events/${hiddenEventId}`);
      expect(hiddenGetRes.status()).toBe(404);

      // ----- 出欠 API を直接叩いても 403 -----
      const attendRes = await page.request.post(
        `/api/events/${visibleEventId}/attendance`,
        { data: { status: "attending" } }
      );
      expect(attendRes.status()).toBe(403);
    } finally {
      // admin に戻してから片付け (cookie を一度クリアして再ログイン)
      await page.context().clearCookies();
      await loginAs(page, admin!);
      if (visibleEventId) {
        await page.request.delete(`/api/events/${visibleEventId}`).catch(() => {});
      }
      if (hiddenEventId) {
        await page.request.delete(`/api/events/${hiddenEventId}`).catch(() => {});
      }
      if (guestUserId) {
        await page.request.delete(`/api/admin/members/${guestUserId}`).catch(() => {});
      }
    }
  });
});
