import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("招待リンク二重実行防止", () => {
  // v1.3.0 修正: /invite/complete が二重実行され、2回目に NOT_FOUND が出ていた問題
  // ここでは API ベースで「同じトークンで2回呼んだ場合、2回目は NOT_FOUND」を保証する。
  test("同じトークンで2回 complete を呼ぶと2回目は NOT_FOUND", async ({ page }) => {
    const admin = adminUserId();
    test.skip(!admin, "E2E_ADMIN_USER_ID が未設定のためスキップ");

    await loginAs(page, admin!);

    let receiverId: string | undefined;
    let provisionalId: string | undefined;
    try {
      // 受け手 (member) を作成: 仮アカウントとして作成し member に昇格
      const recRes = await page.request.post("/api/admin/members", {
        data: { nickname: `E2E_recv_${Date.now()}` },
      });
      receiverId = (await recRes.json()).data.id as string;
      const promoteRes = await page.request.put(`/api/members/${receiverId}`, {
        data: { nickname: `E2E_recv_${Date.now()}`, role: "member" },
      });
      expect(promoteRes.ok()).toBeTruthy();

      // 招待元 (visitor 仮アカウント) を作成
      const provRes = await page.request.post("/api/admin/members", {
        data: { nickname: `E2E_prov_${Date.now()}` },
      });
      provisionalId = (await provRes.json()).data.id as string;

      // 招待トークン発行
      const inviteRes = await page.request.post(`/api/admin/invitations/${provisionalId}`);
      const inviteData = await inviteRes.json();
      const token = inviteData.data.inviteUrl.split("/").pop() as string;
      expect(token).toBeTruthy();

      // 受け手としてログイン
      await loginAs(page, receiverId);

      // 1回目: 成功
      const first = await page.request.post("/api/invite/complete", {
        data: { token },
      });
      expect(first.ok()).toBeTruthy();
      const firstJson = await first.json();
      expect(firstJson.success).toBe(true);

      // 2回目: トークンが削除されているので NOT_FOUND
      const second = await page.request.post("/api/invite/complete", {
        data: { token },
      });
      expect(second.status()).toBe(404);
      const secondJson = await second.json();
      expect(secondJson.success).toBe(false);
      expect(secondJson.error.code).toBe("NOT_FOUND");
    } finally {
      // admin に戻ってクリーンアップ
      // 招待元は complete 成功で既に削除済み。受け手だけ削除すれば良い。
      await loginAs(page, admin!);
      if (receiverId) {
        await page.request.delete(`/api/admin/members/${receiverId}`).catch(() => {});
      }
      // 念のため招待元も残っていれば削除
      if (provisionalId) {
        await page.request.delete(`/api/admin/members/${provisionalId}`).catch(() => {});
      }
    }
  });
});
