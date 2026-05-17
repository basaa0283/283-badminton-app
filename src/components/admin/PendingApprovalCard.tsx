"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export interface PendingMember {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  createdAt?: string | null;
}

interface PendingApprovalCardProps {
  pendingMembers: PendingMember[];
  onChanged: () => void; // 承認/却下後にメンバー一覧を再取得するための callback
}

type AssignableRole = "guest" | "visitor" | "member";

const ROLE_LABEL: Record<AssignableRole, string> = {
  guest: "ゲスト (閲覧専用)",
  visitor: "ビジター (見学・体験)",
  member: "一般メンバー",
};

/**
 * 承認待ちユーザーの一覧と承認/却下 UI。
 * - 承認: PUT /api/members/[id] で role を guest/visitor/member に変更
 * - 却下: DELETE /api/admin/members/[id] でアカウントごと削除
 */
export function PendingApprovalCard({ pendingMembers, onChanged }: PendingApprovalCardProps) {
  if (pendingMembers.length === 0) return null;

  return (
    <Card className="mb-4 border-2 border-amber-300">
      <CardHeader>
        <h2 className="text-sm font-bold text-amber-900">
          承認待ち ({pendingMembers.length})
        </h2>
        <p className="text-xs text-gray-600 mt-1">
          新規登録ユーザーは承認するまで本アプリを利用できません。ロールを付与して承認するか、却下してください。
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingMembers.map((m) => (
            <PendingMemberRow key={m.id} member={m} onChanged={onChanged} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PendingMemberRow({
  member,
  onChanged,
}: {
  member: PendingMember;
  onChanged: () => void;
}) {
  const [role, setRole] = useState<AssignableRole>("guest");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "承認に失敗しました");
        return;
      }
      onChanged();
    } finally {
      setSubmitting(false);
    }
  };

  const reject = async () => {
    if (!confirm(`${member.nickname} さんを却下し、アカウントを削除します。よろしいですか？`)) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "却下に失敗しました");
        return;
      }
      onChanged();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        {member.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.profileImageUrl}
            alt=""
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">
            {member.nickname[0]}
          </div>
        )}
        <span className="font-medium text-gray-900 truncate">{member.nickname}</span>
      </div>
      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-xs">{error}</div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-gray-600">付与するロール:</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as AssignableRole)}
          className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
          disabled={submitting}
        >
          {(Object.keys(ROLE_LABEL) as AssignableRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <Button size="sm" variant="secondary" onClick={reject} disabled={submitting}>
          却下
        </Button>
        <Button size="sm" onClick={approve} loading={submitting}>
          承認
        </Button>
      </div>
    </div>
  );
}
