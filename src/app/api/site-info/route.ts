import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/site-info - 公開用のサイト情報 (公式LINEなど)
// 認証不要。ログイン前のフッターやゲストの CTA からも参照する。
//
// contactEmail はかつてここで返していたが、管理者通知用 (非公開) に位置付けが
// 変わったため公開しない (見せると admin の連絡先が漏れる)。
export async function GET() {
  let officialLineUrl = "";
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: "officialLineUrl" },
    });
    officialLineUrl = row?.value ?? "";
  } catch {
    // テーブル未マイグレーション等のエラーは握り潰す (空文字でフォールバック)
  }
  return NextResponse.json({
    success: true,
    data: { officialLineUrl },
  });
}
