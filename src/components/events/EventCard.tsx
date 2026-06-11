"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/Card";
import { AttendanceStatusBadge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";
import { getRoleName, UserRole } from "@/lib/permissions";

interface EventCardProps {
  event: {
    id: string;
    title: string;
    eventDate: Date | string;
    eventEndDate?: Date | string | null;
    isAllDay?: boolean;
    location: string | null;
    capacity: number | null;
    attendingCount: number;
    waitlistCount: number;
    deadline: Date | string | null;
    deadlineEnabled: boolean;
    minViewRole?: string;
    minRespondRole?: string;
    status?: "draft" | "published";
    allowedTags?: Array<{ id: string; name: string; color: string | null }>;
    // 管理者向け: 経費記録の入力状況。null = 未入力扱い。
    gymCost?: number | null;
    shuttleCost?: number | null;
    actualRevenue?: number | null;
    category?: {
      id: string;
      name: string;
      description?: string | null;
      color: string | null;
    } | null;
    cancelledAt?: string | Date | null;
    myAttendance?: {
      status: string;
      position: number | null;
    } | null;
  };
}

// admin / subadmin に対し、イベントの閲覧/回答最低権限を 1 行で示すバッジ。
// 一般メンバーには出さない (運営者にしか意味がない情報)。
function PermissionBadges({
  minViewRole,
  minRespondRole,
}: {
  minViewRole?: string;
  minRespondRole?: string;
}) {
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;
  const isAdmin = role === "admin" || role === "subadmin";
  if (!isAdmin || !minViewRole || !minRespondRole) return null;
  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
        👁 閲覧 {getRoleName(minViewRole as UserRole)}+
      </span>
      <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
        ✍ 回答 {getRoleName(minRespondRole as UserRole)}+
      </span>
    </div>
  );
}

export function EventCard({ event }: EventCardProps) {
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;
  const isAdmin = role === "admin" || role === "subadmin";
  const eventDate = new Date(event.eventDate);
  const isDeadlinePassed =
    event.deadlineEnabled && event.deadline && new Date(event.deadline) < new Date();
  const isFull = event.capacity !== null && event.attendingCount >= event.capacity;
  // 経費記録の未入力チェック (管理者のみ・過去・中止以外)
  const isPast = eventDate < new Date();
  const missingExpenses =
    isAdmin &&
    isPast &&
    !event.cancelledAt &&
    (event.gymCost == null ||
      event.shuttleCost == null ||
      event.actualRevenue == null);

  const isDraft = event.status === "draft";

  return (
    <Link href={`/events/${event.id}`}>
      <Card hover className={`mb-3 ${isDraft ? "border-2 border-dashed border-gray-400 bg-gray-50" : missingExpenses ? "border-2 border-red-300 bg-red-50" : ""}`}>
        <CardContent>
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <h3 className={`font-semibold line-clamp-1 ${event.cancelledAt ? "text-gray-400 line-through" : "text-gray-900"}`}>
                {event.title}
              </h3>
              {event.cancelledAt && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white bg-red-500 shrink-0">
                  中止
                </span>
              )}
              {event.status === "draft" && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white bg-gray-500 shrink-0">
                  🔒 非公開
                </span>
              )}
              {event.allowedTags && event.allowedTags.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white bg-purple-600 shrink-0">
                  🎫 タグ限定 ({event.allowedTags.length})
                </span>
              )}
              {missingExpenses && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white bg-red-600 shrink-0">
                  ⚠ 記録未入力
                </span>
              )}
              {event.category && (
                <span className="inline-flex items-center gap-0.5 shrink-0">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium text-white inline-block"
                    style={{ backgroundColor: event.category.color ?? "#6B7280" }}
                  >
                    {event.category.name}
                  </span>
                  {event.category.description && (
                    <Tooltip content={event.category.description}>
                      <span className="text-gray-400 text-xs leading-none">ⓘ</span>
                    </Tooltip>
                  )}
                </span>
              )}
            </div>
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
              <span>
                {format(eventDate, "M月d日(E)", { locale: ja })}
                {event.isAllDay ? (
                  " 終日"
                ) : (
                  <>
                    {` ${format(eventDate, "HH:mm", { locale: ja })}`}
                    {event.eventEndDate && `-${format(new Date(event.eventEndDate), "HH:mm", { locale: ja })}`}
                  </>
                )}
              </span>
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

          <PermissionBadges
            minViewRole={event.minViewRole}
            minRespondRole={event.minRespondRole}
          />
        </CardContent>
      </Card>
    </Link>
  );
}
