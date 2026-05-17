import { UserRole } from "@/lib/permissions";

export type Severity = "info" | "important";

/**
 * admin / subadmin は常に全件閲覧可能。
 * non-admin role は audience フラグで個別に on/off。
 */
export function isVisibleTo(
  role: UserRole,
  a: { audienceMember: boolean; audienceVisitor: boolean; audienceGuest: boolean }
): boolean {
  if (role === "admin" || role === "subadmin") return true;
  if (role === "member") return a.audienceMember;
  if (role === "visitor") return a.audienceVisitor;
  if (role === "guest") return a.audienceGuest;
  return false;
}

export const SEVERITY_STYLE: Record<
  Severity,
  { bg: string; border: string; text: string; label: string }
> = {
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", label: "通常" },
  important: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", label: "重要" },
};

// 旧データに "warning" が残っていても落ちないように info にフォールバック。
export function normalizeSeverity(s: string): Severity {
  return s === "important" ? "important" : "info";
}

// ホームバナーで表示する最大日数 (これより古いお知らせは /announcements にのみ残る)
export const BANNER_MAX_DAYS = 30;
