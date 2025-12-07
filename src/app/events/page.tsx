"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { EventCard } from "@/components/events/EventCard";
import { Button } from "@/components/ui/Button";
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

export default function EventsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchEvents();
    }
  }, [status, tab]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events?upcoming=${tab === "upcoming"}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
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
      </main>
    </div>
  );
}
