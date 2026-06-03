import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { RELEASE_NOTES } from "@/lib/release-notes";
import { LogPageView } from "@/components/analytics/LogPageView";

export const metadata = {
  title: "更新履歴 | 283バドミントン",
};

const LABEL_STYLE: Record<string, string> = {
  重要な変更: "bg-red-100 text-red-800 border-red-200",
  新機能: "bg-blue-100 text-blue-800 border-blue-200",
  改善: "bg-green-100 text-green-800 border-green-200",
  修正: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function ReleaseNotesPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <LogPageView action="release_notes.view" />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-4">
          <Link href="/" className="text-blue-600 text-sm hover:underline">
            ← ホームに戻る
          </Link>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-4">更新履歴</h1>
        <p className="text-sm text-gray-600 mb-6">
          ２８ばど 出欠管理アプリのアップデート内容です。最新が上に並んでいます。
        </p>

        <div className="space-y-6">
          {RELEASE_NOTES.map((note) => (
            <article key={note.version} className="bg-white rounded-lg shadow">
              <header className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-base font-bold text-gray-900">
                    v{note.version}
                    {note.title && (
                      <span className="ml-2 text-sm font-normal text-gray-600">
                        {note.title}
                      </span>
                    )}
                  </h2>
                  <time className="text-xs text-gray-500">
                    {format(new Date(note.date), "yyyy年M月d日", { locale: ja })}
                  </time>
                </div>
              </header>
              <div className="px-4 py-4 space-y-4 text-sm">
                {note.highlights.map((section) => (
                  <section key={section.label}>
                    <span
                      className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${
                        LABEL_STYLE[section.label] ?? LABEL_STYLE["修正"]
                      } mb-2`}
                    >
                      {section.label}
                    </span>
                    <ul className="list-disc pl-5 space-y-1 text-gray-800">
                      {section.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
