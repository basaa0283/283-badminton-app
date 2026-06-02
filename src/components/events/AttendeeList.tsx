"use client";

import Link from "next/link";
import { AttendanceStatusBadge } from "@/components/ui/Badge";

interface Attendee {
  id: string;
  status: string;
  comment: string | null;
  position: number | null;
  declaredTournamentClassId?: string | null;
  user: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
    gender: string | null;
  };
}

interface TournamentClassOption {
  id: string;
  category: string;
  name: string | null;
}

// 性別に応じた背景色を取得
function getGenderBgClass(gender: string | null): string {
  switch (gender) {
    case "male":
      return "bg-blue-50 border-l-4 border-blue-400";
    case "female":
      return "bg-pink-50 border-l-4 border-pink-400";
    default:
      return "bg-gray-50";
  }
}

interface AttendeeListProps {
  attendees: Attendee[];
  tournamentClasses?: TournamentClassOption[];
}

export function AttendeeList({ attendees, tournamentClasses }: AttendeeListProps) {
  const attending = attendees.filter((a) => a.status === "attending");
  const notAttending = attendees.filter((a) => a.status === "not_attending");
  const waitlist = attendees.filter((a) => a.status === "waitlist").sort((a, b) => (a.position || 0) - (b.position || 0));
  const observing = attendees.filter((a) => a.status === "observing");

  const classMap = new Map<string, TournamentClassOption>();
  for (const c of tournamentClasses ?? []) classMap.set(c.id, c);

  return (
    <div className="space-y-6">
      <AttendeeSection
        title={`参加 (${attending.length})`}
        attendees={attending}
        classMap={classMap}
      />
      {waitlist.length > 0 && (
        <AttendeeSection
          title={`キャンセル待ち (${waitlist.length})`}
          attendees={waitlist}
          showPosition
          classMap={classMap}
        />
      )}
      {observing.length > 0 && (
        <AttendeeSection title={`見学 (${observing.length})`} attendees={observing} classMap={classMap} />
      )}
      {notAttending.length > 0 && (
        <AttendeeSection title={`不参加 (${notAttending.length})`} attendees={notAttending} classMap={classMap} />
      )}
    </div>
  );
}

function AttendeeSection({
  title,
  attendees,
  showPosition = false,
  classMap,
}: {
  title: string;
  attendees: Attendee[];
  showPosition?: boolean;
  classMap: Map<string, TournamentClassOption>;
}) {
  if (attendees.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>
      <div className="space-y-2">
        {attendees.map((attendee) => (
          <Link
            key={attendee.id}
            href={`/members/${attendee.user.id}`}
            className={`flex items-center gap-3 p-2 rounded-lg hover:brightness-95 ${getGenderBgClass(attendee.user.gender)}`}
          >
            {attendee.user.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attendee.user.profileImageUrl}
                alt=""
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-gray-600 text-xs">{attendee.user.nickname[0]}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {showPosition && attendee.position && (
                  <span className="text-xs text-yellow-600 font-medium">{attendee.position}.</span>
                )}
                <span className="text-sm font-medium text-gray-900 truncate">
                  {attendee.user.nickname}
                </span>
                {attendee.declaredTournamentClassId &&
                  classMap.has(attendee.declaredTournamentClassId) && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium shrink-0">
                      {(() => {
                        const c = classMap.get(attendee.declaredTournamentClassId)!;
                        return `${c.category}${c.name ? ` ${c.name}` : ""}`;
                      })()}
                    </span>
                  )}
              </div>
              {attendee.comment && (
                <p className="text-xs text-gray-500 truncate">{attendee.comment}</p>
              )}
            </div>
            <AttendanceStatusBadge status={attendee.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
