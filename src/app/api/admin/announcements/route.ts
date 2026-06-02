import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";

const createSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(200, "タイトルは200文字以内"),
  body: z.string().min(1, "本文は必須です").max(4000, "本文は4000文字以内"),
  audienceMember: z.boolean().default(true),
  audienceVisitor: z.boolean().default(true),
  audienceGuest: z.boolean().default(true),
  severity: z.enum(["info", "important"]).default("info"),
  publishedAt: z.string().datetime().optional(),
});

// GET /api/admin/announcements - admin 用、全件
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const items = await prisma.announcement.findMany({
    orderBy: { publishedAt: "desc" },
    include: { createdBy: { select: { nickname: true } } },
  });
  return NextResponse.json({ success: true, data: items });
}

// POST /api/admin/announcements - 新規投稿
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
      { status: 400 }
    );
  }

  const created = await prisma.announcement.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      audienceMember: parsed.data.audienceMember,
      audienceVisitor: parsed.data.audienceVisitor,
      audienceGuest: parsed.data.audienceGuest,
      severity: parsed.data.severity,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : new Date(),
      createdById: session.user.id,
    },
  });

  void logActivity({
    userId: session.user.id,
    action: "announcement.create",
    entityType: "Announcement",
    entityId: created.id,
    metadata: { title: created.title, severity: created.severity },
  });

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
