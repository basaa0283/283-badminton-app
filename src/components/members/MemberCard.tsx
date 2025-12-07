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
  };
  showDetails?: boolean;
  onClick?: () => void;
}

export function MemberCard({ member, showDetails = false, onClick }: MemberCardProps) {
  return (
    <Card hover={!!onClick} onClick={onClick} className="mb-2">
      <CardContent className="py-3">
        <div className="flex items-center gap-3">
          {member.profileImageUrl ? (
            <img
              src={member.profileImageUrl}
              alt=""
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500 text-lg">{member.nickname[0]}</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 truncate">{member.nickname}</span>
              <RoleBadge role={member.role} />
            </div>

            {showDetails && (
              <div className="text-sm text-gray-500 mt-1">
                {member.gender && (
                  <span className="mr-3">
                    {member.gender === "male" ? "男性" : "女性"}
                  </span>
                )}
                {member.age !== null && member.age !== undefined && (
                  <span className="mr-3">{member.age}歳</span>
                )}
              </div>
            )}

            {showDetails && member.comment && (
              <p className="text-sm text-gray-500 truncate mt-1">{member.comment}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
