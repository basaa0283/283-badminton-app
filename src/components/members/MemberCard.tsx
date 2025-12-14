"use client";

import { RoleBadge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";

interface MemberCardProps {
  member: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
    role: string;
    gender?: string | null;
    age?: number | null;
    comment?: string | null;
    lastActiveAt?: string | null;
  };
  onClick?: () => void;
}

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "未操作";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "たった今";
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
  return `${Math.floor(diffDays / 30)}ヶ月前`;
}

export function MemberCard({ member, onClick }: MemberCardProps) {
  return (
    <Card hover={!!onClick} onClick={onClick} className="mb-2">
      <CardContent className="py-3">
        <div className="flex items-center gap-3">
          {member.profileImageUrl ? (
            <img
              src={member.profileImageUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500">{member.nickname[0]}</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 truncate">{member.nickname}</span>
              <RoleBadge role={member.role} />
            </div>
            <div className="text-sm text-gray-500">
              最終操作: {formatRelativeTime(member.lastActiveAt)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
