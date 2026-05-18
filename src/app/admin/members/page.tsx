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
import { formatSkillLevel } from "@/lib/skill-level";
import { PendingApprovalCard } from "@/components/admin/PendingApprovalCard";

interface Member {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  role: string;
  gender: string | null;
  age: number | null;
  skillLevel?: number | null;
  lastActiveAt?: string | null;
  createdAt?: string | null;
}

type SortKey = "nickname" | "role" | "gender" | "age" | "skillLevel" | "lastActiveAt";
type SortDir = "asc" | "desc";

const ROLE_ORDER: Record<string, number> = {
  pending: -1,
  admin: 0,
  subadmin: 1,
  member: 2,
  visitor: 3,
  guest: 4,
};

function compareMembers(a: Member, b: Member, key: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  const nullLast = (v: unknown) => (v === null || v === undefined ? Infinity : 0);
  switch (key) {
    case "nickname":
      return sign * a.nickname.localeCompare(b.nickname, "ja");
    case "role":
      return sign * ((ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));
    case "gender": {
      const av = a.gender ?? "";
      const bv = b.gender ?? "";
      return sign * av.localeCompare(bv);
    }
    case "age": {
      const an = nullLast(a.age) || (a.age ?? 0);
      const bn = nullLast(b.age) || (b.age ?? 0);
      return sign * (an - bn);
    }
    case "skillLevel": {
      const an = nullLast(a.skillLevel) || (a.skillLevel ?? 0);
      const bn = nullLast(b.skillLevel) || (b.skillLevel ?? 0);
      return sign * (an - bn);
    }
    case "lastActiveAt": {
      const av = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
      const bv = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
      return sign * (av - bv);
    }
  }
}

function SortHeader({
  sortKey,
  current,
  dir,
  onClick,
  numeric,
  children,
}: {
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: () => void;
  numeric?: boolean;
  children: React.ReactNode;
}) {
  const active = sortKey === current;
  const arrow = !active ? "" : dir === "asc" ? " ↑" : " ↓";
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider select-none cursor-pointer hover:bg-gray-100 ${numeric ? "text-right" : "text-left"} ${active ? "text-blue-700" : "text-gray-600"}`}
    >
      {children}
      <span>{arrow}</span>
    </th>
  );
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

  // フィルタ・ソート状態
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lastActiveAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "lastActiveAt" ? "desc" : "asc");
    }
  };

  const visibleMembers = members
    .filter((m) => filterRole === "all" || m.role === filterRole)
    .filter((m) => filterGender === "all" || (m.gender ?? "") === filterGender)
    .filter((m) => !search.trim() || m.nickname.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => compareMembers(a, b, sortKey, sortDir));

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

        <PendingApprovalCard
          pendingMembers={members.filter((m) => m.role === "pending")}
          onChanged={fetchMembers}
        />

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

        <div className="bg-white rounded-lg shadow p-3 mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ニックネームで検索"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="all">権限: すべて</option>
            <option value="pending">承認待ち</option>
            <option value="admin">管理者</option>
            <option value="subadmin">副管理者</option>
            <option value="member">一般</option>
            <option value="visitor">ビジター</option>
            <option value="guest">ゲスト</option>
          </select>
          <select
            value={filterGender}
            onChange={(e) => setFilterGender(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="all">性別: すべて</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="">未設定</option>
          </select>
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <SortHeader sortKey="nickname" current={sortKey} dir={sortDir} onClick={() => toggleSort("nickname")}>
                  ニックネーム
                </SortHeader>
                <SortHeader sortKey="role" current={sortKey} dir={sortDir} onClick={() => toggleSort("role")}>
                  権限
                </SortHeader>
                <SortHeader sortKey="gender" current={sortKey} dir={sortDir} onClick={() => toggleSort("gender")}>
                  性別
                </SortHeader>
                <SortHeader sortKey="age" current={sortKey} dir={sortDir} onClick={() => toggleSort("age")} numeric>
                  年齢
                </SortHeader>
                <SortHeader sortKey="skillLevel" current={sortKey} dir={sortDir} onClick={() => toggleSort("skillLevel")} numeric>
                  Lv
                </SortHeader>
                <SortHeader sortKey="lastActiveAt" current={sortKey} dir={sortDir} onClick={() => toggleSort("lastActiveAt")}>
                  最終操作
                </SortHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-500">該当するメンバーがいません</td>
                </tr>
              ) : (
                visibleMembers.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => handleMemberClick(member.id)}
                    className="hover:bg-blue-50 cursor-pointer"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {member.profileImageUrl ? (
                          <img src={member.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs shrink-0">
                            {member.nickname[0]}
                          </div>
                        )}
                        <span className="font-medium text-gray-900 truncate">{member.nickname}</span>
                        {member.id === session.user.id && (
                          <span className="text-[10px] text-gray-400 shrink-0">(自分)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2"><RoleBadge role={member.role} /></td>
                    <td className="px-3 py-2">
                      {member.gender === "male" ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                          ♂ 男
                        </span>
                      ) : member.gender === "female" ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-medium">
                          ♀ 女
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {member.age !== null ? `${member.age}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700" title={member.skillLevel !== null && member.skillLevel !== undefined ? formatSkillLevel(member.skillLevel) : ""}>
                      {member.skillLevel !== null && member.skillLevel !== undefined ? member.skillLevel : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                      {formatRelativeTime(member.lastActiveAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">表示: {visibleMembers.length} / 全 {members.length}</p>
      </main>
    </div>
  );
}
