"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { RoleBadge } from "@/components/ui/Badge";
import { BirthdateInput } from "@/components/ui/BirthdateInput";
import { Select } from "@/components/ui/Select";
import Link from "next/link";
import { TournamentResultsSection } from "@/components/tournaments/TournamentResultsSection";
import { TournamentSummarySection } from "@/components/tournaments/TournamentSummarySection";
import { permissions, UserRole } from "@/lib/permissions";

interface Profile {
  id: string;
  nickname: string;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  birthdate: string | null;
  age: number | null;
  ageVisible: boolean;
  profileImageUrl: string | null;
  comment: string | null;
  role: string;
  tournamentResultsPublic: boolean;
  // メール通知 (任意登録)
  notifyEmail: string | null;
  notifyEmailVerifiedAt: string | null;
  notifyOnNewEvent: boolean;
  notifyOnAnnouncement: boolean;
  notifyOnReminder: boolean;
  notifyOnEventMessage: boolean;
}

type NotifyKey =
  | "notifyOnNewEvent"
  | "notifyOnAnnouncement"
  | "notifyOnReminder"
  | "notifyOnEventMessage";

const NOTIFY_SWITCH_ITEMS: { key: NotifyKey; label: string }[] = [
  { key: "notifyOnNewEvent", label: "新規イベント" },
  { key: "notifyOnAnnouncement", label: "お知らせ" },
  { key: "notifyOnReminder", label: "リマインダー" },
  { key: "notifyOnEventMessage", label: "当日連絡" },
];

function Toggle({ enabled, disabled, onToggle }: { enabled: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        enabled ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// メール通知セクション。3 状態: 未登録 / 確認待ち / 確認済み。
// スイッチ変更は保存ボタンなしで即時 PUT する。
function EmailNotifySection({
  profile,
  onUpdated,
}: {
  profile: Profile;
  onUpdated: (patch: Partial<Profile>) => void;
}) {
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [toggling, setToggling] = useState<NotifyKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registerEmail = async (email: string) => {
    if (sending) return;
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/profile/notify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || "確認メールの送信に失敗しました");
      }
      onUpdated({ notifyEmail: data.data.notifyEmail, notifyEmailVerifiedAt: null });
      setEmailInput("");
      setMessage("確認メールを送りました。メール内のリンクを開くと有効になります");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSending(false);
    }
  };

  const removeEmail = async () => {
    if (removing) return;
    if (!confirm("メール通知の登録を解除しますか？")) return;
    setRemoving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/profile/notify-email", { method: "DELETE" });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || "登録の解除に失敗しました");
      }
      onUpdated({ notifyEmail: null, notifyEmailVerifiedAt: null });
      setMessage("登録を解除しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setRemoving(false);
    }
  };

  const toggleSetting = async (key: NotifyKey) => {
    if (toggling) return;
    setToggling(key);
    setError(null);
    try {
      const res = await fetch("/api/profile/notify-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: !profile[key] }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || "設定の変更に失敗しました");
      }
      onUpdated(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setToggling(null);
    }
  };

  const verified = !!profile.notifyEmailVerifiedAt;

  return (
    <Card className="mt-4">
      <CardHeader>
        <h2 className="text-lg font-bold text-gray-900">メール通知</h2>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
            {message}
          </div>
        )}

        {!profile.notifyEmail && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              イベント追加やお知らせをメールでも受け取れます (任意)
            </p>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              maxLength={254}
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Button
              onClick={() => registerEmail(emailInput.trim())}
              disabled={!emailInput.trim()}
              loading={sending}
              className="w-full"
            >
              確認メールを送る
            </Button>
          </div>
        )}

        {profile.notifyEmail && !verified && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              確認待ち: <span className="font-medium">{profile.notifyEmail}</span>
            </p>
            <p className="text-xs text-gray-500">
              確認メール内のリンクを開くと有効になります (有効期限: 24時間)
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => registerEmail(profile.notifyEmail!)}
                loading={sending}
                className="flex-1"
              >
                確認メールを再送
              </Button>
              <Button
                variant="secondary"
                onClick={removeEmail}
                loading={removing}
                className="flex-1"
              >
                登録を解除
              </Button>
            </div>
          </div>
        )}

        {profile.notifyEmail && verified && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              通知先: <span className="font-medium">{profile.notifyEmail}</span>
            </p>
            <div className="space-y-3">
              {NOTIFY_SWITCH_ITEMS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{label}</span>
                  <Toggle
                    enabled={profile[key]}
                    disabled={toggling !== null}
                    onToggle={() => toggleSetting(key)}
                  />
                </div>
              ))}
            </div>
            <Button
              variant="secondary"
              onClick={removeEmail}
              loading={removing}
              className="w-full"
            >
              登録を解除
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function isoToDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    nickname: "",
    firstName: "",
    lastName: "",
    gender: "",
    birthdate: "",
    ageVisible: true,
    comment: "",
    tournamentResultsPublic: false,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile?fromPage=1");
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setFormData({
          nickname: data.data.nickname || "",
          firstName: data.data.firstName || "",
          lastName: data.data.lastName || "",
          gender: data.data.gender || "",
          birthdate: isoToDay(data.data.birthdate),
          ageVisible: data.data.ageVisible ?? true,
          comment: data.data.comment || "",
          tournamentResultsPublic: data.data.tournamentResultsPublic ?? false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: formData.nickname,
          firstName: formData.firstName || null,
          lastName: formData.lastName || null,
          gender: formData.gender || null,
          birthdate: formData.birthdate
            ? new Date(`${formData.birthdate}T00:00:00`).toISOString()
            : null,
          ageVisible: formData.ageVisible,
          comment: formData.comment || null,
          tournamentResultsPublic: formData.tournamentResultsPublic,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error?.message || "プロフィールの更新に失敗しました");
      }

      setProfile(data.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              {profile?.profileImageUrl ? (
                <img
                  src={profile.profileImageUrl}
                  alt=""
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-2xl">
                    {profile?.nickname?.[0] || "?"}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">プロフィール編集</h1>
                <div className="mt-1">
                  <RoleBadge role={profile?.role || "guest"} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
                  ニックネーム <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nickname"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  required
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">他のメンバーに表示される名前です</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    姓（非公開）
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    maxLength={50}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    名（非公開）
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    maxLength={50}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  性別
                </label>
                <Select
                  value={formData.gender}
                  onChange={(v) => setFormData((prev) => ({ ...prev, gender: v }))}
                  options={[
                    { value: "", label: "選択してください" },
                    { value: "male", label: "男性" },
                    { value: "female", label: "女性" },
                  ]}
                  placeholder="選択してください"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  生年月日
                </label>
                <BirthdateInput
                  value={formData.birthdate}
                  onChange={(v) => setFormData((prev) => ({ ...prev, birthdate: v }))}
                />
                {profile?.age !== null && profile?.age !== undefined && (
                  <p className="mt-1 text-xs text-gray-500">現在 {profile.age} 歳</p>
                )}
                <label className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                  <input
                    type="checkbox"
                    name="ageVisible"
                    checked={formData.ageVisible}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  生年月日・年齢を他のメンバーに公開する
                </label>
              </div>

              <div>
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
                  一言コメント
                </label>
                <textarea
                  id="comment"
                  name="comment"
                  value={formData.comment}
                  onChange={handleChange}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="自己紹介など"
                />
                <div className="text-xs text-gray-500 text-right mt-1">
                  {formData.comment.length}/500
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="tournamentResultsPublic"
                    checked={formData.tournamentResultsPublic}
                    onChange={handleChange}
                    className="w-4 h-4"
                  />
                  <span>大会実績サマリをサークル内に公開する</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  オン (デフォルト OFF) にすると、登録した <strong>全成績</strong> の集計 (種目 × Tier × メダル数 のサマリ) が、他のメンバーのプロフィール画面で見えるようになります。
                  個別の大会成績の公開は、成績ごとに別途「この成績を公開する」のチェックで設定します。
                </p>
              </div>

              {success && (
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
                  プロフィールを更新しました
                </div>
              )}

              <Button type="submit" className="w-full" loading={saving}>
                保存する
              </Button>
            </form>
          </CardContent>
        </Card>

        {profile && (
          <EmailNotifySection
            profile={profile}
            onUpdated={(patch) =>
              setProfile((prev) => (prev ? { ...prev, ...patch } : prev))
            }
          />
        )}

        {session?.user &&
          permissions.canViewTournaments(session.user.role as UserRole) && (
            <>
              <div className="mt-4 text-sm">
                <Link
                  href={`/members/${session.user.id}?preview=1`}
                  className="text-blue-600 hover:underline"
                >
                  外から見える状態を確認 →
                </Link>
              </div>
              <div className="mt-4">
                <TournamentResultsSection userId={session.user.id} />
              </div>
              <div className="mt-4">
                <TournamentSummarySection userId={session.user.id} />
              </div>
            </>
          )}
      </main>
    </div>
  );
}
