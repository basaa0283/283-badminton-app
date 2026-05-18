import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Markdown } from "@/components/ui/Markdown";

export const metadata = {
  title: "サークルについて | 283バドミントン",
};

// 認証不要。未ログインのゲスト候補者からも見られる。
export const dynamic = "force-dynamic";

const PLACEHOLDER = `# ２８ばど について

ここにサークルの紹介を記入してください (管理者が \`/admin/about\` から編集できます)。

## 例: 練習の流れ

- アップ
- 基礎打ち
- ゲーム

## 例: ご参加にあたって

- 初心者・経験者問わず歓迎です
- 服装は動きやすいものでお越しください`;

interface AboutData {
  content: string;
  officialLineUrl: string;
}

// SystemSetting から本文と公式 LINE URL をまとめて取得する。
// 公式 LINE は管理画面で一元管理しているため、/about の本文内で URL を直書きせず、
// ページ末尾の CTA カードでこの値を参照する (二重管理回避)。
async function getAboutData(): Promise<AboutData> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["aboutPageContent", "officialLineUrl"] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const content = map.aboutPageContent?.trim();
    return {
      content: content && content.length > 0 ? content : PLACEHOLDER,
      officialLineUrl: map.officialLineUrl ?? "",
    };
  } catch {
    return { content: PLACEHOLDER, officialLineUrl: "" };
  }
}

function LineContactCard({ url }: { url: string }) {
  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-2">お問い合わせ</h2>
      <p className="text-sm text-gray-700 mb-4">
        ご参加・見学希望の方は、公式 LINE までお気軽にご連絡ください。
      </p>
      {url ? (
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
          公式 LINE を開く
        </a>
      ) : (
        <p className="text-xs text-gray-500">
          (公式 LINE の URL が管理画面で未設定です)
        </p>
      )}
    </section>
  );
}

export default async function AboutPage() {
  const { content, officialLineUrl } = await getAboutData();

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-blue-600 text-sm hover:underline">
            ← ホームに戻る
          </Link>
          <Link href="/login" className="text-blue-600 text-sm hover:underline">
            ログイン →
          </Link>
        </div>

        <article className="bg-white rounded-lg shadow p-6">
          <Markdown source={content} />
        </article>

        <LineContactCard url={officialLineUrl} />
      </main>
    </div>
  );
}
