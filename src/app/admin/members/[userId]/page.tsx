"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { RoleBadge } from "@/components/ui/Badge";
import { permissions, UserRole, getRoleName } from "@/lib/permissions";

interface MemberDetail {
  id: string;
  nickname: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  gender: string | null;
  age: number | null;
  ageVisible: boolean;
  comment: string | null;
  lastActiveAt: string | null;
  skillLevel: string | null;
  adminNote: string | null;
  createdAt: string;
  attendanceCount: number;
  pastAttendanceCount: number;
}

const ROLES: UserRole[] = ["admin", "subadmin", "member", "visitor", "guest"];
const SKILL_LEVELS = [
  { value: "", label: "未設定" },
  { value: "beginner", label: "初心者" },
  { value: "intermediate", label: "中級者" },
  { value: "advanced", label: "上級者" },
  { value: "expert", label: "エキスパート" },
];
const GENDERS = [
  { value: "", label: "未設定" },
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
];

function getSkillLevelName(level: string | null): string {
  const item = SKILL_LEVELS.find((l) => l.value === level);
  return item?.label || "未設定";
}

function formatRelativeTime(dateString: string | null): string {
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

export default function MemberDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 編集用フォームの状態
  const [formData, setFormData] = useState({
    nickname: "",
    firstName: "",
    lastName: "",
    gender: "",
    age: "",
    ageVisible: true,
    comment: "",
    role: "" as UserRole | "",
    skillLevel: "",
    adminNote: "",
  });

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
    if (status === "authenticated" && userId) {
      fetchMember();
    }
  }, [status, userId]);

  const fetchMember = async () => {
    try {
      const res = await fetch(`/api/members/${userId}`);
      const data = await res.json();
      if (data.success) {
        setMember(data.data);
        setFormData({
          nickname: data.data.nickname || "",
          firstName: data.data.firstName || "",
          lastName: data.data.lastName || "",
          gender: data.data.gender || "",
          age: data.data.age?.toString() || "",
          ageVisible: data.data.ageVisible ?? true,
          comment: data.data.comment || "",
          role: data.data.role || "",
          skillLevel: data.data.skillLevel || "",
          adminNote: data.data.adminNote || "",
        });
      } else {
        alert("メンバーが見つかりません");
        router.push("/admin/members");
      }
    } catch (error) {
      console.error("Failed to fetch member:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: formData.nickname,
          firstName: formData.firstName || null,
          lastName: formData.lastName || null,
          gender: formData.gender || null,
          age: formData.age ? parseInt(formData.age) : null,
          ageVisible: formData.ageVisible,
          comment: formData.comment || null,
          role: formData.role || undefined,
          skillLevel: formData.skillLevel || null,
          adminNote: formData.adminNote || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await fetchMember();
        setEditing(false);
      } else {
        alert(data.error?.message || "更新に失敗しました");
      }
    } catch (error) {
      console.error("Failed to update member:", error);
      alert("更新に失敗しました");
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

  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">メンバーが見つかりません</div>
      </div>
    );
  }

  const currentRole = session.user.role as UserRole;
  const isAdmin = currentRole === "admin";
  const isSelf = member.id === session.user.id;

  // 自分より上の権限には変更できない
  const availableRoles = ROLES.filter((role) => {
    if (role === "admin" && !isAdmin) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-4">
          <Link href="/admin/members" className="text-blue-600 text-sm hover:underline">
            ← メンバー管理に戻る
          </Link>
        </div>

        <Card>
          <CardContent className="py-6">
            {/* ヘッダー部分 */}
            <div className="flex items-center gap-4 mb-6">
              {member.profileImageUrl ? (
                <img
                  src={member.profileImageUrl}
                  alt=""
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-2xl text-gray-500">{member.nickname[0]}</span>
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{member.nickname}</h1>
                  <RoleBadge role={member.role} />
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  最終操作: {formatRelativeTime(member.lastActiveAt)}
                </div>
              </div>
            </div>

            {/* 統計情報 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{member.pastAttendanceCount}</div>
                <div className="text-sm text-blue-600">過去の参加回数</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{member.attendanceCount}</div>
                <div className="text-sm text-green-600">参加予定</div>
              </div>
            </div>

            {editing ? (
              /* 編集フォーム */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ニックネーム
                  </label>
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">姓</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">名</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {GENDERS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">年齢</label>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ageVisible"
                    checked={formData.ageVisible}
                    onChange={(e) => setFormData({ ...formData, ageVisible: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="ageVisible" className="text-sm text-gray-700">
                    年齢を公開する
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">コメント</label>
                  <textarea
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {!isSelf && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">権限</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {availableRoles.map((role) => (
                        <option key={role} value={role}>
                          {getRoleName(role)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <hr className="my-4" />
                <div className="text-sm font-medium text-gray-500 mb-2">管理者専用情報</div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    スキルレベル
                  </label>
                  <select
                    value={formData.skillLevel}
                    onChange={(e) => setFormData({ ...formData, skillLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {SKILL_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    管理者メモ（他のメンバーには見えません）
                  </label>
                  <textarea
                    value={formData.adminNote}
                    onChange={(e) => setFormData({ ...formData, adminNote: e.target.value })}
                    rows={3}
                    placeholder="メンバーに関するメモ..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                  >
                    キャンセル
                  </Button>
                  <Button className="flex-1" onClick={handleSave} loading={saving}>
                    保存
                  </Button>
                </div>
              </div>
            ) : (
              /* 詳細表示 */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">姓名</div>
                    <div className="font-medium">
                      {member.lastName || member.firstName
                        ? `${member.lastName || ""} ${member.firstName || ""}`
                        : "未設定"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">性別</div>
                    <div className="font-medium">
                      {member.gender === "male" ? "男性" : member.gender === "female" ? "女性" : "未設定"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">年齢</div>
                    <div className="font-medium">
                      {member.age !== null ? `${member.age}歳` : "未設定"}
                      {member.age !== null && !member.ageVisible && (
                        <span className="text-xs text-gray-400 ml-1">(非公開)</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">権限</div>
                    <div className="font-medium">{getRoleName(member.role as UserRole)}</div>
                  </div>
                </div>

                {member.comment && (
                  <div>
                    <div className="text-sm text-gray-500">コメント</div>
                    <div className="font-medium">{member.comment}</div>
                  </div>
                )}

                <hr className="my-4" />
                <div className="text-sm font-medium text-gray-500 mb-2">管理者専用情報</div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">スキルレベル</div>
                    <div className="font-medium">{getSkillLevelName(member.skillLevel)}</div>
                  </div>
                </div>

                {member.adminNote && (
                  <div>
                    <div className="text-sm text-gray-500">管理者メモ</div>
                    <div className="font-medium text-gray-700 bg-yellow-50 p-2 rounded">
                      {member.adminNote}
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <Button onClick={() => setEditing(true)} className="w-full">
                    編集
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
