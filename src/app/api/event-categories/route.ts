import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tenantWhere } from "@/lib/tenant";

// GET /api/event-categories - 全認証ユーザー向け一覧 (フォーム選択用)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const tw = await tenantWhere();
  const categories = await prisma.eventCategory.findMany({
    where: { AND: [tw] },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ success: true, data: categories });
}
