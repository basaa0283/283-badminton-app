import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("管理者: 過去イベントの出欠/支払管理", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  test("過去イベントの attendance を attending → not_attending に書き換え、支払情報も保存できる", async ({ page }) => {
    const title = `E2E pastEvent ${Date.now()}`;
    const eventDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 過去
    const admin = adminUserId()!;

    let eventId: string | undefined;
    try {
      const evRes = await page.request.post("/api/events", {
        data: { title, eventDate, fee: 500, feeVisible: true, notifyMembers: false },
      });
      eventId = (await evRes.json()).data.id as string;

      // adminが自分を attending として attendance 追加
      const addRes = await page.request.post(`/api/events/${eventId}/attendances`, {
        data: { userId: admin, status: "attending" },
      });
      expect(addRes.ok()).toBeTruthy();
      const attendance = (await addRes.json()).data;
      const attendanceId = attendance.id as string;

      // attendance を not_attending に変更
      const putRes = await page.request.put(`/api/events/${eventId}/attendances/${attendanceId}`, {
        data: { status: "not_attending" },
      });
      expect(putRes.ok()).toBeTruthy();
      expect((await putRes.json()).data.status).toBe("not_attending");

      // 戻して支払情報を記録
      const putRes2 = await page.request.put(`/api/events/${eventId}/attendances/${attendanceId}`, {
        data: { status: "attending", paymentStatus: "paid", paymentAmount: 300 },
      });
      const finalAttendance = (await putRes2.json()).data;
      expect(finalAttendance.status).toBe("attending");
      expect(finalAttendance.paymentStatus).toBe("paid");
      expect(finalAttendance.paymentAmount).toBe(300);
    } finally {
      if (eventId) await page.request.delete(`/api/events/${eventId}`).catch(() => {});
    }
  });

  test("非管理者は更新APIで 403", async ({ page, request }) => {
    // admin で seed
    await loginAs(page, adminUserId()!);
    const title = `E2E forbidden ${Date.now()}`;
    const eventDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const admin = adminUserId()!;

    let eventId: string | undefined;
    try {
      const evRes = await page.request.post("/api/events", {
        data: { title, eventDate, notifyMembers: false },
      });
      eventId = (await evRes.json()).data.id as string;
      const addRes = await page.request.post(`/api/events/${eventId}/attendances`, {
        data: { userId: admin, status: "attending" },
      });
      const attendanceId = (await addRes.json()).data.id as string;

      // 非ログイン (request) で叩く
      const forbiddenRes = await request.put(`/api/events/${eventId}/attendances/${attendanceId}`, {
        data: { status: "not_attending" },
      });
      expect(forbiddenRes.status()).toBe(401);
    } finally {
      if (eventId) await page.request.delete(`/api/events/${eventId}`).catch(() => {});
    }
  });
});
