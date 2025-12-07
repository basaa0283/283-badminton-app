"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { MemberCard } from "@/components/members/MemberCard";
import { permissions, UserRole } from "@/lib/permissions";

interface Member {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  role: string;
  gender?: string | null;
  age?: number | null;
  comment?: string | null;
}

export default function MembersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchMembers();
    }
  }, [status]);

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/members");
      const data = await res.json();
      if (data.success) {
        setMembers(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  const role = session.user.role as UserRole;
  const canViewDetails = permissions.canViewMemberDetails(role);

  // 権限別にグループ化
  const groupedMembers = {
    admin: members.filter((m) => m.role === "admin"),
    subadmin: members.filter((m) => m.role === "subadmin"),
    member: members.filter((m) => m.role === "member"),
    visitor: members.filter((m) => m.role === "visitor"),
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">メンバー</h1>

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-gray-500">メンバーがいません</div>
        ) : (
          <div className="space-y-6">
            {groupedMembers.admin.length > 0 && (
              <MemberSection
                title="管理者"
                members={groupedMembers.admin}
                showDetails={canViewDetails}
              />
            )}
            {groupedMembers.subadmin.length > 0 && (
              <MemberSection
                title="副管理者"
                members={groupedMembers.subadmin}
                showDetails={canViewDetails}
              />
            )}
            {groupedMembers.member.length > 0 && (
              <MemberSection
                title="一般メンバー"
                members={groupedMembers.member}
                showDetails={canViewDetails}
              />
            )}
            {groupedMembers.visitor.length > 0 && (
              <MemberSection
                title="ビジター"
                members={groupedMembers.visitor}
                showDetails={canViewDetails}
              />
            )}
          </div>
        )}

        {!canViewDetails && (
          <p className="text-sm text-gray-500 text-center mt-6">
            詳細情報は一般メンバー以上のみ閲覧できます
          </p>
        )}
      </main>
    </div>
  );
}

function MemberSection({
  title,
  members,
  showDetails,
}: {
  title: string;
  members: Member[];
  showDetails: boolean;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium text-gray-500 mb-2">
        {title} ({members.length})
      </h2>
      {members.map((member) => (
        <MemberCard key={member.id} member={member} showDetails={showDetails} />
      ))}
    </div>
  );
}
