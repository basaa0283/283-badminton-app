interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  const variants = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// 出欠ステータス用バッジ
export function AttendanceStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    attending: { variant: "success", label: "参加" },
    not_attending: { variant: "danger", label: "不参加" },
    waitlist: { variant: "warning", label: "キャンセル待ち" },
  };

  const { variant, label } = config[status] || { variant: "default", label: status };

  return <Badge variant={variant}>{label}</Badge>;
}

// 権限用バッジ
export function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    admin: { variant: "danger", label: "管理者" },
    subadmin: { variant: "warning", label: "副管理者" },
    member: { variant: "success", label: "一般" },
    visitor: { variant: "info", label: "ビジター" },
    guest: { variant: "default", label: "ゲスト" },
  };

  const { variant, label } = config[role] || { variant: "default", label: role };

  return <Badge variant={variant}>{label}</Badge>;
}
