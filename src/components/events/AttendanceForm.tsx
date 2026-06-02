"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AttendanceStatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";

interface AttendanceFormProps {
  eventId: string;
  currentAttendance?: {
    status: string;
    comment: string | null;
    position: number | null;
    declaredTournamentClassId?: string | null;
  } | null;
  isDeadlinePassed: boolean;
  // 大会連動イベントの場合、紐付き大会の TournamentClass 一覧。空 or 未指定なら
  // 申告クラスの UI は表示しない。
  tournamentClasses?: {
    id: string;
    category: string;
    name: string | null;
  }[];
  onSubmit: (
    status: "attending" | "not_attending",
    comment: string,
    declaredTournamentClassId: string | null,
  ) => Promise<void>;
}

export function AttendanceForm({
  currentAttendance,
  isDeadlinePassed,
  tournamentClasses,
  onSubmit,
}: AttendanceFormProps) {
  const initialStatus =
    currentAttendance?.status === "attending" || currentAttendance?.status === "not_attending"
      ? currentAttendance.status
      : null;
  const [status, setStatus] = useState<"attending" | "not_attending" | null>(initialStatus);
  const [comment, setComment] = useState(currentAttendance?.comment || "");
  const [declaredClassId, setDeclaredClassId] = useState<string>(
    currentAttendance?.declaredTournamentClassId ?? "",
  );
  const [loading, setLoading] = useState(false);

  const hasClasses = (tournamentClasses?.length ?? 0) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!status) return;
    setLoading(true);
    try {
      // 不参加なら申告クラスは null に
      const sendClass = status === "attending" && hasClasses && declaredClassId
        ? declaredClassId
        : null;
      await onSubmit(status, comment, sendClass);
    } finally {
      setLoading(false);
    }
  };

  if (isDeadlinePassed) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-gray-600 text-center">締め切りを過ぎたため、出欠の変更はできません</p>
        {currentAttendance && (
          <div className="mt-2 text-center">
            <span className="text-sm text-gray-500 mr-2">あなたの回答:</span>
            <AttendanceStatusBadge status={currentAttendance.status} />
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">出欠</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStatus("attending")}
            className={`flex-1 py-3 rounded-lg border-2 font-medium transition-colors ${
              status === "attending"
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            参加
          </button>
          <button
            type="button"
            onClick={() => setStatus("not_attending")}
            className={`flex-1 py-3 rounded-lg border-2 font-medium transition-colors ${
              status === "not_attending"
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            不参加
          </button>
        </div>
      </div>

      {status === "attending" && hasClasses && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            出場予定クラス (申告)
          </label>
          <Select
            value={declaredClassId}
            onChange={setDeclaredClassId}
            options={[
              { value: "", label: "未申告" },
              ...(tournamentClasses ?? []).map((c) => ({
                value: c.id,
                label: `${c.category}${c.name ? ` ${c.name}` : ""}`,
              })),
            ]}
            placeholder="未申告"
          />
          <p className="text-xs text-gray-500 mt-1">
            参加するクラスを 1 つ選んでください (任意)。複数出場する場合はコメントに記入してください。
          </p>
        </div>
      )}

      <div>
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
          コメント（任意）
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="遅れます、途中退出など"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={2}
          maxLength={200}
        />
        <div className="text-xs text-gray-500 text-right mt-1">{comment.length}/200</div>
      </div>

      <Button type="submit" className="w-full" loading={loading} disabled={status === null}>
        {currentAttendance ? "回答を更新する" : "回答を送信する"}
      </Button>

      {!currentAttendance && status === null && (
        <p className="text-xs text-gray-500 text-center">参加 / 不参加 を選択してください</p>
      )}

      {currentAttendance && (
        <p className="text-xs text-gray-500 text-center">
          現在の回答: <AttendanceStatusBadge status={currentAttendance.status} />
          {currentAttendance.status === "waitlist" && currentAttendance.position && (
            <span className="ml-1">({currentAttendance.position}番目)</span>
          )}
        </p>
      )}
    </form>
  );
}
