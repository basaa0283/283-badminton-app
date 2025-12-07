"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { RoleBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { permissions, UserRole, getRoleName } from "@/lib/permissions";

interface Member {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  role: string;
}

const ROLES: UserRole[] = ["admin", "subadmin", "member", "visitor", "guest"];

export default function AdminMembersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [newRole, setNewRole] = useState<UserRole>("guest");
  const [saving, setSaving] = useState(false);

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

  const openRoleModal = (member: Member) => {
    setSelectedMember(member);
    setNewRole(member.role as UserRole);
  };

  const handleRoleChange = async () => {
    if (!selectedMember) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/members/${selectedMember.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();

      if (data.success) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === selectedMember.id ? { ...m, role: newRole } : m
          )
        );
        setSelectedMember(null);
      } else {
        alert(data.error?.message || "権限の変更に失敗しました");
      }
    } catch (error) {
      console.error("Failed to update role:", error);
      alert("権限の変更に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  const currentRole = session.user.role as UserRole;
  const isAdmin = currentRole === "admin";

  // 自分より上の権限には変更できない
  const availableRoles = ROLES.filter((role) => {
    if (role === "admin" && !isAdmin) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-4">
          <Link href="/admin" className="text-blue-600 text-sm hover:underline">
            ← 管理に戻る
          </Link>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-4">メンバー管理</h1>

        <div className="space-y-2">
          {members.map((member) => (
            <Card key={member.id}>
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
                      <div className="font-medium text-gray-900">{member.nickname}</div>
                      <RoleBadge role={member.role} />
                    </div>
                  </div>

                  {member.id !== session.user.id && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openRoleModal(member)}
                    >
                      権限変更
                    </Button>
                  )}

                  {member.id === session.user.id && (
                    <span className="text-xs text-gray-400">自分</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <Modal
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        title="権限変更"
      >
        {selectedMember && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {selectedMember.profileImageUrl ? (
                <img
                  src={selectedMember.profileImageUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500">{selectedMember.nickname[0]}</span>
                </div>
              )}
              <div>
                <div className="font-medium">{selectedMember.nickname}</div>
                <div className="text-sm text-gray-500">
                  現在: {getRoleName(selectedMember.role as UserRole)}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                新しい権限
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {getRoleName(role)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setSelectedMember(null)}
                disabled={saving}
              >
                キャンセル
              </Button>
              <Button
                className="flex-1"
                onClick={handleRoleChange}
                loading={saving}
                disabled={newRole === selectedMember.role}
              >
                変更する
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
