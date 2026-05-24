"use client";

import { useEffect, useState } from "react";
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

interface MergeCandidate {
  id: string;
  nickname: string;
  role: string;
  profileImageUrl: string | null;
}

/**
 * 承認待ちユーザーの一覧と承認/却下/マージ UI。
 * - 承認: PUT /api/members/[id] で role を guest/visitor/member に変更
 * - 却下: DELETE /api/admin/members/[id] でアカウントごと削除
 * - マージ: PUT /api/admin/members/[id]/merge で既存仮アカと統合
 */
export function PendingApprovalCard({ pendingMembers, onChanged }: PendingApprovalCardProps) {
  const [candidates, setCandidates] = useState<MergeCandidate[]>([]);

  useEffect(() => {
    if (pendingMembers.length === 0) return;
    (async () => {
      try {
        const res = await fetch("/api/members");
        const data = await res.json();
        if (data.success) {
          const list: MergeCandidate[] = (data.data as MergeCandidate[])
            .filter((m) => m.role === "visitor" || m.role === "member")
            .filter((m) => !pendingMembers.some((p) => p.id === m.id));
          setCandidates(list);
        }
      } catch {
        // 取得失敗時はマージ機能が使えないだけ
      }
    })();
  }, [pendingMembers]);

  if (pendingMembers.length === 0) return null;

  return (
    <Card className="mb-4 border-2 border-amber-300">
      <CardHeader>
        <h2 className="text-sm font-bold text-amber-900">
          承認待ち ({pendingMembers.length})
        </h2>
        <p className="text-xs text-gray-600 mt-1">
          新規登録ユーザーは承認するまで本アプリを利用できません。ロールを付与して承認するか、却下してください。事前に作成した仮アカウントがある場合はマージできます。
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingMembers.map((m) => (
            <PendingMemberRow
              key={m.id}
              member={m}
              candidates={candidates}
              onChanged={onChanged}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PendingMemberRow({
  member,
  candidates,
  onChanged,
}: {
  member: PendingMember;
  candidates: MergeCandidate[];
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"approve" | "merge">("approve");
  const [role, setRole] = useState<AssignableRole>("guest");
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
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

  const merge = async () => {
    if (!mergeTargetId) {
      setError("マージ対象の仮アカウントを選択してください");
      return;
    }
    const target = candidates.find((c) => c.id === mergeTargetId);
    if (
      !confirm(
        `${member.nickname} さんを既存の仮アカウント「${target?.nickname ?? "?"}」とマージします。\n` +
          `・出欠履歴、プロフィール、ロール (${target?.role ?? "?"}) を引き継ぎます\n` +
          "・仮アカウント側のレコードは削除されます\n" +
          "実行しますか？"
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/merge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provisionalUserId: mergeTargetId }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "マージに失敗しました");
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

      <div className="flex items-center gap-3 text-xs">
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            name={`mode-${member.id}`}
            checked={mode === "approve"}
            onChange={() => setMode("approve")}
            disabled={submitting}
          />
          新規として承認
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            name={`mode-${member.id}`}
            checked={mode === "merge"}
            onChange={() => setMode("merge")}
            disabled={submitting || candidates.length === 0}
          />
          既存仮アカとマージ
          {candidates.length === 0 && (
            <span className="text-gray-400">(候補なし)</span>
          )}
        </label>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-xs">{error}</div>
      )}

      {mode === "approve" ? (
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
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-gray-600">マージ先:</label>
          <select
            value={mergeTargetId}
            onChange={(e) => setMergeTargetId(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white min-w-[10rem]"
            disabled={submitting}
          >
            <option value="">選択してください</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname} ({c.role === "visitor" ? "ビジター" : "メンバー"})
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <Button size="sm" variant="secondary" onClick={reject} disabled={submitting}>
            却下
          </Button>
          <Button size="sm" onClick={merge} loading={submitting} disabled={!mergeTargetId}>
            マージ
          </Button>
        </div>
      )}
    </div>
  );
}
