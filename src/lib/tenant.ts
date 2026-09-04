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

// 現在のリクエストが属するテナント ID。
// P2 (URL サブパス化) までは常にデフォルトテナント (283bad) を返す。
// P2 で middleware の slug 解決に差し替える。呼び出し側はこの関数だけ使うこと。
export async function getCurrentTenantId(): Promise<string> {
  return getDefaultTenantId();
}

// 読み取りクエリ用の tenant フィルタ断片。where に AND で合成して使う。
// 移行期間中 (PROD の backfill 完了前) は tenantId=NULL の旧レコードも
// デフォルトテナントの持ち物として扱う。backfill 完了後に NULL 許容を外す。
export async function tenantWhere(): Promise<{
  OR: [{ tenantId: string }, { tenantId: null }];
}> {
  const tenantId = await getCurrentTenantId();
  return { OR: [{ tenantId }, { tenantId: null }] };
}

// テスト用: キャッシュをリセットする
export function _resetTenantCacheForTest(): void {
  cachedDefaultTenantId = null;
}
