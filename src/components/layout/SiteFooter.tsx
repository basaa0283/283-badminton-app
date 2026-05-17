"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function getEnvSuffix(): string {
  // 環境変数の判定はサーバー側で組み立て済みのため、ここでは何もしない。
  return "";
}

interface SiteFooterProps {
  version: string;
  envSuffix: string;
}

export function SiteFooter({ version, envSuffix }: SiteFooterProps) {
  const [officialLineUrl, setOfficialLineUrl] = useState<string>("");

  useEffect(() => {
    fetch("/api/site-info")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setOfficialLineUrl(json.data.officialLineUrl || "");
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="mt-8 border-t border-gray-200 bg-white">
      <div className="max-w-4xl mx-auto px-4 py-4 text-xs text-gray-500 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {officialLineUrl ? (
            <a
              href={officialLineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-700 hover:underline"
            >
              公式 LINE
            </a>
          ) : (
            <span className="text-gray-300">公式 LINE</span>
          )}
          <span className="text-gray-300">|</span>
          <Link href="/privacy" className="hover:text-gray-700 hover:underline">
            プライバシーポリシー
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/terms" className="hover:text-gray-700 hover:underline">
            利用規約
          </Link>
        </div>
        <div className="text-center text-gray-400">
          ２８ばど 出欠管理 v{version}{envSuffix}
        </div>
      </div>
    </footer>
  );
}

export { getEnvSuffix };
