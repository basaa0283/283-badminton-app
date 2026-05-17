import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/site-info - 公開用のサイト情報 (お問い合わせ先・公式LINEなど)
// 認証不要。ログイン前のフッターやゲストの CTA からも参照する。
export async function GET() {
  let contactEmail = "";
  let officialLineUrl = "";
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["contactEmail", "officialLineUrl"] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    contactEmail = map.contactEmail ?? "";
    officialLineUrl = map.officialLineUrl ?? "";
  } catch {
    // テーブル未マイグレーション等のエラーは握り潰す (空文字でフォールバック)
  }
  return NextResponse.json({
    success: true,
    data: { contactEmail, officialLineUrl },
  });
}
