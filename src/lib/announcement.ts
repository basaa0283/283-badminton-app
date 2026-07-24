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

/**
 * イベント紐付き Announcement (attendanceTargetType 指定あり) の表示可否判定。
 * eventId が null の Announcement には常に true を返す (= 通常の audience 判定に任せる)。
 *
 * 判定ルール:
 *   - admin / subadmin       => 常に true
 *   - "attending"            => 自分の attendance status が "attending"
 *   - "attending_or_undecided" => "attending" または Attendance レコードなし
 *   - "all"                  => 常に true (audience 判定を通ればよい)
 *   - null (通常お知らせ)     => 常に true
 */
export function isEventAnnouncementVisibleTo(
  role: UserRole,
  a: { eventId: string | null; attendanceTargetType: string | null },
  attendanceStatus: string | null
): boolean {
  if (!a.eventId || !a.attendanceTargetType) return true;
  if (role === "admin" || role === "subadmin") return true;
  if (a.attendanceTargetType === "all") return true;
  if (a.attendanceTargetType === "attending") return attendanceStatus === "attending";
  if (a.attendanceTargetType === "attending_or_undecided") {
    return attendanceStatus === "attending" || attendanceStatus === null;
  }
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
