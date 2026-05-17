"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { SEVERITY_STYLE, Severity } from "@/lib/announcement";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  severity: string;
  publishedAt: string;
  createdBy: string | null;
}

export default function AnnouncementsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/announcements")
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setItems(json.data);
        })
        .finally(() => setLoading(false));
    }
  }, [status]);

  if (status === "loading") {
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
        <h1 className="text-xl font-bold text-gray-900 mb-4">お知らせ</h1>

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              お知らせはありません
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((a) => {
              const sev = (a.severity as Severity) || "info";
              const style = SEVERITY_STYLE[sev] ?? SEVERITY_STYLE.info;
              return (
                <Card key={a.id} className={`${style.bg} ${style.border} border`}>
                  <CardContent className="py-4">
                    <div id={a.id} className="flex items-center gap-2 mb-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${style.text} bg-white/60`}>
                        {style.label}
                      </span>
                      <span className="text-gray-500">
                        {format(new Date(a.publishedAt), "yyyy/M/d HH:mm", { locale: ja })}
                      </span>
                      {a.createdBy && (
                        <span className="text-gray-400">by {a.createdBy}</span>
                      )}
                    </div>
                    <h2 className="font-bold text-gray-900 mb-1">{a.title}</h2>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.body}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
