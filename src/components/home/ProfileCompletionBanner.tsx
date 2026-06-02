"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";

interface Profile {
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  birthdate: string | null;
}

// ホーム画面で表示するプロフィール未入力誘導バナー。
// 性別 / 生年月日 / 姓 / 名 のいずれかが空の場合に表示する。
// 入力されたら自動で消える (閉じるボタンは設けない)。
export function ProfileCompletionBanner() {
  const { status } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setProfile({
            firstName: json.data.firstName ?? null,
            lastName: json.data.lastName ?? null,
            gender: json.data.gender ?? null,
            birthdate: json.data.birthdate ?? null,
          });
        }
      })
      .catch(() => {
        // 取得失敗時はバナーを出さない (押し付け感を避ける)
      });
  }, [status]);

  if (!profile) return null;

  const missing: string[] = [];
  if (!profile.lastName?.trim() && !profile.firstName?.trim()) missing.push("氏名");
  if (!profile.gender) missing.push("性別");
  if (!profile.birthdate) missing.push("生年月日");

  if (missing.length === 0) return null;

  return (
    <Card className="mb-4 border border-amber-300 bg-amber-50">
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">
              プロフィールに未入力の項目があります
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              未入力: {missing.join(" / ")}
            </p>
          </div>
          <Link
            href="/profile"
            className="shrink-0 text-xs font-medium text-amber-900 underline hover:no-underline whitespace-nowrap"
          >
            完成させる →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
