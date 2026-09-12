import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import { tenantWhere } from "@/lib/tenant";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(4000).optional(),
  audienceMember: z.boolean().optional(),
  audienceVisitor: z.boolean().optional(),
  audienceGuest: z.boolean().optional(),
  severity: z.enum(["info", "important"]).optional(),
  publishedAt: z.string().datetime().optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.body !== undefined) data.body = parsed.data.body;
  if (parsed.data.audienceMember !== undefined) data.audienceMember = parsed.data.audienceMember;
  if (parsed.data.audienceVisitor !== undefined) data.audienceVisitor = parsed.data.audienceVisitor;
  if (parsed.data.audienceGuest !== undefined) data.audienceGuest = parsed.data.audienceGuest;
  if (parsed.data.severity !== undefined) data.severity = parsed.data.severity;
  if (parsed.data.publishedAt !== undefined) data.publishedAt = new Date(parsed.data.publishedAt);

  const tw = await tenantWhere();
  const existing = await prisma.announcement.findFirst({ where: { id, AND: [tw] } });
  if (!existing) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  try {
    const updated = await prisma.announcement.update({ where: { id }, data });
    void logActivity({
      userId: session.user.id,
      action: "announcement.update",
      entityType: "Announcement",
      entityId: id,
      metadata: { title: updated.title },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }
  const { id } = await params;
  const tw = await tenantWhere();
  const existing = await prisma.announcement.findFirst({ where: { id, AND: [tw] } });
  if (!existing) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  await prisma.announcement.delete({ where: { id } }).catch(() => null);
  void logActivity({
    userId: session.user.id,
    action: "announcement.delete",
    entityType: "Announcement",
    entityId: id,
  });
  return NextResponse.json({ success: true });
}
