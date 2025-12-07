export type UserRole = "admin" | "subadmin" | "member" | "visitor" | "guest";

const ROLE_HIERARCHY: Record<UserRole, number> = {
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
  canRespondToEvent: (_role: UserRole) => true,

  // 参加者リスト権限
  canViewAttendeeList: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.member,
  canViewAttendeeDetails: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.member,

  // メンバー権限
  canViewMemberList: (_role: UserRole) => true,
  canViewMemberDetails: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.member,
  canEditMemberRole: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.subadmin,

  // 管理画面権限
  canAccessAdmin: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.subadmin,
};

export function getRoleName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    admin: "管理者",
    subadmin: "副管理者",
    member: "一般",
    visitor: "ビジター",
    guest: "ゲスト",
  };
  return names[role] || role;
}

export function isValidRole(role: string): role is UserRole {
  return ["admin", "subadmin", "member", "visitor", "guest"].includes(role);
}
