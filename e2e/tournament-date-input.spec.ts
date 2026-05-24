import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

// 大会登録の「開催日」プルダウン (DateInput) 操作の回帰テスト。
// iOS Safari で「option タップしても値が反映されない」「次へが活性化しない」
// バグが過去に発生したため、mobile-safari / mobile-chrome の両プロジェクトで
// 走らせて再発防止する。
test.describe("大会登録の DateInput プルダウン操作", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  test("年→月→日 を順にタップすると表示が反映され、次へが活性化する", async ({ page }) => {
    await page.goto("/tournaments/new");
    await expect(page.getByRole("heading", { name: "大会を登録" })).toBeVisible();

    const nextBtn = page.getByRole("button", { name: "次へ" });
    await expect(nextBtn).toBeDisabled();

    // 年プルダウン
    const yearBtn = page.getByRole("button", { name: "年" }).first();
    await yearBtn.click();
    const targetYear = String(new Date().getFullYear());
    await page.getByRole("button", { name: `${targetYear}年` }).click();
    await expect(yearBtn).toHaveText(new RegExp(`${targetYear}年`));

    // 月プルダウン
    const monthBtn = page.getByRole("button", { name: "月" }).first();
    await monthBtn.click();
    await page.getByRole("button", { name: "6月" }).click();
    await expect(monthBtn).toHaveText(/6月/);

    // 日プルダウン
    const dayBtn = page.getByRole("button", { name: "日" }).first();
    await dayBtn.click();
    await page.getByRole("button", { name: "15日" }).click();
    await expect(dayBtn).toHaveText(/15日/);

    // ここまで揃ったら「次へ」が活性化
    await expect(nextBtn).toBeEnabled();
  });
});
