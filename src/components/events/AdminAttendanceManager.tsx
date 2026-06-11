"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

interface Attendee {
  id: string;
  status: string;
  position: number | null;
  user: { id: string; nickname: string; profileImageUrl: string | null };
  paymentStatus?: string | null;
  paymentAmount?: number | null;
  paymentNote?: string | null;
  declaredTournamentClassId?: string | null;
  // null = 通常 / "regular" = 前日まで連絡あり / "same_day_with_notice" = 12h以内連絡あり (自動)
  // "same_day_no_notice" = 12h以内連絡なし (管理者手動) / "no_show" = 当日無断不参加 (管理者手動)
  cancelType?: string | null;
}

interface TournamentClassOption {
  id: string;
  category: string;
  name: string | null;
}

interface AdminAttendanceManagerProps {
  eventId: string;
  attendees: Attendee[];
  eventFee: number | null;
  // 大会連動イベントの場合、紐付き大会の class 一覧。空 / 未指定なら申告クラス
  // UI は表示しない。
  tournamentClasses?: TournamentClassOption[];
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
  declaredClassId: string; // "" なら未申告 (null 扱い)
}

function rowFromAttendee(a: Attendee): RowState {
  return {
    status: a.status,
    isPaid: a.paymentStatus === "paid",
    amountInput:
      a.paymentAmount !== null && a.paymentAmount !== undefined
        ? a.paymentAmount.toString()
        : "",
    declaredClassId: a.declaredTournamentClassId ?? "",
  };
}

function classLabel(c: TournamentClassOption): string {
  return `${c.category}${c.name ? ` ${c.name}` : ""}`;
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
  tournamentClasses,
  onUpdated,
}: AdminAttendanceManagerProps) {
  const hasClasses = (tournamentClasses?.length ?? 0) > 0;
  const [addingDeclaredClassId, setAddingDeclaredClassId] = useState("");
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
    const origClassId = a.declaredTournamentClassId ?? "";
    return (
      r.status !== a.status ||
      r.isPaid !== origPaid ||
      parseAmount(r.amountInput) !== origAmt ||
      r.declaredClassId !== origClassId
    );
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
          status?: "attending" | "not_attending" | "observing";
          paymentStatus?: "paid" | "unpaid" | null;
          paymentAmount?: number | null;
          declaredTournamentClassId?: string | null;
        } = {};
        if (
          r.status !== a.status &&
          (r.status === "attending" || r.status === "not_attending" || r.status === "observing")
        ) {
          body.status = r.status;
        }
        const origPaid = a.paymentStatus === "paid";
        if (r.isPaid !== origPaid) body.paymentStatus = r.isPaid ? "paid" : null;
        const newAmt = parseAmount(r.amountInput);
        const origAmt = a.paymentAmount ?? null;
        if (newAmt !== origAmt) body.paymentAmount = newAmt;
        const origClassId = a.declaredTournamentClassId ?? "";
        if (r.declaredClassId !== origClassId) {
          body.declaredTournamentClassId = r.declaredClassId || null;
        }
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
      body: JSON.stringify({
        userId: selectedUserId,
        status: "attending",
        declaredTournamentClassId: hasClasses && addingDeclaredClassId ? addingDeclaredClassId : null,
      }),
    });
    setSelectedUserId("");
    setAddingDeclaredClassId("");
    setAddingMember(false);
    onUpdated();
  };

  const attendingMemberIds = new Set(attendees.map((a) => a.user.id));
  const candidates = members.filter((m) => !attendingMemberIds.has(m.id));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">代理出欠管理</h2>
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
            {hasClasses && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  出場予定クラス (任意)
                </label>
                <Select
                  value={addingDeclaredClassId}
                  onChange={setAddingDeclaredClassId}
                  options={[
                    { value: "", label: "未申告" },
                    ...(tournamentClasses ?? []).map((c) => ({
                      value: c.id,
                      label: classLabel(c),
                    })),
                  ]}
                  placeholder="未申告"
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1 text-sm"
                onClick={() => {
                  setAddingMember(false);
                  setSelectedUserId("");
                  setAddingDeclaredClassId("");
                }}
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
                  tournamentClasses={tournamentClasses}
                  eventId={eventId}
                  onUpdated={onUpdated}
                  onChangeStatus={(status) => updateRow(a.id, { status })}
                  onTogglePaid={() => updateRow(a.id, { isPaid: !r.isPaid })}
                  onChangeAmount={(amountInput) => updateRow(a.id, { amountInput })}
                  onChangeDeclaredClass={(declaredClassId) =>
                    updateRow(a.id, { declaredClassId })
                  }
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
  tournamentClasses,
  eventId,
  onUpdated,
  onChangeStatus,
  onTogglePaid,
  onChangeAmount,
  onChangeDeclaredClass,
}: {
  attendee: Attendee;
  row: RowState;
  eventFee: number | null;
  dirty: boolean;
  tournamentClasses?: TournamentClassOption[];
  eventId: string;
  onUpdated: () => void;
  onChangeStatus: (status: "attending" | "not_attending" | "observing") => void;
  onTogglePaid: () => void;
  onChangeAmount: (amountInput: string) => void;
  onChangeDeclaredClass: (declaredClassId: string) => void;
}) {
  const [flagging, setFlagging] = useState(false);
  const cancelType = attendee.cancelType ?? null;
  const handleCancelFlag = async (type: "same_day_no_notice" | "no_show" | null) => {
    if (flagging) return;
    const labelMap = {
      same_day_no_notice: "連絡なし当日キャンセル (-3pt)",
      no_show: "無断不参加 (-5pt)",
    } as const;
    const message = type
      ? `${attendee.user.nickname} さんを「${labelMap[type]}」として記録します。`
      : `${attendee.user.nickname} さんのキャンセルフラグを取消し、ポイントを復元します。`;
    if (!confirm(message + "\n実行しますか？")) return;
    setFlagging(true);
    try {
      const res = await fetch(
        `/api/admin/events/${eventId}/attendees/${attendee.id}/cancel-flag`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        },
      );
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || "更新に失敗しました");
        return;
      }
      onUpdated();
    } finally {
      setFlagging(false);
    }
  };
  const isAttending = row.status === "attending";
  const isObserving = row.status === "observing";
  const hasClasses = (tournamentClasses?.length ?? 0) > 0;

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
        {cancelType === "same_day_with_notice" && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-medium">
            当日CX (-1)
          </span>
        )}
        {cancelType === "same_day_no_notice" && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-200 text-orange-900 font-medium">
            連絡なし (-3)
          </span>
        )}
        {cancelType === "no_show" && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-200 text-red-900 font-medium">
            no-show (-5)
          </span>
        )}
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
          onClick={() => onChangeStatus("observing")}
          className={`flex-1 text-xs py-1 rounded font-medium border transition-colors ${
            isObserving
              ? "bg-blue-500 text-white border-blue-500"
              : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
          }`}
        >
          見学
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

      {(isAttending || isObserving) && (
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

      {isAttending && hasClasses && (
        <div className="mt-2">
          <label className="block text-xs text-gray-500 mb-1">出場予定クラス</label>
          <Select
            value={row.declaredClassId}
            onChange={onChangeDeclaredClass}
            options={[
              { value: "", label: "未申告" },
              ...(tournamentClasses ?? []).map((c) => ({
                value: c.id,
                label: classLabel(c),
              })),
            ]}
            placeholder="未申告"
          />
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1 flex-wrap text-xs">
        <span className="text-gray-500 mr-1">キャンセル質:</span>
        <button
          onClick={() => handleCancelFlag("same_day_no_notice")}
          disabled={flagging || cancelType === "same_day_no_notice"}
          className={`px-2 py-0.5 rounded border ${
            cancelType === "same_day_no_notice"
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-white text-gray-700 border-gray-300 hover:border-orange-400"
          } disabled:opacity-50`}
        >
          連絡なし
        </button>
        <button
          onClick={() => handleCancelFlag("no_show")}
          disabled={flagging || cancelType === "no_show"}
          className={`px-2 py-0.5 rounded border ${
            cancelType === "no_show"
              ? "bg-red-600 text-white border-red-600"
              : "bg-white text-gray-700 border-gray-300 hover:border-red-400"
          } disabled:opacity-50`}
        >
          no-show
        </button>
        {(cancelType === "same_day_no_notice" || cancelType === "no_show") && (
          <button
            onClick={() => handleCancelFlag(null)}
            disabled={flagging}
            className="px-2 py-0.5 rounded border bg-white text-gray-600 border-gray-300 hover:border-gray-500 disabled:opacity-50"
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}
