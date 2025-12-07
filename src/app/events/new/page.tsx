"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { EventForm } from "@/components/events/EventForm";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { permissions, UserRole } from "@/lib/permissions";

export default function NewEventPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      const role = session.user.role as UserRole;
      if (!permissions.canCreateEvent(role)) {
        router.push("/events");
      }
    }
  }, [session, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

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
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formData.title,
        description: formData.description || undefined,
        eventDate: new Date(formData.eventDate).toISOString(),
        location: formData.location || undefined,
        capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
        fee: formData.fee ? parseInt(formData.fee) : undefined,
        feeVisible: formData.feeVisible,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : undefined,
        deadlineEnabled: formData.deadlineEnabled,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error?.message || "イベントの作成に失敗しました");
    }

    router.push(`/events/${data.data.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <h1 className="text-lg font-bold text-gray-900">イベント作成</h1>
          </CardHeader>
          <CardContent>
            <EventForm onSubmit={handleSubmit} submitLabel="作成する" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
