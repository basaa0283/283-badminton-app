"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AttendanceStatusBadge } from "@/components/ui/Badge";

interface AttendanceFormProps {
  eventId: string;
  currentAttendance?: {
    status: string;
    comment: string | null;
    position: number | null;
  } | null;
  isDeadlinePassed: boolean;
  onSubmit: (status: "attending" | "not_attending", comment: string) => Promise<void>;
}

export function AttendanceForm({
  currentAttendance,
  isDeadlinePassed,
  onSubmit,
}: AttendanceFormProps) {
  const [status, setStatus] = useState<"attending" | "not_attending">(
    (currentAttendance?.status as "attending" | "not_attending") || "attending"
  );
  const [comment, setComment] = useState(currentAttendance?.comment || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(status, comment);
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

      <Button type="submit" className="w-full" loading={loading}>
        {currentAttendance ? "回答を更新する" : "回答を送信する"}
      </Button>

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
