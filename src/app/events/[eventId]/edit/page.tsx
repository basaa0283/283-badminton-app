"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { EventForm } from "@/components/events/EventForm";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { permissions, UserRole } from "@/lib/permissions";

interface EventData {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  location: string | null;
  capacity: number | null;
  fee: number | null;
  feeVisible: boolean;
  deadline: string | null;
  deadlineEnabled: boolean;
}

export default function EditEventPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      const role = session.user.role as UserRole;
      if (!permissions.canEditEvent(role)) {
        router.push("/events");
      }
    }
  }, [session, router]);

  useEffect(() => {
    if (status === "authenticated" && eventId) {
      fetchEvent();
    }
  }, [status, eventId]);

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      const data = await res.json();
      if (data.success) {
        setEvent(data.data);
      } else {
        router.push("/events");
      }
    } catch (error) {
      console.error("Failed to fetch event:", error);
      router.push("/events");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
  };

  const handleSubmit = async (formData: {
    title: string;
    description: string;
    eventDate: string;
    location: string;
    capacity: string;
    fee: string;
    feeVisible: boolean;
    deadline: string;
    deadlineEnabled: boolean;
  }) => {
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formData.title,
        description: formData.description || null,
        eventDate: new Date(formData.eventDate).toISOString(),
        location: formData.location || null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        fee: formData.fee ? parseInt(formData.fee) : null,
        feeVisible: formData.feeVisible,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
        deadlineEnabled: formData.deadlineEnabled,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error?.message || "イベントの更新に失敗しました");
    }

    router.push(`/events/${eventId}`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-4">
          <Link href={`/events/${eventId}`} className="text-blue-600 text-sm hover:underline">
            ← イベント詳細に戻る
          </Link>
        </div>

        <Card>
          <CardHeader>
            <h1 className="text-lg font-bold text-gray-900">イベント編集</h1>
          </CardHeader>
          <CardContent>
            <EventForm
              initialData={{
                title: event.title,
                description: event.description || "",
                eventDate: formatDateForInput(event.eventDate),
                location: event.location || "",
                capacity: event.capacity?.toString() || "",
                fee: event.fee?.toString() || "",
                feeVisible: event.feeVisible,
                deadline: event.deadline ? formatDateForInput(event.deadline) : "",
                deadlineEnabled: event.deadlineEnabled,
              }}
              onSubmit={handleSubmit}
              submitLabel="更新する"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
