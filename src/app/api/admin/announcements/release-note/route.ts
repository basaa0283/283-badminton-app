import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import pkg from "../../../../../../package.json";

const LAST_ANNOUNCED_KEY = "lastAnnouncedReleaseVersion";

// GET /api/admin/announcements/release-note
// 現在のアプリバージョンと、最後にお知らせ化したバージョンを返す。
// 管理画面の「今のバージョンをお知らせ化」ボタンの活性化判定に使う。
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  }

  const setting = await prisma.systemSetting.findUnique({
    where: { key: LAST_ANNOUNCED_KEY },
  });

  return NextResponse.json({
    success: true,
    data: {
      currentVersion: pkg.version,
      lastAnnouncedVersion: setting?.value ?? null,
      alreadyAnnounced: setting?.value === pkg.version,
    },
  });
}

// POST /api/admin/announcements/release-note
// 現在のアプリバージョンを system 投稿 (createdById=null) として
// お知らせに追加し、SystemSetting に記録する。
// 同じバージョンが既に投稿済みなら 409 を返す。
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  }

  const version = pkg.version;
  const existing = await prisma.systemSetting.findUnique({
    where: { key: LAST_ANNOUNCED_KEY },
  });
  if (existing?.value === version) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ALREADY_ANNOUNCED",
          message: `バージョン ${version} は既にお知らせ済みです`,
        },
      },
      { status: 409 },
    );
  }

  const title = `アプリを v${version} にアップデートしました`;
  const body =
    `不具合修正や機能改善を含むアップデートを反映しました。\n` +
    `詳細は「更新履歴」(/release-notes) からご確認ください。`;

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      audienceMember: true,
      audienceVisitor: true,
      audienceGuest: true,
      severity: "info",
      createdById: null, // system 投稿。UI 側で「運営」と表示する。
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: LAST_ANNOUNCED_KEY },
    create: { key: LAST_ANNOUNCED_KEY, value: version },
    update: { value: version },
  });

  return NextResponse.json(
    { success: true, data: { announcement, version } },
    { status: 201 },
  );
}
