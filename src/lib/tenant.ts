import { prisma } from "./prisma";

// マルチテナント P1: 移行期間中のデフォルトテナント解決。
// URL からの slug 解決 (P2) までは、全データを 283bad テナントとして扱う。
// 設計: docs/superpowers/specs/2026-09-04-multi-tenant-business-design.md

export const DEFAULT_TENANT_SLUG = "283bad";
const DEFAULT_TENANT_NAME = "２８ばど";

// プロセス内キャッシュ。テナント ID は不変なので TTL 無しで持つ。
let cachedDefaultTenantId: string | null = null;

// デフォルトテナント (283bad) の ID を返す。
// 存在しない環境 (新規ローカル DB / e2e など) では自動作成する (冪等)。
export async function getDefaultTenantId(): Promise<string> {
  if (cachedDefaultTenantId) return cachedDefaultTenantId;
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEFAULT_TENANT_SLUG },
    update: {},
    create: {
      slug: DEFAULT_TENANT_SLUG,
      name: DEFAULT_TENANT_NAME,
      status: "active",
      plan: "complimentary",
    },
  });
  cachedDefaultTenantId = tenant.id;
  return tenant.id;
}

// テスト用: キャッシュをリセットする
export function _resetTenantCacheForTest(): void {
  cachedDefaultTenantId = null;
}
