"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { permissions, UserRole } from "@/lib/permissions";

interface ReportItem {
  id: string;
  title: string;
  eventDate: string;
  attendingCount: number;
  fee: number | null;
  shuttleCount: number | null;
  shuttleCost: number | null;
  gymCost: number | null;
  otherCost: number | null;
  otherMemo: string | null;
  actualRevenue: number | null;
  totalCost: number;
  profit: number | null;
}

interface Summary {
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
}

function yen(v: number | null): string {
  return v === null ? "—" : `${v.toLocaleString()}円`;
}

export default function ExpenseReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<ReportItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
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
      (async () => {
        try {
          const res = await fetch("/api/admin/expense-report");
          const data = await res.json();
          if (data.success) {
            setItems(data.data.items);
            setSummary(data.data.summary);
          }
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [status]);

  if (status === "loading" || !session) {
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

        <h1 className="text-xl font-bold text-gray-900 mb-4">経費レポート</h1>

        {summary && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-gray-500">合計収入</div>
                  <div className="text-lg font-bold text-gray-900">{yen(summary.totalRevenue)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">合計経費</div>
                  <div className="text-lg font-bold text-gray-900">{yen(summary.totalCost)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">合計収支</div>
                  <div
                    className={`text-lg font-bold ${
                      summary.totalProfit >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {yen(summary.totalProfit)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              過去のイベントはありません
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Link key={item.id} href={`/events/${item.id}`}>
                <Card hover>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">{item.title}</div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(item.eventDate), "yyyy/M/d", { locale: ja })} ·
                          参加 {item.attendingCount}人
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`text-sm font-bold ${
                            item.profit === null
                              ? "text-gray-400"
                              : item.profit >= 0
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {item.profit === null ? "未入力" : yen(item.profit)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {yen(item.actualRevenue)} - {yen(item.totalCost)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
