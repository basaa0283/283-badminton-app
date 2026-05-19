export type UserRole =
  | "admin"
  | "subadmin"
  | "member"
  | "visitor"
  | "guest"
  | "pending"; // 新規ログイン直後、管理者の承認待ち

const ROLE_HIERARCHY: Record<UserRole, number> = {
  pending: -1, // 承認前は guest 未満。実質何もできない (onboarding 画面のみ)
  guest: 0,
  visitor: 1,
  member: 2,
  subadmin: 3,
  admin: 4,
};

export const permissions = {
  // イベント権限
  canCreateEvent: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.subadmin,
  canEditEvent: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.subadmin,
  canDeleteEvent: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.subadmin,
  canViewEvent: (_role: UserRole) => true,
  // 出欠回答は visitor 以上のみ。ゲストは閲覧専用。
  canRespondToEvent: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.visitor,

  // 参加者リスト権限
  canViewAttendeeList: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.member,
  canViewAttendeeDetails: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.member,

  // メンバー権限。一般のメンバー間でも他人の情報は見せない方針。閲覧は subadmin 以上。
  // (canAccessAdmin と同じだが、概念分離のため別関数として残す)
  canViewMemberList: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.subadmin,
  canViewMemberDetails: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.member,
  canEditMemberRole: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.subadmin,

  // 管理画面権限
  canAccessAdmin: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.subadmin,

  // 大会実績権限。閲覧・登録ともに member 以上 (ビジター・ゲストには見せない)。
  canViewTournaments: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.member,
  canManageTournaments: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.member,
  // 大会マスターの承認 (実在性チェック)。
  // 現状は同サークル admin が担うが、将来「サービス管理者」ロールに切り替える
  // 想定なので、canAccessAdmin とは独立した関数にしておく。
  canApproveTournaments: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin,
};

/**
 * イベントの閾値 (minViewRole / minRespondRole) と現在のロールを比較し、
 * 閲覧・回答できるかを判定するユーティリティ。
 *
 * - admin / subadmin は閾値に関わらず常に true。
 * - 回答時は別途 canRespondToEvent (guest を弾く) と組み合わせて使う。
 */
export function meetsRoleThreshold(role: UserRole, threshold: string): boolean {
  // 管理者は常に通す
  if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.subadmin) return true;
  const target = ROLE_HIERARCHY[threshold as UserRole];
  if (typeof target !== "number") return true; // 不明な閾値はオープン扱い
  return ROLE_HIERARCHY[role] >= target;
}

export function getRoleName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    admin: "管理者",
    subadmin: "副管理者",
    member: "一般",
    visitor: "ビジター",
    guest: "ゲスト",
    pending: "承認待ち",
  };
  return names[role] || role;
}

export function isValidRole(role: string): role is UserRole {
  return ["admin", "subadmin", "member", "visitor", "guest", "pending"].includes(role);
}
