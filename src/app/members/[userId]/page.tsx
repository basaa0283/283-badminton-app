"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { RoleBadge } from "@/components/ui/Badge";
import { TournamentResultsSection } from "@/components/tournaments/TournamentResultsSection";
import { permissions, UserRole } from "@/lib/permissions";

interface MemberDetail {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  role: string;
  gender: string | null;
  birthdate: string | null;
  age: number | null;
  ageVisible: boolean;
  comment: string | null;
  attendanceCount: number;
  pastAttendanceCount: number;
}

const GENDER_LABEL: Record<string, string> = {
  male: "♂ 男",
  female: "♀ 女",
};
const GENDER_CLASS: Record<string, string> = {
  male: "bg-blue-100 text-blue-800",
  female: "bg-pink-100 text-pink-800",
};

// member 以上が閲覧できる、他メンバーのプロフィール詳細ページ (閲覧専用)。
// 自分の場合は /profile に飛ばす。
// admin がここに来た場合も、編集動線として /admin/members/[id] へのリンクを出す。
export default function MemberViewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    const role = session.user.role as UserRole;
    if (!permissions.canViewMemberDetails(role)) {
      router.push("/");
      return;
    }
    // 自分自身なら /profile に集約
    if (session.user.id === userId) {
      router.push("/profile");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/members/${userId}`);
        const json = await res.json();
        if (json.success) {
          setMember(json.data);
        } else {
          router.push("/");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [session, router, userId]);

  if (status === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }
  if (!member) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="text-gray-500 text-sm">メンバーが見つかりません</div>
        </main>
      </div>
    );
  }

  const role = session.user.role as UserRole;
  const isAdmin = permissions.canAccessAdmin(role);

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {member.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.profileImageUrl}
                  alt=""
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl text-gray-500">
                  {member.nickname[0]}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 truncate">{member.nickname}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <RoleBadge role={member.role} />
                  {member.gender && GENDER_LABEL[member.gender] && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${GENDER_CLASS[member.gender] ?? ""}`}
                    >
                      {GENDER_LABEL[member.gender]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="text-sm space-y-1">
              {member.ageVisible && member.age !== null && (
                <div>
                  <dt className="text-gray-500 inline mr-2">年齢:</dt>
                  <dd className="inline">{member.age}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500 inline mr-2">過去参加回数:</dt>
                <dd className="inline">{member.pastAttendanceCount} 回</dd>
              </div>
              {member.comment && (
                <div className="mt-2">
                  <dt className="text-gray-500 mb-1">ひとこと:</dt>
                  <dd className="whitespace-pre-wrap text-gray-800">{member.comment}</dd>
                </div>
              )}
            </dl>
            {isAdmin && (
              <div className="mt-3">
                <Link
                  href={`/admin/members/${userId}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  管理画面でこのメンバーを編集 →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {permissions.canViewTournaments(role) && (
          <TournamentResultsSection userId={userId} />
        )}
      </main>
    </div>
  );
}
