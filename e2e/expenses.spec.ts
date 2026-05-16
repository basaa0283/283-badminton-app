import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("経費・収支管理 (admin)", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  test("イベントに経費を入力して PUT で保存 → GET で取得できる", async ({ page }) => {
    const title = `E2E expense ${Date.now()}`;
    // 過去日でイベント作成（経費入力は実施後のシナリオ想定）
    const eventDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let eventId: string | undefined;
    try {
      const createRes = await page.request.post("/api/events", {
        data: { title, eventDate, notifyMembers: false },
      });
      eventId = (await createRes.json()).data.id as string;

      // 経費を PUT
      const putRes = await page.request.put(`/api/events/${eventId}`, {
        data: {
          shuttleCount: 3,
          shuttleCost: 4500,
          gymCost: 5000,
          otherCost: 800,
          otherMemo: "飲み物代",
          actualRevenue: 12000,
        },
      });
      expect(putRes.ok()).toBeTruthy();

      // GET で取得
      const getRes = await page.request.get(`/api/events/${eventId}`);
      const fetched = (await getRes.json()).data;
      expect(fetched.expenses).toBeTruthy();
      expect(fetched.expenses.shuttleCount).toBe(3);
      expect(fetched.expenses.shuttleCost).toBe(4500);
      expect(fetched.expenses.gymCost).toBe(5000);
      expect(fetched.expenses.otherCost).toBe(800);
      expect(fetched.expenses.otherMemo).toBe("飲み物代");
      expect(fetched.expenses.actualRevenue).toBe(12000);
    } finally {
      if (eventId) {
        await page.request.delete(`/api/events/${eventId}`).catch(() => {});
      }
    }
  });

  test("UI からイベント詳細で経費を編集・保存できる", async ({ page }) => {
    const title = `E2E expense UI ${Date.now()}`;
    const eventDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    let eventId: string | undefined;
    try {
      const createRes = await page.request.post("/api/events", {
        data: { title, eventDate, notifyMembers: false },
      });
      eventId = (await createRes.json()).data.id as string;

      await page.goto(`/events/${eventId}`);
      // ExpensesCard 内の編集ボタンに絞る
      const expensesHeading = page.getByText("経費・収支 (管理者のみ)");
      await expect(expensesHeading).toBeVisible();
      const expensesCard = page.locator("div.rounded-lg.shadow", { has: expensesHeading });

      await expensesCard.getByRole("button", { name: "編集" }).click();

      await page.getByLabel("シャトル個数").fill("4");
      await page.getByLabel("シャトル代 (円)").fill("6000");
      await page.getByLabel("体育館代 (円)").fill("3000");
      await page.getByLabel("実集金額 (円)").fill("10000");

      await page.getByRole("button", { name: "保存" }).click();

      // 編集モードが閉じ、収支が表示される (10000 - 9000 = 1000)
      await expect(expensesCard.getByRole("button", { name: "編集" })).toBeVisible();
      await expect(page.getByText(/1,000円/)).toBeVisible();
    } finally {
      if (eventId) {
        await page.request.delete(`/api/events/${eventId}`).catch(() => {});
      }
    }
  });

  test("経費レポートで合計が表示される", async ({ page }) => {
    await page.goto("/admin/expense-report");
    await expect(page.getByRole("heading", { name: "経費レポート" })).toBeVisible();
    await expect(page.getByText("合計収入")).toBeVisible();
    await expect(page.getByText("合計経費")).toBeVisible();
    await expect(page.getByText("合計収支")).toBeVisible();
  });
});
