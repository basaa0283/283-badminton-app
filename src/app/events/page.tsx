"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { EventCard } from "@/components/events/EventCard";
import { Button } from "@/components/ui/Button";
import { GuestContactCard } from "@/components/guests/GuestContactCard";
import { permissions, UserRole } from "@/lib/permissions";

interface Event {
  id: string;
  title: string;
  eventDate: string;
  location: string | null;
  capacity: number | null;
  attendingCount: number;
  waitlistCount: number;
  deadline: string | null;
  deadlineEnabled: boolean;
  myAttendance?: {
    status: string;
    position: number | null;
  } | null;
}

const PAST_INITIAL_MONTHS = 3;
const PAST_LOAD_MORE_STEP = 3; // 1 回押すごとに広げる月数
const PAST_MAX_MONTHS = 240; // 上限 20 年 (API と合わせる)

export default function EventsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [pastMonthsBack, setPastMonthsBack] = useState(PAST_INITIAL_MONTHS);
  // 「もっと前を見る」ボタンの直前カウント。広げて再取得したのに件数が増えなかったら
  // 「これより前のイベントは無い」と判断してボタンを隠す。
  const [pastReachedEnd, setPastReachedEnd] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // タブを切り替えたら past の状態と表示中の events をリセット
  useEffect(() => {
    setEvents([]);
    if (tab === "past") {
      setPastMonthsBack(PAST_INITIAL_MONTHS);
      setPastReachedEnd(false);
    }
  }, [tab]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchEvents();
    }
    // pastMonthsBack を依存に入れて「もっと前を見る」で再取得する
  }, [status, tab, pastMonthsBack]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const qs =
        tab === "upcoming"
          ? "upcoming=true"
          : `upcoming=false&monthsBack=${pastMonthsBack}`;
      const res = await fetch(`/api/events?${qs}`);
      const data = await res.json();
      if (data.success) {
        if (tab === "past") {
          // 同じ件数なら、それ以上前は無いと判断
          setPastReachedEnd(data.data.length === events.length && pastMonthsBack > PAST_INITIAL_MONTHS);
        }
        setEvents(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMorePast = () => {
    setPastMonthsBack((m) => Math.min(m + PAST_LOAD_MORE_STEP, PAST_MAX_MONTHS));
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  const role = session.user.role as UserRole;
  const canCreate = permissions.canCreateEvent(role);
  const canRespond = permissions.canRespondToEvent(role);

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">イベント</h1>
          {canCreate && (
            <Link href="/events/new">
              <Button size="sm">新規作成</Button>
            </Link>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab("upcoming")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "upcoming"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            今後のイベント
          </button>
          <button
            onClick={() => setTab("past")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "past"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            過去のイベント
          </button>
        </div>

        {!canRespond && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-900">
            あなたは閲覧専用モードでご利用中です。出欠登録などの操作はできません。
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {tab === "upcoming" ? "今後のイベントはありません" : "過去のイベントはありません"}
          </div>
        ) : (
          <div>
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        {tab === "past" && !loading && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="text-xs text-gray-500">直近 {pastMonthsBack} か月分を表示中</div>
            {!pastReachedEnd && pastMonthsBack < PAST_MAX_MONTHS && (
              <Button size="sm" variant="secondary" onClick={loadMorePast}>
                もっと前を見る (+{PAST_LOAD_MORE_STEP}か月)
              </Button>
            )}
            {pastReachedEnd && (
              <div className="text-xs text-gray-400">これより前のイベントはありません</div>
            )}
          </div>
        )}

        {!canRespond && (
          <div className="mt-6">
            <GuestContactCard />
          </div>
        )}
      </main>
    </div>
  );
}
