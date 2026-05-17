"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { SEVERITY_STYLE, Severity } from "@/lib/announcement";

interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: string;
  publishedAt: string;
}

export function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    fetch("/api/announcements")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setItems(json.data.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {items.map((a) => {
        const sev = (a.severity as Severity) || "info";
        const style = SEVERITY_STYLE[sev] ?? SEVERITY_STYLE.info;
        return (
          <Link
            key={a.id}
            href={`/announcements#${a.id}`}
            className={`block rounded-lg border ${style.bg} ${style.border} px-3 py-2`}
          >
            <div className="flex items-center gap-2 text-xs">
              <span className={`font-bold ${style.text}`}>[{style.label}]</span>
              <span className="text-gray-500">
                {format(new Date(a.publishedAt), "M/d", { locale: ja })}
              </span>
              <span className="font-medium text-gray-900 truncate">{a.title}</span>
            </div>
          </Link>
        );
      })}
      {items.length > 0 && (
        <div className="text-right">
          <Link href="/announcements" className="text-xs text-blue-600 hover:underline">
            すべてのお知らせを見る →
          </Link>
        </div>
      )}
    </div>
  );
}
