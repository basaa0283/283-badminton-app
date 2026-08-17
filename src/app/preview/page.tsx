import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ja } from "date-fns/locale";
import { prisma } from "@/lib/prisma";

const JST = "Asia/Tokyo";

export const metadata = {
  title: "参加をご検討の方へ | 283バドミントン",
};

// 認証不要。/about と同じく未ログインでも見られる。
export const dynamic = "force-dynamic";

interface PreviewEvent {
  id: string;
  eventDate: string;
  eventEndDate: string | null;
  isAllDay: boolean;
  category: { name: string; color: string | null } | null;
  availability: "open" | "few" | "full";
}

const AVAILABILITY_LABEL: Record<PreviewEvent["availability"], string> = {
  open: "○ 空きあり",
  few: "△ 残りわずか",
  full: "× 満員",
};
const AVAILABILITY_CLASS: Record<PreviewEvent["availability"], string> = {
  open: "text-green-700 bg-green-50",
  few: "text-amber-700 bg-amber-50",
  full: "text-gray-500 bg-gray-100",
};

async function getData(): Promise<{
  events: PreviewEvent[];
  officialLineUrl: string;
}> {
  const now = new Date();
  const [events, setting] = await Promise.all([
    prisma.event.findMany({
      where: {
        eventDate: { gte: now },
        minViewRole: "guest",
        status: "published",
      },
      orderBy: { eventDate: "asc" },
      take: 8,
      select: {
        id: true,
        eventDate: true,
        eventEndDate: true,
        isAllDay: true,
        capacity: true,
        category: { select: { name: true, color: true } },
        _count: { select: { attendances: { where: { status: "attending" } } } },
      },
    }),
    prisma.systemSetting.findUnique({ where: { key: "officialLineUrl" } }),
  ]);

  const mapped: PreviewEvent[] = events.map((e) => {
    const attending = e._count.attendances;
    let availability: PreviewEvent["availability"];
    if (e.capacity === null) availability = "open";
    else if (attending >= e.capacity) availability = "full";
    else if (attending >= e.capacity * 0.8) availability = "few";
    else availability = "open";
    return {
      id: e.id,
      eventDate: e.eventDate.toISOString(),
      eventEndDate: e.eventEndDate?.toISOString() ?? null,
      isAllDay: e.isAllDay,
      category: e.category ? { name: e.category.name, color: e.category.color } : null,
      availability,
    };
  });

  return { events: mapped, officialLineUrl: setting?.value ?? "" };
}

// Azure ランタイムは UTC で動くため、date-fns の format をそのまま使うと 9 時間ずれる。
// 明示的に JST (Asia/Tokyo) に変換して整形する (他ページの LINE 通知等と同じ方針)。
function formatEventDate(iso: string, isAllDay: boolean, endIso: string | null): string {
  const dateStr = formatInTimeZone(new Date(iso), JST, "M月d日(E)", { locale: ja });
  if (isAllDay) return `${dateStr} 終日`;
  const startTime = formatInTimeZone(new Date(iso), JST, "HH:mm", { locale: ja });
  if (endIso) {
    const endTime = formatInTimeZone(new Date(endIso), JST, "HH:mm", { locale: ja });
    return `${dateStr} ${startTime}〜${endTime}`;
  }
  return `${dateStr} ${startTime}〜`;
}

export default async function PreviewPage() {
  const { events, officialLineUrl } = await getData();

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <Link href="/about" className="text-blue-600 hover:underline">
            ← サークルについて
          </Link>
          <Link href="/login" className="text-blue-600 hover:underline">
            ログイン →
          </Link>
        </div>

        <h1 className="text-xl font-bold text-gray-900">参加をご検討の方へ</h1>
        <p className="text-sm text-gray-700">
          直近の練習会の日時をご案内します。
          <br />
          <strong>参加希望の方は、日程を添えて公式 LINE までご連絡ください。</strong>
          はじめての方には、運営から詳細 (場所・時間・持ち物など) をお返しします。
        </p>

        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            直近の予定 ({events.length} 件)
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">
              現在、公開中の予定はありません。公式 LINE でお問い合わせください。
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {events.map((e) => (
                <li key={e.id} className="py-2 flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-900 font-medium">
                    {formatEventDate(e.eventDate, e.isAllDay, e.eventEndDate)}
                  </span>
                  {e.category && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                      style={{ backgroundColor: e.category.color ?? "#6B7280" }}
                    >
                      {e.category.name}
                    </span>
                  )}
                  <span className="flex-1" />
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${AVAILABILITY_CLASS[e.availability]}`}
                  >
                    {AVAILABILITY_LABEL[e.availability]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500 mt-3">
            ※ 場所や詳細はご連絡いただいた方にお伝えします。
          </p>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">公式 LINE でご連絡ください</h2>
          <p className="text-sm text-gray-700 mb-3">
            以下の情報を添えてメッセージをお願いします。
          </p>
          <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-line mb-4 font-mono">
            {`はじめまして。参加を希望しています。

- お名前 (ニックネームでも可):
- 性別 / 年代:
- バドミントン経験:
- 参加希望日 (例: 6/15 の練習会):

よろしくお願いします。`}
          </div>
          {officialLineUrl ? (
            <a
              href={officialLineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#06C755] hover:bg-[#05b34d] text-white font-bold py-2.5 px-5 rounded-lg text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2C6.48 2 2 5.82 2 10.5c0 2.67 1.35 5.04 3.47 6.61.17.12.27.31.27.52l-.04 1.92c-.01.28.26.49.53.4l2.14-.69c.15-.05.31-.04.45.02 1.01.36 2.09.55 3.18.55 5.52 0 10-3.82 10-8.5S17.52 2 12 2z" />
              </svg>
              公式 LINE を開く
            </a>
          ) : (
            <p className="text-xs text-gray-500">
              (公式 LINE の URL が管理画面で未設定です)
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
