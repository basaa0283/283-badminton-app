import { UserRole } from "@/lib/permissions";

export type Audience = "all" | "admin" | "member";
export type Severity = "info" | "warning" | "important";

/**
 * ユーザーの role に対し、この announcement の audience が一致するか。
 * - "all": 全員
 * - "admin": admin / subadmin のみ
 * - "member": admin / subadmin / member (visitor / guest 除外)
 */
export function isAudienceMatch(role: UserRole, audience: string): boolean {
  if (audience === "all") return true;
  if (audience === "admin") return role === "admin" || role === "subadmin";
  if (audience === "member") return role === "admin" || role === "subadmin" || role === "member";
  return false;
}

export const SEVERITY_STYLE: Record<
  Severity,
  { bg: string; border: string; text: string; label: string }
> = {
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", label: "お知らせ" },
  warning: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
    label: "注意",
  },
  important: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", label: "重要" },
};
