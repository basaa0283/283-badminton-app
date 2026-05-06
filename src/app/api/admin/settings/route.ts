import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";

const SETTING_KEYS = ["notifyNewEventEnabled", "notifyReminderEnabled", "notifyWaitlistEnabled"] as const;
type SettingKey = (typeof SETTING_KEYS)[number];

// GET /api/admin/settings
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }
    if (!permissions.canAccessAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    }

    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: [...SETTING_KEYS] } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    return NextResponse.json({
      success: true,
      data: Object.fromEntries(
        SETTING_KEYS.map((key) => [key, map[key] !== "false"])
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}

// PUT /api/admin/settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }
    if (!permissions.canAccessAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    }

    const body = await request.json();

    for (const key of SETTING_KEYS) {
      if (typeof body[key] === "boolean") {
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: String(body[key]) },
          create: { key, value: String(body[key]) },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
