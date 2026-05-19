"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface EventFormData {
  title: string;
  description: string;
  eventDate: string;
  eventEndDate: string;
  isAllDay: boolean;
  location: string;
  capacity: string;
  fee: string;
  feeVisible: boolean;
  deadline: string;
  deadlineEnabled: boolean;
  notifyMembers: boolean;
  categoryId: string;
  minViewRole: "guest" | "visitor" | "member";
  minRespondRole: "visitor" | "member";
}

interface EventCategory {
  id: string;
  name: string;
  color: string | null;
}

interface EventFormProps {
  initialData?: Partial<EventFormData>;
  onSubmit: (data: EventFormData) => Promise<void>;
  submitLabel?: string;
  showNotifyOption?: boolean;
}

// datetime-local 形式 (YYYY-MM-DDTHH:MM) or ISO → 日付/時刻に分割
function splitDateTime(value?: string): { day: string; time: string } {
  if (!value) return { day: "", time: "" };
  // datetime-local 形式ならそのまま分割
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const [day, rest] = value.split("T");
    return { day, time: rest.slice(0, 5) };
  }
  // ISO 形式の場合はローカル時刻として展開
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { day: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combine(day: string, time: string): string {
  if (!day || !time) return "";
  return `${day}T${time}`;
}

// 00:00, 00:30, ..., 23:30
const HALF_HOUR_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

// 年月日のオプション (現在年 ± 2)
const NOW = new Date();
const YEAR_OPTIONS: number[] = Array.from({ length: 5 }, (_, i) => NOW.getFullYear() - 1 + i);
const MONTH_OPTIONS: number[] = Array.from({ length: 12 }, (_, i) => i + 1);
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function splitDay(day: string): { y: string; m: string; d: string } {
  if (!day) return { y: "", m: "", d: "" };
  const [y, m, d] = day.split("-");
  return { y: y ?? "", m: m ?? "", d: d ?? "" };
}

export function EventForm({ initialData, onSubmit, submitLabel = "作成", showNotifyOption = false }: EventFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initStart = splitDateTime(initialData?.eventDate);
  const initEnd = splitDateTime(initialData?.eventEndDate);

  // 新規作成時は今日をデフォルトに、編集時は既存値を尊重
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  // 日付は開始時刻のものを正とする (日跨ぎイベントは想定しない)
  const [eventDay, setEventDay] = useState(initStart.day || today);
  const [startTime, setStartTime] = useState(initStart.time);
  const [endTime, setEndTime] = useState(initEnd.time);
  const [isAllDay, setIsAllDay] = useState(initialData?.isAllDay ?? false);
  // 既存データが 30分刻みでない場合は最初から細かいモードに
  const isFineInitial =
    (initStart.time && !/(00|30)$/.test(initStart.time)) ||
    (initEnd.time && !/(00|30)$/.test(initEnd.time));
  const [fineTimeStep, setFineTimeStep] = useState<boolean>(!!isFineInitial);

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [location, setLocation] = useState(initialData?.location || "");
  const [capacity, setCapacity] = useState(initialData?.capacity || "");
  const [fee, setFee] = useState(initialData?.fee || "");
  const [feeVisible, setFeeVisible] = useState(initialData?.feeVisible || false);
  const [deadline, setDeadline] = useState(initialData?.deadline || "");
  const [deadlineEnabled, setDeadlineEnabled] = useState(initialData?.deadlineEnabled || false);
  const [notifyMembers, setNotifyMembers] = useState(initialData?.notifyMembers ?? false);
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "");
  const [minViewRole, setMinViewRole] = useState<"guest" | "visitor" | "member">(
    initialData?.minViewRole ?? "visitor"
  );
  const [minRespondRole, setMinRespondRole] = useState<"visitor" | "member">(
    initialData?.minRespondRole ?? "visitor"
  );
  const [categories, setCategories] = useState<EventCategory[]>([]);

  useEffect(() => {
    fetch("/api/event-categories")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setCategories(json.data);
      })
      .catch(() => {});
  }, []);

  // 過去イベントから場所の候補を取得
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/events/locations")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setLocationSuggestions(json.data);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!eventDay) {
      setError("開催日は必須です");
      setLoading(false);
      return;
    }

    if (!isAllDay && !startTime) {
      setError("開始時刻は必須です (終日の場合は「終日」をチェックしてください)");
      setLoading(false);
      return;
    }

    if (!isAllDay && endTime && endTime <= startTime) {
      setError("終了時刻は開始時刻より後に設定してください");
      setLoading(false);
      return;
    }

    // 終日のときは開始/終了時刻を 00:00 に揃える (DB 上は DateTime のため、時刻部分を持つ)
    const effectiveStartTime = isAllDay ? "00:00" : startTime;
    const effectiveEndTime = isAllDay ? "" : endTime;

    const data: EventFormData = {
      title,
      description,
      eventDate: combine(eventDay, effectiveStartTime),
      eventEndDate: effectiveEndTime ? combine(eventDay, effectiveEndTime) : "",
      isAllDay,
      location,
      capacity,
      fee,
      feeVisible,
      deadline,
      deadlineEnabled,
      notifyMembers,
      categoryId,
      minViewRole,
      minRespondRole,
    };

    try {
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          タイトル <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={100}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="例: 12月練習会"
        />
      </div>

      <div>
        <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-1">
          種別
        </label>
        <select
          id="categoryId"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="">未指定</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          開催日 <span className="text-red-500">*</span>
        </label>
        {/* iOS Safari の native date 入力ははみ出しやすいため、3つの select で年/月/日を分割選択。 */}
        <div className="grid grid-cols-3 gap-2">
          <select
            aria-label="年"
            value={splitDay(eventDay).y}
            onChange={(e) => {
              const { m, d } = splitDay(eventDay);
              const y = e.target.value;
              if (y && m && d) {
                const maxD = daysInMonth(Number(y), Number(m));
                const newD = Math.min(Number(d), maxD);
                setEventDay(`${y}-${m}-${pad2(newD)}`);
              } else {
                setEventDay(y ? `${y}-${m || "01"}-${d || "01"}` : "");
              }
            }}
            required
            className="block w-full min-w-0 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
          >
            <option value="">年</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            aria-label="月"
            value={splitDay(eventDay).m}
            onChange={(e) => {
              const { y, d } = splitDay(eventDay);
              const m = e.target.value;
              if (y && m) {
                const maxD = daysInMonth(Number(y), Number(m));
                const newD = d ? Math.min(Number(d), maxD) : 1;
                setEventDay(`${y}-${pad2(Number(m))}-${pad2(newD)}`);
              } else {
                setEventDay(m ? `${y || NOW.getFullYear()}-${pad2(Number(m))}-${d || "01"}` : "");
              }
            }}
            required
            className="block w-full min-w-0 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
          >
            <option value="">月</option>
            {MONTH_OPTIONS.map((m) => (
              <option key={m} value={pad2(m)}>
                {m}
              </option>
            ))}
          </select>
          <select
            aria-label="日"
            value={splitDay(eventDay).d}
            onChange={(e) => {
              const { y, m } = splitDay(eventDay);
              const d = e.target.value;
              setEventDay(d ? `${y || NOW.getFullYear()}-${m || "01"}-${pad2(Number(d))}` : "");
            }}
            required
            className="block w-full min-w-0 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
          >
            <option value="">日</option>
            {(() => {
              const { y, m } = splitDay(eventDay);
              const max = y && m ? daysInMonth(Number(y), Number(m)) : 31;
              return Array.from({ length: max }, (_, i) => i + 1).map((d) => (
                <option key={d} value={pad2(d)}>
                  {d}
                </option>
              ));
            })()}
          </select>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={isAllDay}
            onChange={(e) => setIsAllDay(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          終日イベント
        </label>
        <p className="text-xs text-gray-500 mt-1 ml-6">
          合宿の日や大会日など、特定時刻を持たないイベントに使います。
        </p>
      </div>

      {!isAllDay && (
      <div className="space-y-3 min-w-0">
        <div className="min-w-0">
          <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
            開始時刻 <span className="text-red-500">*</span>
          </label>
          {fineTimeStep ? (
            <input
              type="time"
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="block w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <select
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="block w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">選択してください</option>
              {HALF_HOUR_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="min-w-0">
          <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
            終了時刻（任意）
          </label>
          {fineTimeStep ? (
            <input
              type="time"
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="block w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <select
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="block w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">指定しない</option>
              {HALF_HOUR_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={fineTimeStep}
            onChange={(e) => setFineTimeStep(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          1分単位で指定する（オフ時は30分刻み）
        </label>
      </div>
      )}

      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
          場所
        </label>
        <input
          type="text"
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={200}
          list="location-suggestions"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="例: ○○体育館"
        />
        {locationSuggestions.length > 0 && (
          <>
            <datalist id="location-suggestions">
              {locationSuggestions.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="text-xs text-gray-500 self-center">最近使用:</span>
              {locationSuggestions.slice(0, 5).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700"
                >
                  {loc}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          説明
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="イベントの詳細を入力"
        />
      </div>

      <div>
        <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-1">
          定員（空欄で無制限）
        </label>
        <input
          type="number"
          id="capacity"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          min={1}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="例: 20"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="feeVisible"
            checked={feeVisible}
            onChange={(e) => setFeeVisible(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="feeVisible" className="text-sm font-medium text-gray-700">
            参加費を表示する
          </label>
        </div>

        {feeVisible && (
          <div>
            <label htmlFor="fee" className="block text-sm font-medium text-gray-700 mb-1">
              参加費（円）
            </label>
            <input
              type="number"
              id="fee"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例: 500"
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="deadlineEnabled"
            checked={deadlineEnabled}
            onChange={(e) => setDeadlineEnabled(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="deadlineEnabled" className="text-sm font-medium text-gray-700">
            締め切りを設定する
          </label>
        </div>

        {deadlineEnabled && (
          <div>
            <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">
              締め切り日時
            </label>
            <input
              type="datetime-local"
              id="deadline"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      <div className="pt-2 space-y-3 border-t border-gray-100">
        <div>
          <label htmlFor="minViewRole" className="block text-sm font-medium text-gray-700 mb-1">
            閲覧できる最低ロール
          </label>
          <select
            id="minViewRole"
            value={minViewRole}
            onChange={(e) => setMinViewRole(e.target.value as "guest" | "visitor" | "member")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="guest">ゲスト以上 (全公開)</option>
            <option value="visitor">ビジター以上 (見学候補・ビジター・メンバー)</option>
            <option value="member">一般メンバー以上 (内部限定)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            このロール以上にだけイベントが見えます。管理者・副管理者は閾値に関わらず常に閲覧できます。
          </p>
        </div>

        <div>
          <label htmlFor="minRespondRole" className="block text-sm font-medium text-gray-700 mb-1">
            出欠回答できる最低ロール
          </label>
          <select
            id="minRespondRole"
            value={minRespondRole}
            onChange={(e) => setMinRespondRole(e.target.value as "visitor" | "member")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="visitor">ビジター以上</option>
            <option value="member">一般メンバー以上</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            このロール以上だけが出欠回答できます。ゲストは常に回答できません。
          </p>
        </div>
      </div>

      {showNotifyOption && (
        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="notifyMembers"
            checked={notifyMembers}
            onChange={(e) => setNotifyMembers(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="notifyMembers" className="text-sm font-medium text-gray-700">
            作成時にメンバーへLINE通知を送る
          </label>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" className="flex-1" onClick={() => router.back()}>
          キャンセル
        </Button>
        <Button type="submit" className="flex-1" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
