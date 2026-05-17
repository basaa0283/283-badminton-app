import { describe, it, expect } from "vitest";
import { permissions, getRoleName, isValidRole, type UserRole } from "./permissions";

const ALL_ROLES: UserRole[] = ["admin", "subadmin", "member", "visitor", "guest", "pending"];

describe("permissions", () => {
  describe("canCreateEvent / canEditEvent / canDeleteEvent", () => {
    it.each([
      ["admin", true],
      ["subadmin", true],
      ["member", false],
      ["visitor", false],
      ["guest", false],
      ["pending", false],
    ] as const)("%s → %s", (role, expected) => {
      expect(permissions.canCreateEvent(role)).toBe(expected);
      expect(permissions.canEditEvent(role)).toBe(expected);
      expect(permissions.canDeleteEvent(role)).toBe(expected);
    });
  });

  describe("canViewEvent", () => {
    it.each(ALL_ROLES)("%s は誰でもイベントを閲覧可能", (role) => {
      expect(permissions.canViewEvent(role)).toBe(true);
    });
  });

  describe("canRespondToEvent", () => {
    it.each([
      ["admin", true],
      ["subadmin", true],
      ["member", true],
      ["visitor", true],
      ["guest", false],
      ["pending", false],
    ] as const)("%s → %s", (role, expected) => {
      expect(permissions.canRespondToEvent(role)).toBe(expected);
    });
  });

  describe("canViewAttendeeList / canViewAttendeeDetails", () => {
    it.each([
      ["admin", true],
      ["subadmin", true],
      ["member", true],
      ["visitor", false],
      ["guest", false],
      ["pending", false],
    ] as const)("%s → %s", (role, expected) => {
      expect(permissions.canViewAttendeeList(role)).toBe(expected);
      expect(permissions.canViewAttendeeDetails(role)).toBe(expected);
    });
  });

  describe("canViewMemberList", () => {
    it.each([
      ["admin", true],
      ["subadmin", true],
      ["member", false],
      ["visitor", false],
      ["guest", false],
      ["pending", false],
    ] as const)("%s → %s", (role, expected) => {
      expect(permissions.canViewMemberList(role)).toBe(expected);
    });
  });

  describe("canViewMemberDetails", () => {
    it.each([
      ["admin", true],
      ["subadmin", true],
      ["member", true],
      ["visitor", false],
      ["guest", false],
      ["pending", false],
    ] as const)("%s → %s", (role, expected) => {
      expect(permissions.canViewMemberDetails(role)).toBe(expected);
    });
  });

  describe("canEditMemberRole / canAccessAdmin", () => {
    it.each([
      ["admin", true],
      ["subadmin", true],
      ["member", false],
      ["visitor", false],
      ["guest", false],
      ["pending", false],
    ] as const)("%s → %s", (role, expected) => {
      expect(permissions.canEditMemberRole(role)).toBe(expected);
      expect(permissions.canAccessAdmin(role)).toBe(expected);
    });
  });
});

describe("getRoleName", () => {
  it.each([
    ["admin", "管理者"],
    ["subadmin", "副管理者"],
    ["member", "一般"],
    ["visitor", "ビジター"],
    ["guest", "ゲスト"],
    ["pending", "承認待ち"],
  ] as const)("%s → %s", (role, expected) => {
    expect(getRoleName(role)).toBe(expected);
  });
});

describe("isValidRole", () => {
  it.each(ALL_ROLES)("%s は有効", (role) => {
    expect(isValidRole(role)).toBe(true);
  });

  it.each(["superadmin", "owner", "", "ADMIN", "Admin"])(
    "%j は無効",
    (role) => {
      expect(isValidRole(role)).toBe(false);
    },
  );

  it("type guard として機能する", () => {
    const value: string = "admin";
    if (isValidRole(value)) {
      // ここで value の型は UserRole に絞り込まれる
      expect(permissions.canAccessAdmin(value)).toBe(true);
    }
  });
});
