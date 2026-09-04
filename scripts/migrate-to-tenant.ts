import { PrismaClient } from "@prisma/client";

// マルチテナント P0 の初期移行スクリプト (Issue #42):
// 1. Tenant "283bad" を upsert する (plan=complimentary, status=active)
// 2. 全 User のプロフィール項目を Membership (userId × 283bad) にコピーする
//
// idempotent: 何度実行しても安全。
// - Tenant は upsert (既存なら更新しない)
// - Membership は「存在しないユーザー分だけ」作成する (既存レコードは上書きしない。
//   P1 以降で Membership 側が正になるため、再実行で User 側の古い値に巻き戻さない)
//
// 実行方法: npx tsx scripts/migrate-to-tenant.ts
// 対象 DB は DATABASE_URL (.env) の向き先で決まる。DEV/PROD へ実行する場合は
// 接続文字列の向き先を必ず確認すること。
const prisma = new PrismaClient();

const TENANT_SLUG = "283bad";
const TENANT_NAME = "２８ばど";

async function main() {
  // 1. Tenant 283bad を用意
  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: {}, // 既存なら何もしない
    create: {
      slug: TENANT_SLUG,
      name: TENANT_NAME,
      status: "active",
      // 自サークルは課金対象外 (全機能解放)
      plan: "complimentary",
    },
  });
  console.log(`Tenant: ${tenant.slug} (${tenant.id}) plan=${tenant.plan}`);

  // 2. Membership の無いユーザー分だけコピー作成
  const users = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      nickname: true,
      gender: true,
      birthdate: true,
      ageVisible: true,
      profileImageUrl: true,
      comment: true,
      skillLevel: true,
      adminNote: true,
      priorityScore: true,
      tournamentResultsPublic: true,
      lastActiveAt: true,
      memberships: {
        where: { tenantId: tenant.id },
        select: { tenantId: true },
      },
    },
  });

  let created = 0;
  let skipped = 0;
  for (const u of users) {
    if (u.memberships.length > 0) {
      skipped++;
      continue;
    }
    await prisma.membership.create({
      data: {
        userId: u.id,
        tenantId: tenant.id,
        role: u.role,
        nickname: u.nickname,
        gender: u.gender,
        birthdate: u.birthdate,
        ageVisible: u.ageVisible,
        profileImageUrl: u.profileImageUrl,
        comment: u.comment,
        skillLevel: u.skillLevel,
        adminNote: u.adminNote,
        priorityScore: u.priorityScore,
        tournamentResultsPublic: u.tournamentResultsPublic,
        lastActiveAt: u.lastActiveAt,
      },
    });
    created++;
  }

  const total = await prisma.membership.count({ where: { tenantId: tenant.id } });
  console.log(
    `Membership: created=${created}, skipped(既存)=${skipped}, total=${total} / users=${users.length}`,
  );
  if (total !== users.length) {
    console.warn("⚠ Membership 件数と User 件数が一致しません。確認してください。");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
