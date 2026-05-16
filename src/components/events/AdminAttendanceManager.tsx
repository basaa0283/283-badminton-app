"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Attendee {
  id: string;
  status: string;
  position: number | null;
  user: { id: string; nickname: string; profileImageUrl: string | null };
  paymentStatus?: string | null;
  paymentAmount?: number | null;
  paymentNote?: string | null;
}

interface AdminAttendanceManagerProps {
  eventId: string;
  attendees: Attendee[];
  eventFee: number | null;
  onUpdated: () => void;
}

interface MemberOption {
  id: string;
  nickname: string;
  role: string;
}

export function AdminAttendanceManager({
  eventId,
  attendees,
  eventFee,
  onUpdated,
}: AdminAttendanceManagerProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const savingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!addingMember) return;
    fetch("/api/members")
      .then((r) => r.json())
      .then((json) => { if (json.success) setMembers(json.data); });
  }, [addingMember]);

  const updateAttendance = async (
    id: string,
    data: { status?: "attending" | "not_attending"; paymentStatus?: "paid" | "unpaid" | null; paymentAmount?: number | null }
  ) => {
    if (savingRef.current === id) return;
    savingRef.current = id;
    setSavingId(id);
    try {
      const res = await fetch(`/api/events/${eventId}/attendances/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) onUpdated();
    } finally {
      setSavingId(null);
      savingRef.current = null;
    }
  };

  const addMember = async () => {
    if (!selectedUserId) return;
    await fetch(`/api/events/${eventId}/attendances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, status: "attending" }),
    });
    setSelectedUserId("");
    setAddingMember(false);
    onUpdated();
  };

  const attendingMemberIds = new Set(attendees.map((a) => a.user.id));
  const candidates = members.filter((m) => !attendingMemberIds.has(m.id));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">参加者管理 (管理者)</h2>
          {!addingMember && (
            <Button size="sm" variant="secondary" onClick={() => setAddingMember(true)}>
              + 出席者追加
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {addingMember && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">メンバーを選択</option>
              {candidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nickname} ({m.role})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1 text-sm"
                onClick={() => { setAddingMember(false); setSelectedUserId(""); }}
              >
                キャンセル
              </Button>
              <Button className="flex-1 text-sm" onClick={addMember} disabled={!selectedUserId}>
                参加で追加
              </Button>
            </div>
          </div>
        )}

        {attendees.length === 0 ? (
          <p className="text-sm text-gray-500">参加者がいません</p>
        ) : (
          <div className="space-y-2">
            {attendees.map((a) => (
              <AttendeeRow
                key={a.id}
                attendee={a}
                eventFee={eventFee}
                saving={savingId === a.id}
                onChangeStatus={(status) => updateAttendance(a.id, { status })}
                onTogglePaid={() =>
                  updateAttendance(a.id, {
                    paymentStatus: a.paymentStatus === "paid" ? null : "paid",
                  })
                }
                onChangeAmount={(amount) => updateAttendance(a.id, { paymentAmount: amount })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttendeeRow({
  attendee,
  eventFee,
  saving,
  onChangeStatus,
  onTogglePaid,
  onChangeAmount,
}: {
  attendee: Attendee;
  eventFee: number | null;
  saving: boolean;
  onChangeStatus: (status: "attending" | "not_attending") => void;
  onTogglePaid: () => void;
  onChangeAmount: (amount: number | null) => void;
}) {
  const isAttending = attendee.status === "attending";
  const isPaid = attendee.paymentStatus === "paid";
  const [amountInput, setAmountInput] = useState(
    attendee.paymentAmount !== null && attendee.paymentAmount !== undefined
      ? attendee.paymentAmount.toString()
      : ""
  );

  const handleAmountBlur = () => {
    const trimmed = amountInput.trim();
    if (trimmed === "") {
      // 空欄なら null = event.fee 採用
      if (attendee.paymentAmount !== null && attendee.paymentAmount !== undefined) {
        onChangeAmount(null);
      }
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return;
    if (n !== attendee.paymentAmount) onChangeAmount(n);
  };

  return (
    <div className={`border rounded-lg p-3 ${saving ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        {attendee.user.profileImageUrl ? (
          <img
            src={attendee.user.profileImageUrl}
            alt=""
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">
            {attendee.user.nickname[0]}
          </div>
        )}
        <span className="text-sm font-medium text-gray-900 flex-1 truncate">
          {attendee.user.nickname}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            attendee.status === "attending"
              ? "bg-green-100 text-green-700"
              : attendee.status === "waitlist"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-gray-200 text-gray-500"
          }`}
        >
          {attendee.status === "attending"
            ? "参加"
            : attendee.status === "waitlist"
            ? `キャンセル待ち${attendee.position ?? ""}`
            : "不参加"}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => onChangeStatus("attending")}
          disabled={saving || isAttending}
          className={`flex-1 text-xs py-1 rounded font-medium border transition-colors ${
            isAttending
              ? "bg-green-500 text-white border-green-500"
              : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
          }`}
        >
          参加
        </button>
        <button
          onClick={() => onChangeStatus("not_attending")}
          disabled={saving || attendee.status === "not_attending"}
          className={`flex-1 text-xs py-1 rounded font-medium border transition-colors ${
            attendee.status === "not_attending"
              ? "bg-red-500 text-white border-red-500"
              : "bg-white text-gray-600 border-gray-300 hover:border-red-400"
          }`}
        >
          不参加
        </button>
      </div>

      {isAttending && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={isPaid}
              onChange={onTogglePaid}
              disabled={saving}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            受取済み
          </label>
          <div className="flex items-center gap-1 ml-auto">
            <input
              type="number"
              min={0}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              onBlur={handleAmountBlur}
              placeholder={eventFee !== null ? `${eventFee}` : "0"}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-xs text-right"
              disabled={saving}
            />
            <span className="text-xs text-gray-500">円</span>
          </div>
        </div>
      )}
    </div>
  );
}
