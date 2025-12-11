"use client";

import { AttendanceStatusBadge } from "@/components/ui/Badge";

interface Attendee {
  id: string;
  status: string;
  comment: string | null;
  position: number | null;
  user: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
    gender: string | null;
  };
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
}

export function AttendeeList({ attendees }: AttendeeListProps) {
  const attending = attendees.filter((a) => a.status === "attending");
  const notAttending = attendees.filter((a) => a.status === "not_attending");
  const waitlist = attendees.filter((a) => a.status === "waitlist").sort((a, b) => (a.position || 0) - (b.position || 0));

  return (
    <div className="space-y-6">
      <AttendeeSection title={`参加 (${attending.length})`} attendees={attending} />
      {waitlist.length > 0 && (
        <AttendeeSection title={`キャンセル待ち (${waitlist.length})`} attendees={waitlist} showPosition />
      )}
      {notAttending.length > 0 && (
        <AttendeeSection title={`不参加 (${notAttending.length})`} attendees={notAttending} />
      )}
    </div>
  );
}

function AttendeeSection({
  title,
  attendees,
  showPosition = false,
}: {
  title: string;
  attendees: Attendee[];
  showPosition?: boolean;
}) {
  if (attendees.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>
      <div className="space-y-2">
        {attendees.map((attendee) => (
          <div
            key={attendee.id}
            className={`flex items-center gap-3 p-2 rounded-lg ${getGenderBgClass(attendee.user.gender)}`}
          >
            {attendee.user.profileImageUrl ? (
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
              <div className="flex items-center gap-2">
                {showPosition && attendee.position && (
                  <span className="text-xs text-yellow-600 font-medium">{attendee.position}.</span>
                )}
                <span className="text-sm font-medium text-gray-900 truncate">
                  {attendee.user.nickname}
                </span>
              </div>
              {attendee.comment && (
                <p className="text-xs text-gray-500 truncate">{attendee.comment}</p>
              )}
            </div>
            <AttendanceStatusBadge status={attendee.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
