import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/site-info - 公開用のサイト情報 (お問い合わせ先など)
// 認証不要。ログイン前のフッターからも参照する。
export async function GET() {
  let contactEmail = "";
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "contactEmail" },
    });
    contactEmail = setting?.value ?? "";
  } catch {
    // テーブル未マイグレーション等のエラーは握り潰す (空文字でフォールバック)
  }
  return NextResponse.json({ success: true, data: { contactEmail } });
}
