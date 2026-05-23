/**
 * 利用規約・プライバシーポリシーのバージョン管理。
 *
 * ベータ運用中はハードコードで十分。規約・PP の文面を更新したら
 * この定数も上げる → 全ユーザーが次回アクセス時に再同意画面を見る。
 *
 * 将来的に頻繁に変えるようになったら SystemSetting に移行する。
 */
export const CURRENT_TERMS_VERSION = "2026-05-23.1";

/**
 * ユーザーが現行バージョンに同意済みかどうか。
 *
 * - 未同意 (null) → 同意必要
 * - 古いバージョンに同意済 → 再同意必要
 */
export function hasAcceptedCurrentTerms(
  acceptedVersion: string | null | undefined
): boolean {
  return acceptedVersion === CURRENT_TERMS_VERSION;
}
