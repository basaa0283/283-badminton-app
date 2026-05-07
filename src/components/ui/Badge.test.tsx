import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, AttendanceStatusBadge, RoleBadge } from "./Badge";

describe("Badge", () => {
  it("子要素を表示する", () => {
    render(<Badge>テキスト</Badge>);
    expect(screen.getByText("テキスト")).toBeInTheDocument();
  });

  it("default variant のクラスが適用される", () => {
    render(<Badge>default</Badge>);
    const el = screen.getByText("default");
    expect(el.className).toContain("bg-gray-100");
  });

  it.each([
    ["success", "bg-green-100"],
    ["warning", "bg-yellow-100"],
    ["danger", "bg-red-100"],
    ["info", "bg-blue-100"],
  ] as const)("variant=%s で %s クラスが適用される", (variant, expectedClass) => {
    render(<Badge variant={variant}>v</Badge>);
    expect(screen.getByText("v").className).toContain(expectedClass);
  });

  it("追加 className が付与される", () => {
    render(<Badge className="extra-class">x</Badge>);
    expect(screen.getByText("x").className).toContain("extra-class");
  });
});

describe("AttendanceStatusBadge", () => {
  it.each([
    ["attending", "参加"],
    ["not_attending", "不参加"],
    ["waitlist", "キャンセル待ち"],
  ])("status=%s なら %s と表示", (status, label) => {
    render(<AttendanceStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("未知のstatusはそのまま表示", () => {
    render(<AttendanceStatusBadge status="unknown_status" />);
    expect(screen.getByText("unknown_status")).toBeInTheDocument();
  });
});

describe("RoleBadge", () => {
  it.each([
    ["admin", "管理者"],
    ["subadmin", "副管理者"],
    ["member", "一般"],
    ["visitor", "ビジター"],
    ["guest", "ゲスト"],
  ])("role=%s なら %s と表示", (role, label) => {
    render(<RoleBadge role={role} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("未知のroleはそのまま表示", () => {
    render(<RoleBadge role="superadmin" />);
    expect(screen.getByText("superadmin")).toBeInTheDocument();
  });
});
