import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const KEYS = ["officialLineUrl", "instagramUrl", "youtubeUrl"] as const;
type Key = (typeof KEYS)[number];

// GET /api/public-links
// 公開可能な外部リンク (officialLineUrl / instagramUrl / youtubeUrl) を返す。
// 認証不要。TOP のバナー描画など、誰でも見える場所で使う想定。
export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: KEYS as unknown as string[] } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const data: Record<Key, string> = {
      officialLineUrl: map.officialLineUrl ?? "",
      instagramUrl: map.instagramUrl ?? "",
      youtubeUrl: map.youtubeUrl ?? "",
    };
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("public-links GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
