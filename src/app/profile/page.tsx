"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { RoleBadge } from "@/components/ui/Badge";

interface Profile {
  id: string;
  nickname: string;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  age: number | null;
  ageVisible: boolean;
  profileImageUrl: string | null;
  comment: string | null;
  role: string;
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
    age: "",
    ageVisible: true,
    comment: "",
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
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setFormData({
          nickname: data.data.nickname || "",
          firstName: data.data.firstName || "",
          lastName: data.data.lastName || "",
          gender: data.data.gender || "",
          age: data.data.age?.toString() || "",
          ageVisible: data.data.ageVisible ?? true,
          comment: data.data.comment || "",
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
          age: formData.age ? parseInt(formData.age) : null,
          ageVisible: formData.ageVisible,
          comment: formData.comment || null,
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

            {success && (
              <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
                プロフィールを更新しました
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
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  性別
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">選択してください</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                </select>
              </div>

              <div>
                <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                  年齢
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    id="age"
                    name="age"
                    value={formData.age}
                    onChange={handleChange}
                    min={0}
                    max={150}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      name="ageVisible"
                      checked={formData.ageVisible}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    年齢を公開する
                  </label>
                </div>
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

              <Button type="submit" className="w-full" loading={saving}>
                保存する
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
