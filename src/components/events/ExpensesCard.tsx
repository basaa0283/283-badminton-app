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
  const [shuttleCost, setShuttleCost] = useState(expenses.shuttleCost?.toString() ?? "");
  const [gymCost, setGymCost] = useState(expenses.gymCost?.toString() ?? "");
  const [otherCost, setOtherCost] = useState(expenses.otherCost?.toString() ?? "");
  const [otherMemo, setOtherMemo] = useState(expenses.otherMemo ?? "");
  const [actualRevenue, setActualRevenue] = useState(expenses.actualRevenue?.toString() ?? "");

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
          shuttleCost: num(shuttleCost),
          gymCost: num(gymCost),
          otherCost: num(otherCost),
          otherMemo: otherMemo.trim() || null,
          actualRevenue: num(actualRevenue),
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
    setShuttleCost(expenses.shuttleCost?.toString() ?? "");
    setGymCost(expenses.gymCost?.toString() ?? "");
    setOtherCost(expenses.otherCost?.toString() ?? "");
    setOtherMemo(expenses.otherMemo ?? "");
    setActualRevenue(expenses.actualRevenue?.toString() ?? "");
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="exp-shuttle-count" className="block text-xs text-gray-600 mb-1">シャトル本数</label>
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
                <label htmlFor="exp-shuttle-cost" className="block text-xs text-gray-600 mb-1">シャトル代 (円)</label>
                <input
                  id="exp-shuttle-cost"
                  type="number"
                  min={0}
                  value={shuttleCost}
                  onChange={(e) => setShuttleCost(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
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
            <div>
              <label htmlFor="exp-actual-revenue" className="block text-xs text-gray-600 mb-1">実集金額 (円)</label>
              <input
                id="exp-actual-revenue"
                type="number"
                min={0}
                value={actualRevenue}
                onChange={(e) => setActualRevenue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="参加者から受け取った合計"
              />
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
                {expenses.shuttleCount !== null && `${expenses.shuttleCount}本`}
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
