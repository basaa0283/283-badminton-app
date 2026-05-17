import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

// POST /api/announcements/read - 指定IDをまとめて既読にする
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
      { status: 400 }
    );
  }

  // 各 id を upsert (already-read は何もしない)
  await Promise.all(
    parsed.data.ids.map((announcementId) =>
      prisma.announcementRead.upsert({
        where: { userId_announcementId: { userId, announcementId } },
        update: {},
        create: { userId, announcementId },
      })
    )
  );

  return NextResponse.json({ success: true });
}
