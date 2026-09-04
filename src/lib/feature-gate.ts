import { prisma } from "./prisma";
import { getCurrentTenantId } from "./tenant";

// マルチテナントの feature gate (P1 骨格)。
// 設計: docs/superpowers/specs/2026-09-04-multi-tenant-business-design.md
//
// プランは 2 段階のみ (無料 / 有料)。機能単位の細かい gate は作らない。
// 有料機能: お知らせ / LINE 通知 / メール通知配信 / メンバータグ /
//           非公開・タグ限定公開 / 会計管理
// ※ P1 時点では既存 API にはまだ組み込まない (28ばど は complimentary なので
//   全機能が通る)。P2.5 (Stripe 統合) で各 API に組み込む。

// プラン + テナント状態から有料機能の可否を判定する純粋関数。
export function planHasPaidFeatures(plan: string, status: string): boolean {
  // frozen (未払い・解約) / pending (承認待ち) のテナントは有料機能不可
  if (status !== "active") return false;
  // paid = Stripe 課金中 / complimentary = 管理者による全機能無料解放 (パイロット用)
  return plan === "paid" || plan === "complimentary";
}

// 現在のリクエストのテナントで有料機能が使えるか。
export async function currentTenantHasPaidFeatures(): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, status: true },
  });
  if (!tenant) return false;
  return planHasPaidFeatures(tenant.plan, tenant.status);
}
