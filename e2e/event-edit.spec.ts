import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("イベント編集 (admin)", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  test("作成したイベントの title / location / capacity を更新できる", async ({ page }) => {
    const initialTitle = `E2E edit ${Date.now()}`;
    const updatedTitle = `${initialTitle} (updated)`;
    const eventDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    let eventId: string | undefined;
    try {
      const createRes = await page.request.post("/api/events", {
        data: { title: initialTitle, eventDate, location: "旧コート", notifyMembers: false },
      });
      eventId = (await createRes.json()).data.id as string;

      const putRes = await page.request.put(`/api/events/${eventId}`, {
        data: {
          title: updatedTitle,
          eventDate,
          location: "新コート",
          capacity: 12,
        },
      });
      expect(putRes.ok()).toBeTruthy();

      // GET で反映確認
      const getRes = await page.request.get(`/api/events/${eventId}`);
      const fetched = (await getRes.json()).data;
      expect(fetched.title).toBe(updatedTitle);
      expect(fetched.location).toBe("新コート");
      expect(fetched.capacity).toBe(12);

      // UI でも更新後タイトルが表示される
      await page.goto(`/events/${eventId}`);
      await expect(page.getByText(updatedTitle)).toBeVisible();
    } finally {
      if (eventId) {
        await page.request.delete(`/api/events/${eventId}`).catch(() => {});
      }
    }
  });
});
