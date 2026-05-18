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
- 服装は動きやすいものでお越しください

## お問い合わせ

参加希望・見学希望の方は、公式 LINE までお気軽にご連絡ください。`;

async function getAboutContent(): Promise<string> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: "aboutPageContent" },
    });
    const v = row?.value?.trim();
    return v && v.length > 0 ? v : PLACEHOLDER;
  } catch {
    return PLACEHOLDER;
  }
}

export default async function AboutPage() {
  const content = await getAboutContent();

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
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
      </main>
    </div>
  );
}
