import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { RESERVED_SLUGS, SLUG_PATTERN } from "@/lib/platform-admin";

// POST /api/public/tenant-applications - サークル開設の申請 (未ログインで可)
// /apply フォームから送信される。作成された申請は /platform で承認/却下する。
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // スパム対策 (honeypot): 画面上は不可視のフィールド。bot が埋めたら黙って成功を返す
    if (typeof body?.website === "string" && body.website.trim() !== "") {
      return NextResponse.json({ success: true });
    }

    const circleName = typeof body?.circleName === "string" ? body.circleName.trim() : "";
    const desiredSlug =
      typeof body?.desiredSlug === "string" && body.desiredSlug.trim() !== ""
        ? body.desiredSlug.trim().toLowerCase()
        : null;
    const contactName = typeof body?.contactName === "string" ? body.contactName.trim() : "";
    const contactInfo = typeof body?.contactInfo === "string" ? body.contactInfo.trim() : "";
    const note =
      typeof body?.note === "string" && body.note.trim() !== "" ? body.note.trim() : null;

    if (!circleName || circleName.length > 100) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "サークル名は必須です (100文字以内)" } },
        { status: 400 },
      );
    }
    if (!contactName || contactName.length > 100) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "お名前は必須です (100文字以内)" } },
        { status: 400 },
      );
    }
    if (!contactInfo || contactInfo.length > 200) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "連絡先は必須です (200文字以内)" } },
        { status: 400 },
      );
    }
    if (note && note.length > 2000) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "補足は2000文字以内で入力してください" } },
        { status: 400 },
      );
    }
    if (desiredSlug && (!SLUG_PATTERN.test(desiredSlug) || RESERVED_SLUGS.has(desiredSlug))) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "希望IDは英小文字・数字・ハイフンで3〜30文字です (一部の語は使えません)" } },
        { status: 400 },
      );
    }

    // 未処理の申請が積み上がりすぎている場合は受付を止める (荒らし対策の上限)
    const pendingCount = await prisma.tenantApplication.count({
      where: { status: "pending" },
    });
    if (pendingCount >= 50) {
      return NextResponse.json(
        { success: false, error: { code: "CAPACITY", message: "現在申請が混み合っています。時間をおいて再度お試しください" } },
        { status: 429 },
      );
    }

    const app = await prisma.tenantApplication.create({
      data: { circleName, desiredSlug, contactName, contactInfo, note },
    });
    void logActivity({
      userId: null, // 未ログイン申請
      action: "tenant_application.submit",
      entityType: "TenantApplication",
      entityId: app.id,
      metadata: { circleName },
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("tenant-applications POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
