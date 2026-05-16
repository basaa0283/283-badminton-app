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

interface RowState {
  status: string;
  isPaid: boolean;
  amountInput: string; // 空欄なら event.fee 採用 (null)
}

function rowFromAttendee(a: Attendee): RowState {
  return {
    status: a.status,
    isPaid: a.paymentStatus === "paid",
    amountInput:
      a.paymentAmount !== null && a.paymentAmount !== undefined
        ? a.paymentAmount.toString()
        : "",
  };
}

function parseAmount(input: string): number | null {
  const t = input.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function AdminAttendanceManager({
  eventId,
  attendees,
  eventFee,
  onUpdated,
}: AdminAttendanceManagerProps) {
  // 現在の編集中ローカル状態
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const submitRef = useRef(false);

  // attendees が更新されたら rows を同期 (サーバー側の真の値で上書き)
  useEffect(() => {
    setRows(Object.fromEntries(attendees.map((a) => [a.id, rowFromAttendee(a)])));
  }, [attendees]);

  useEffect(() => {
    if (!addingMember) return;
    fetch("/api/members")
      .then((r) => r.json())
      .then((json) => { if (json.success) setMembers(json.data); });
  }, [addingMember]);

  const updateRow = (id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const isDirty = (a: Attendee): boolean => {
    const r = rows[a.id];
    if (!r) return false;
    const origPaid = a.paymentStatus === "paid";
    const origAmt = a.paymentAmount ?? null;
    return r.status !== a.status || r.isPaid !== origPaid || parseAmount(r.amountInput) !== origAmt;
  };

  const dirtyCount = attendees.filter(isDirty).length;

  const handleSubmit = async () => {
    if (submitRef.current) return;
    submitRef.current = true;
    setSubmitting(true);
    try {
      for (const a of attendees) {
        if (!isDirty(a)) continue;
        const r = rows[a.id];
        const body: {
          status?: "attending" | "not_attending";
          paymentStatus?: "paid" | "unpaid" | null;
          paymentAmount?: number | null;
        } = {};
        if (r.status !== a.status && (r.status === "attending" || r.status === "not_attending")) {
          body.status = r.status;
        }
        const origPaid = a.paymentStatus === "paid";
        if (r.isPaid !== origPaid) body.paymentStatus = r.isPaid ? "paid" : null;
        const newAmt = parseAmount(r.amountInput);
        const origAmt = a.paymentAmount ?? null;
        if (newAmt !== origAmt) body.paymentAmount = newAmt;
        await fetch(`/api/events/${eventId}/attendances/${a.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      onUpdated();
    } finally {
      setSubmitting(false);
      submitRef.current = false;
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
            {attendees.map((a) => {
              const r = rows[a.id] ?? rowFromAttendee(a);
              const dirty = isDirty(a);
              return (
                <AttendeeRow
                  key={a.id}
                  attendee={a}
                  row={r}
                  eventFee={eventFee}
                  dirty={dirty}
                  onChangeStatus={(status) => updateRow(a.id, { status })}
                  onTogglePaid={() => updateRow(a.id, { isPaid: !r.isPaid })}
                  onChangeAmount={(amountInput) => updateRow(a.id, { amountInput })}
                />
              );
            })}
          </div>
        )}

        {attendees.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <span className="text-xs text-gray-500">
              {dirtyCount > 0 ? `未保存の変更: ${dirtyCount}件` : "未保存の変更はありません"}
            </span>
            <Button
              size="sm"
              onClick={handleSubmit}
              loading={submitting}
              disabled={dirtyCount === 0}
            >
              更新
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttendeeRow({
  attendee,
  row,
  eventFee,
  dirty,
  onChangeStatus,
  onTogglePaid,
  onChangeAmount,
}: {
  attendee: Attendee;
  row: RowState;
  eventFee: number | null;
  dirty: boolean;
  onChangeStatus: (status: "attending" | "not_attending") => void;
  onTogglePaid: () => void;
  onChangeAmount: (amountInput: string) => void;
}) {
  const isAttending = row.status === "attending";

  return (
    <div
      className={`border rounded-lg p-3 ${
        dirty ? "border-orange-300 bg-orange-50" : "border-gray-200"
      }`}
    >
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
        {dirty && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-200 text-orange-800 font-medium">
            未保存
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => onChangeStatus("attending")}
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
          className={`flex-1 text-xs py-1 rounded font-medium border transition-colors ${
            row.status === "not_attending"
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
              checked={row.isPaid}
              onChange={onTogglePaid}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            受取済み
          </label>
          <div className="flex items-center gap-1 ml-auto">
            <input
              type="number"
              min={0}
              value={row.amountInput}
              onChange={(e) => onChangeAmount(e.target.value)}
              placeholder={eventFee !== null ? `${eventFee}` : "0"}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-xs text-right"
            />
            <span className="text-xs text-gray-500">円</span>
          </div>
        </div>
      )}
    </div>
  );
}
