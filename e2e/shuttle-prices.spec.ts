import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("シャトル単価マスタ (admin)", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  test("単価を追加→一覧に表示→削除でクリーンアップ", async ({ page }) => {
    const memo = `E2E shuttle ${Date.now()}`;
    // 既存データと衝突しないようテストごとにランダムな価格
    const casePrice = 70000 + Math.floor(Math.random() * 10000);
    let createdId: string | undefined;
    try {
      const createRes = await page.request.post("/api/admin/shuttle-prices", {
        data: {
          effectiveFrom: new Date().toISOString(),
          casePrice,
          shuttlesPerCase: 120,
          memo,
        },
      });
      expect(createRes.status()).toBe(201);
      createdId = (await createRes.json()).data.id as string;

      // 一覧に memo (一意) が表示される
      await page.goto("/admin/shuttle-prices");
      await expect(page.getByText(memo)).toBeVisible();
      // ケース価格が表示される
      await expect(page.getByText(new RegExp(casePrice.toLocaleString()))).toBeVisible();
    } finally {
      if (createdId) {
        await page.request.delete(`/api/admin/shuttle-prices/${createdId}`).catch(() => {});
      }
    }
  });

  test("単価設定後のイベントで個数入力時にシャトル代が自動算出される", async ({ page }) => {
    const eventTitle = `E2E shuttle apply ${Date.now()}`;
    // 直近 (1時間前) を effectiveFrom にし、その後 (現在 - 30分) を eventDate にする
    const effectiveFrom = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const eventDate = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    let priceId: string | undefined;
    let eventId: string | undefined;
    try {
      // 単価設定: 1個あたり 100円 (1200円のケース)
      const priceRes = await page.request.post("/api/admin/shuttle-prices", {
        data: { effectiveFrom, casePrice: 1200, shuttlesPerCase: 12 },
      });
      priceId = (await priceRes.json()).data.id as string;

      // イベント作成
      const eventRes = await page.request.post("/api/events", {
        data: { title: eventTitle, eventDate, notifyMembers: false },
      });
      eventId = (await eventRes.json()).data.id as string;

      // GET で applicableShuttlePrice が返ることを確認
      const getRes = await page.request.get(`/api/events/${eventId}`);
      const fetched = (await getRes.json()).data;
      expect(fetched.expenses.applicableShuttlePrice).not.toBeNull();
      expect(fetched.expenses.applicableShuttlePrice.pricePerPiece).toBe(100);

      // UI: 個数=5入力 → 自動でシャトル代500円
      await page.goto(`/events/${eventId}`);
      const expensesHeading = page.getByText("経費・収支 (管理者のみ)");
      await expect(expensesHeading).toBeVisible();
      const expensesCard = page.locator("div.rounded-lg.shadow", { has: expensesHeading });

      await expensesCard.getByRole("button", { name: "編集" }).click();
      await page.getByLabel("シャトル個数").fill("5");

      // シャトル代が自動で 500 に
      await expect(page.getByLabel("シャトル代 (円)")).toHaveValue("500");
    } finally {
      if (eventId) await page.request.delete(`/api/events/${eventId}`).catch(() => {});
      if (priceId) await page.request.delete(`/api/admin/shuttle-prices/${priceId}`).catch(() => {});
    }
  });
});
