"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/Card";
import { AttendanceStatusBadge } from "@/components/ui/Badge";

interface EventCardProps {
  event: {
    id: string;
    title: string;
    eventDate: Date | string;
    location: string | null;
    capacity: number | null;
    attendingCount: number;
    waitlistCount: number;
    deadline: Date | string | null;
    deadlineEnabled: boolean;
    myAttendance?: {
      status: string;
      position: number | null;
    } | null;
  };
}

export function EventCard({ event }: EventCardProps) {
  const eventDate = new Date(event.eventDate);
  const isDeadlinePassed =
    event.deadlineEnabled && event.deadline && new Date(event.deadline) < new Date();
  const isFull = event.capacity !== null && event.attendingCount >= event.capacity;

  return (
    <Link href={`/events/${event.id}`}>
      <Card hover className="mb-3">
        <CardContent>
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{event.title}</h3>
            {event.myAttendance && (
              <AttendanceStatusBadge status={event.myAttendance.status} />
            )}
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>{format(eventDate, "M月d日(E) HH:mm", { locale: ja })}</span>
            </div>

            {event.location && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="line-clamp-1">{event.location}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>
                参加: {event.attendingCount}
                {event.capacity !== null && `/${event.capacity}`}人
                {event.waitlistCount > 0 && (
                  <span className="text-yellow-600 ml-1">
                    (待ち{event.waitlistCount}人)
                  </span>
                )}
                {isFull && <span className="text-red-600 ml-1">(満員)</span>}
              </span>
            </div>
          </div>

          {isDeadlinePassed && (
            <div className="mt-2 text-xs text-red-600 font-medium">締め切り済み</div>
          )}

          {event.myAttendance?.status === "waitlist" && event.myAttendance.position && (
            <div className="mt-2 text-xs text-yellow-600 font-medium">
              キャンセル待ち {event.myAttendance.position}番目
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
