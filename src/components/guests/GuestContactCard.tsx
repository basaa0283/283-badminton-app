"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";

/**
 * ゲスト (閲覧専用ロール) 向けの「興味があれば公式 LINE へ」カード。
 *
 * - SystemSetting.officialLineUrl が未設定なら何も表示しない。
 * - /api/site-info から URL を取得する (認証不要)。
 */
export function GuestContactCard() {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    fetch("/api/site-info")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setUrl(json.data.officialLineUrl || "");
      })
      .catch(() => {});
  }, []);

  if (!url) return null;

  return (
    <Card>
      <CardContent className="py-5 text-center space-y-3">
        <p className="text-sm text-gray-700">
          このサークルに興味がある方は、公式 LINE からお気軽にご連絡ください。
        </p>
        <a
          href={url}
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
          公式 LINE でお問い合わせ
        </a>
      </CardContent>
    </Card>
  );
}
