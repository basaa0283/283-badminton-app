"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

interface EventMessage {
  id: string;
  content: string;
  targetType: string;
  sentAt: string;
  sender: { id: string; nickname: string; profileImageUrl: string | null };
}

interface EventMessagesProps {
  eventId: string;
  isAdmin: boolean;
}

const TARGET_LABEL: Record<string, string> = {
  attending: "参加確定者のみ",
  attending_or_undecided: "参加確定 + 未応答",
  all: "全員 (不参加者含む)",
};

const TARGET_BADGE_CLASS: Record<string, string> = {
  attending: "bg-green-100 text-green-800",
  attending_or_undecided: "bg-blue-100 text-blue-800",
  all: "bg-gray-100 text-gray-700",
};

const TARGET_OPTIONS = [
  { value: "attending", label: TARGET_LABEL.attending },
  { value: "attending_or_undecided", label: TARGET_LABEL.attending_or_undecided },
  { value: "all", label: TARGET_LABEL.all },
];

/**
 * 当日連絡機能 (単方向): 管理者からのメッセージをイベント参加者に表示する。
 * LINE 通知は送らずアプリ内表示のみ。
 */
export function EventMessages({ eventId, isAdmin }: EventMessagesProps) {
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [targetType, setTargetType] = useState("attending_or_undecided");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async () => {
    const res = await fetch(`/api/events/${eventId}/messages`);
    const json = await res.json();
    if (json.success) setMessages(json.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [eventId]);

  const handlePost = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), targetType }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "投稿に失敗しました");
        return;
      }
      setContent("");
      await fetchMessages();
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-gray-500">読み込み中...</p>
        </CardContent>
      </Card>
    );
  }

  // 管理者でも一般でも、メッセージが 1 件も無く投稿権限も無ければ非表示
  if (messages.length === 0 && !isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-gray-900">当日のお知らせ</h2>
        <p className="text-xs text-gray-500 mt-1">
          管理者からの連絡がここに出ます (LINE 通知は送られません)
        </p>
      </CardHeader>
      <CardContent>
        {isAdmin && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="例: 体育館の受付完了しました、13:00 開始です"
              rows={3}
              maxLength={2000}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-gray-600 shrink-0">対象:</label>
              <div className="min-w-[10rem] flex-1">
                <Select
                  value={targetType}
                  onChange={setTargetType}
                  options={TARGET_OPTIONS}
                />
              </div>
              <Button
                size="sm"
                onClick={handlePost}
                loading={posting}
                disabled={!content.trim()}
              >
                投稿
              </Button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">まだお知らせはありません</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className="border-b border-gray-100 pb-2 last:border-b-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {m.sender.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.sender.profileImageUrl}
                      alt=""
                      className="w-5 h-5 rounded-full"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px]">
                      {m.sender.nickname[0]}
                    </div>
                  )}
                  <span className="text-xs font-medium text-gray-700">
                    {m.sender.nickname}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${TARGET_BADGE_CLASS[m.targetType] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {TARGET_LABEL[m.targetType] ?? m.targetType}
                  </span>
                  <span className="flex-1" />
                  <span className="text-[11px] text-gray-400">
                    {new Date(m.sentAt).toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{m.content}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
