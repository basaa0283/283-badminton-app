import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";

// GET /api/events/locations - 過去イベントで使われた場所の distinct リスト
// 補完用なので admin/subadmin のみ。
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canCreateEvent(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const rows = await prisma.event.findMany({
    where: { location: { not: null } },
    select: { location: true, eventDate: true },
    orderBy: { eventDate: "desc" },
    take: 200,
  });

  // distinct + 直近利用順を保持
  const seen = new Set<string>();
  const locations: string[] = [];
  for (const r of rows) {
    const loc = r.location?.trim();
    if (loc && !seen.has(loc)) {
      seen.add(loc);
      locations.push(loc);
    }
  }

  return NextResponse.json({ success: true, data: locations });
}
