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
    const eventDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let eventId: string | undefined;
    try {
      const createRes = await page.request.post("/api/events", {
        data: { title, eventDate, notifyMembers: false },
      });
      eventId = (await createRes.json()).data.id as string;

      const putRes = await page.request.put(`/api/events/${eventId}`, {
        data: {
          shuttleCount: 3,
          shuttleCost: 4500,
          gymCost: 5000,
          otherCost: 800,
          otherMemo: "飲み物代",
        },
      });
      expect(putRes.ok()).toBeTruthy();

      const getRes = await page.request.get(`/api/events/${eventId}`);
      const fetched = (await getRes.json()).data;
      expect(fetched.expenses).toBeTruthy();
      expect(fetched.expenses.shuttleCount).toBe(3);
      expect(fetched.expenses.shuttleCost).toBe(4500);
      expect(fetched.expenses.gymCost).toBe(5000);
      expect(fetched.expenses.otherCost).toBe(800);
      expect(fetched.expenses.otherMemo).toBe("飲み物代");
      // 実集金額は paid 参加者から自動算出。今は paid 参加者なしなので null。
      expect(fetched.expenses.actualRevenue).toBeNull();
    } finally {
      if (eventId) {
        await page.request.delete(`/api/events/${eventId}`).catch(() => {});
      }
    }
  });

  test("attending メンバーを paid にすると expenses.actualRevenue に反映される", async ({ page }) => {
    const title = `E2E payment ${Date.now()}`;
    const eventDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const admin = adminUserId()!;

    let eventId: string | undefined;
    try {
      const evRes = await page.request.post("/api/events", {
        data: { title, eventDate, fee: 500, feeVisible: true, notifyMembers: false },
      });
      eventId = (await evRes.json()).data.id as string;

      const addRes = await page.request.post(`/api/events/${eventId}/attendances`, {
        data: { userId: admin, status: "attending" },
      });
      const attendanceId = (await addRes.json()).data.id as string;

      // 受取済み (金額未指定 → event.fee=500 採用)
      await page.request.put(`/api/events/${eventId}/attendances/${attendanceId}`, {
        data: { paymentStatus: "paid" },
      });

      const getRes = await page.request.get(`/api/events/${eventId}`);
      expect((await getRes.json()).data.expenses.actualRevenue).toBe(500);

      // 金額個別指定: 300円に変更
      await page.request.put(`/api/events/${eventId}/attendances/${attendanceId}`, {
        data: { paymentAmount: 300 },
      });
      const getRes2 = await page.request.get(`/api/events/${eventId}`);
      expect((await getRes2.json()).data.expenses.actualRevenue).toBe(300);
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
      const expensesHeading = page.getByText("経費・収支 (管理者のみ)");
      await expect(expensesHeading).toBeVisible();
      const expensesCard = page.locator("div.rounded-lg.shadow", { has: expensesHeading });

      await expensesCard.getByRole("button", { name: "編集" }).click();

      await page.getByLabel("シャトル個数").fill("4");
      await page.getByLabel("シャトル代 (円)").fill("6000");
      await page.getByLabel("体育館代 (円)").fill("3000");

      await page.getByRole("button", { name: "保存" }).click();

      // 編集モードが閉じる
      await expect(expensesCard.getByRole("button", { name: "編集" })).toBeVisible();
      // 経費合計 9000円 が表示される
      await expect(expensesCard.getByText(/9,000円/)).toBeVisible();
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
