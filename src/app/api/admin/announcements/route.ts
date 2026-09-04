import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import { dispatchNotificationEmails } from "@/lib/notify-email-dispatch";
import { getDefaultTenantId } from "@/lib/tenant";

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

  const tenantId = await getDefaultTenantId();
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
      tenantId,
    },
  });

  void logActivity({
    userId: session.user.id,
    action: "announcement.create",
    entityType: "Announcement",
    entityId: created.id,
    metadata: { title: created.title, severity: created.severity },
  });

  // メール通知: 即時公開のみ対象 (予約投稿は将来課題 — publishedAt が未来の場合は送らない)
  // eventId 紐付きお知らせ (当日連絡) も対象外 (M3 で別途対応)
  const isScheduled = created.publishedAt > new Date();
  const hasEventId = created.eventId != null;
  if (!isScheduled && !hasEventId) {
    void (async () => {
      try {
        // audienceMember/Visitor/Guest と role の突き合わせ + admin/subadmin は常に対象
        const targetRoles: string[] = ["admin", "subadmin"];
        if (created.audienceMember) targetRoles.push("member");
        if (created.audienceVisitor) targetRoles.push("visitor");
        if (created.audienceGuest) targetRoles.push("guest");

        // pending / hold 中のユーザーは通知対象から除外
        // (targetRoles に pending は含まれないが、hold は role と独立なので明示的に弾く)
        const targetUsers = await prisma.user.findMany({
          where: {
            role: { in: targetRoles },
            holdAt: null,
          },
          select: { id: true },
        });

        const appUrl = process.env.NEXTAUTH_URL ?? "";
        const bodyText =
          created.body + `\n\n詳しくはアプリで: ${appUrl}/announcements`;

        await dispatchNotificationEmails({
          type: "announcement",
          subject: `【２８ばど】${created.title}`,
          body: bodyText,
          recipientUserIds: targetUsers.map((u) => u.id),
        });
      } catch (err) {
        console.error("[announcements POST] メール通知エラー:", err);
      }
    })();
  }

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
