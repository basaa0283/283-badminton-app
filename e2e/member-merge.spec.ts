import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

/**
 * 承認待ちユーザー × 仮アカウントのマージ。
 *
 * v4.0.0 で Membership (テナント所属) が導入された後、仮アカウント側に Membership が
 * 残ったまま User を削除しようとして FK 制約違反になり、マージが「サーバーエラー」で
 * 失敗していた。また role は Membership から解決されるため、マージ後の権限が
 * Membership 側に引き継がれていることも検証する。
 */
test.describe("メンバーのマージ", () => {
  test("仮アカウントの role とタグが引き継がれ、仮アカウントは削除される", async ({ page, browserName }) => {
    const admin = adminUserId();
    test.skip(!admin, "E2E_ADMIN_USER_ID 未設定のためスキップ");
    test.skip(browserName === "webkit", "WebKit のセッション切替不安定のためスキップ");

    let provisionalId: string | undefined;
    let pendingId: string | undefined;
    let tagId: string | undefined;

    try {
      await loginAs(page, admin!);

      // 仮アカウント (member + タグ付き)。role 変更で Membership が作られる
      const provRes = await page.request.post("/api/admin/members", {
        data: { nickname: `E2E_merge_prov_${Date.now()}` },
      });
      provisionalId = (await provRes.json()).data.id as string;
      const roleRes = await page.request.put(`/api/members/${provisionalId}`, {
        data: { role: "member" },
      });
      expect(roleRes.ok()).toBeTruthy();

      const tagRes = await page.request.post("/api/admin/tags", {
        data: { name: `E2E_merge_tag_${Date.now()}` },
      });
      tagId = (await tagRes.json()).data.id as string;
      await page.request.put(`/api/admin/members/${provisionalId}/tags`, {
        data: { tagIds: [tagId] },
      });

      // マージ先 (新規参加者役)
      const pendRes = await page.request.post("/api/admin/members", {
        data: { nickname: `E2E_merge_pending_${Date.now()}` },
      });
      pendingId = (await pendRes.json()).data.id as string;
      // 本番の新規参加者と同じく、マージ先にも Membership がある状態にする
      // (role 変更の dual-write で visitor の Membership が作られる)
      await page.request.put(`/api/members/${pendingId}`, {
        data: { role: "visitor" },
      });

      // マージ実行
      const mergeRes = await page.request.put(`/api/admin/members/${pendingId}/merge`, {
        data: { provisionalUserId: provisionalId },
      });
      expect(mergeRes.status(), await mergeRes.text()).toBe(200);
      const mergedProvisionalId = provisionalId;
      provisionalId = undefined; // 削除済み

      // 仮アカウントは消えている
      const provGet = await page.request.get(`/api/members/${mergedProvisionalId}`);
      expect(provGet.status()).toBe(404);

      // タグが引き継がれている
      const tagUsers = await page.request.get(`/api/admin/tags/${tagId}/users`);
      expect((await tagUsers.json()).data.userIds).toContain(pendingId);

      // マージ先でログインすると、セッションの role が仮アカウントの member になっている
      await page.context().clearCookies();
      await loginAs(page, pendingId);
      const sess = await (await page.request.get("/api/auth/session")).json();
      expect(sess.user.role).toBe("member");
    } finally {
      await page.context().clearCookies();
      await loginAs(page, admin!);
      for (const id of [pendingId, provisionalId]) {
        if (id) await page.request.delete(`/api/admin/members/${id}`).catch(() => {});
      }
      if (tagId) await page.request.delete(`/api/admin/tags/${tagId}`).catch(() => {});
    }
  });
});
