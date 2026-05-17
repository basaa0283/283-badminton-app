"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Expenses {
  shuttleCount: number | null;
  shuttleCost: number | null;
  gymCost: number | null;
  otherCost: number | null;
  otherMemo: string | null;
  actualRevenue: number | null;
  applicableShuttlePrice: {
    effectiveFrom: string;
    casePrice: number;
    shuttlesPerCase: number;
    pricePerPiece: number;
  } | null;
}

interface ExpensesCardProps {
  eventId: string;
  expenses: Expenses;
  onUpdated: () => void;
}

function num(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function format(n: number | null): string {
  return n === null ? "—" : `${n.toLocaleString()}円`;
}

export function ExpensesCard({ eventId, expenses, onUpdated }: ExpensesCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shuttleCount, setShuttleCount] = useState(expenses.shuttleCount?.toString() ?? "");
  // シャトル代は個数 × 適用単価で API 側で再計算するため、保存値は固定で送らない。
  const [gymCost, setGymCost] = useState(expenses.gymCost?.toString() ?? "");
  const [otherCost, setOtherCost] = useState(expenses.otherCost?.toString() ?? "");
  const [otherMemo, setOtherMemo] = useState(expenses.otherMemo ?? "");
  // 実集金額は参加者の支払い済み合計から自動算出するため、ここでは編集不可。表示のみ。

  const totalCost =
    (expenses.shuttleCost ?? 0) + (expenses.gymCost ?? 0) + (expenses.otherCost ?? 0);
  const profit = expenses.actualRevenue !== null ? expenses.actualRevenue - totalCost : null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shuttleCount: num(shuttleCount),
          // shuttleCost は送らない (API 側で個数 × 適用単価から再計算)
          shuttleCost: null,
          gymCost: num(gymCost),
          otherCost: num(otherCost),
          otherMemo: otherMemo.trim() || null,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "保存に失敗しました");
        return;
      }
      setEditing(false);
      onUpdated();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShuttleCount(expenses.shuttleCount?.toString() ?? "");
    // shuttleCost はキャンセル時に初期化不要 (state を持たない)
    setGymCost(expenses.gymCost?.toString() ?? "");
    setOtherCost(expenses.otherCost?.toString() ?? "");
    setOtherMemo(expenses.otherMemo ?? "");
    setError(null);
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">経費・収支 (管理者のみ)</h2>
          {!editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              編集
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">{error}</div>
        )}

        {editing ? (
          <div className="space-y-3">
            {expenses.applicableShuttlePrice && (
              <div className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-lg">
                適用シャトル単価: 1個あたり {expenses.applicableShuttlePrice.pricePerPiece.toFixed(1)}円
                (ケース {expenses.applicableShuttlePrice.casePrice.toLocaleString()}円 ÷
                {expenses.applicableShuttlePrice.shuttlesPerCase}個)。個数入力でシャトル代が自動算出されます。
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="exp-shuttle-count" className="block text-xs text-gray-600 mb-1">シャトル個数</label>
                <input
                  id="exp-shuttle-count"
                  type="number"
                  min={0}
                  value={shuttleCount}
                  onChange={(e) => setShuttleCount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">シャトル代 (自動算出)</label>
                <div
                  data-testid="shuttle-cost-auto"
                  className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-700"
                >
                  {(() => {
                    const n = Number(shuttleCount);
                    if (!shuttleCount || !Number.isFinite(n) || n < 0) return "—";
                    if (!expenses.applicableShuttlePrice) return "単価未登録";
                    const cost = Math.round(n * expenses.applicableShuttlePrice.pricePerPiece);
                    return `${cost.toLocaleString()}円`;
                  })()}
                </div>
              </div>
              <div>
                <label htmlFor="exp-gym-cost" className="block text-xs text-gray-600 mb-1">体育館代 (円)</label>
                <input
                  id="exp-gym-cost"
                  type="number"
                  min={0}
                  value={gymCost}
                  onChange={(e) => setGymCost(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label htmlFor="exp-other-cost" className="block text-xs text-gray-600 mb-1">その他経費 (円)</label>
                <input
                  id="exp-other-cost"
                  type="number"
                  min={0}
                  value={otherCost}
                  onChange={(e) => setOtherCost(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="exp-other-memo" className="block text-xs text-gray-600 mb-1">その他経費メモ</label>
              <input
                id="exp-other-memo"
                type="text"
                maxLength={500}
                value={otherMemo}
                onChange={(e) => setOtherMemo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="例: 飲み物代"
              />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
              実集金額は「参加者管理」で受取済みにしたメンバーの合計から自動算出されます。
              現在の集金額: <span className="font-medium text-gray-900">{format(expenses.actualRevenue)}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1 text-sm" onClick={handleCancel} disabled={saving}>
                キャンセル
              </Button>
              <Button className="flex-1 text-sm" onClick={handleSave} loading={saving}>
                保存
              </Button>
            </div>
          </div>
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">シャトル</dt>
              <dd className="text-gray-900">
                {expenses.shuttleCount !== null && `${expenses.shuttleCount}個`}
                {expenses.shuttleCount !== null && expenses.shuttleCost !== null && " / "}
                {format(expenses.shuttleCost)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">体育館代</dt>
              <dd className="text-gray-900">{format(expenses.gymCost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">
                その他{expenses.otherMemo ? ` (${expenses.otherMemo})` : ""}
              </dt>
              <dd className="text-gray-900">{format(expenses.otherCost)}</dd>
            </div>
            <div className="border-t pt-2 flex justify-between font-medium">
              <dt>経費合計</dt>
              <dd>{format(totalCost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">実集金額</dt>
              <dd className="text-gray-900">{format(expenses.actualRevenue)}</dd>
            </div>
            <div
              className={`border-t pt-2 flex justify-between font-bold ${
                profit === null ? "" : profit >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              <dt>収支</dt>
              <dd>{profit === null ? "—" : `${profit.toLocaleString()}円`}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
