"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RoleBadge } from "@/components/ui/Badge";
import { permissions, UserRole } from "@/lib/permissions";

interface Member {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  role: string;
  skillLevel?: number | null;
  lastActiveAt?: string | null;
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
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週前`;
  return `${Math.floor(diffDays / 30)}ヶ月前`;
}

export default function AdminMembersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMemberNickname, setNewMemberNickname] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      const role = session.user.role as UserRole;
      if (!permissions.canAccessAdmin(role)) {
        router.push("/");
      }
    }
  }, [session, router]);

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

  const handleMemberClick = (memberId: string) => {
    router.push(`/admin/members/${memberId}`);
  };

  const handleCreateProvisional = async () => {
    if (!newMemberNickname.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: newMemberNickname.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewMemberNickname("");
        setShowCreateForm(false);
        await fetchMembers();
        router.push(`/admin/members/${data.data.id}`);
      } else {
        alert(`作成に失敗しました (${data.error?.code}): ${data.error?.message || "詳細不明"}`);
      }
    } catch (err) {
      alert("作成に失敗しました: " + String(err));
    } finally {
      setCreating(false);
    }
  };

  if (status === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-4">
          <Link href="/admin" className="text-blue-600 text-sm hover:underline">
            ← 管理に戻る
          </Link>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">
            メンバー管理 ({members.length})
          </h1>
          <Button onClick={() => setShowCreateForm(true)} className="text-sm">
            + 仮アカウント作成
          </Button>
        </div>

        {showCreateForm && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <p className="text-sm font-medium text-gray-700 mb-3">仮アカウント作成</p>
              <input
                type="text"
                value={newMemberNickname}
                onChange={(e) => setNewMemberNickname(e.target.value)}
                placeholder="ニックネーム（例：田中さん）"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => !(e.nativeEvent as KeyboardEvent).isComposing && e.key === "Enter" && handleCreateProvisional()}
              />
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1 text-sm" onClick={() => { setShowCreateForm(false); setNewMemberNickname(""); }}>
                  キャンセル
                </Button>
                <Button className="flex-1 text-sm" onClick={handleCreateProvisional} loading={creating} disabled={!newMemberNickname.trim()}>
                  作成
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {members.map((member) => (
            <Card
              key={member.id}
              hover
              onClick={() => handleMemberClick(member.id)}
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
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
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{member.nickname}</span>
                        <RoleBadge role={member.role} />
                        {member.skillLevel && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                            Lv.{member.skillLevel}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatRelativeTime(member.lastActiveAt)}
                      </div>
                    </div>
                  </div>

                  {member.id === session.user.id && (
                    <span className="text-xs text-gray-400">自分</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
