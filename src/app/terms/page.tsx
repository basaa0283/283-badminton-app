import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";

export const metadata = {
  title: "利用規約 | 283バドミントン",
};

// 動的にする (毎リクエストで officialLineUrl を取りに行く)。
export const dynamic = "force-dynamic";

async function getOfficialLineUrl(): Promise<string> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: "officialLineUrl" },
    });
    return row?.value ?? "";
  } catch {
    return "";
  }
}

function ContactLink({ url }: { url: string }) {
  if (!url) {
    return (
      <span className="text-gray-600">
        公式 LINE (管理者へお問い合わせください)
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline"
    >
      公式 LINE ↗
    </a>
  );
}

export default async function TermsPage() {
  const officialLineUrl = await getOfficialLineUrl();

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-4">
          <Link href="/" className="text-blue-600 text-sm hover:underline">
            ← ホームに戻る
          </Link>
        </div>

        <article className="bg-white rounded-lg shadow p-6 space-y-4 text-sm text-gray-800 leading-relaxed">
          <h1 className="text-xl font-bold text-gray-900">利用規約</h1>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-900 text-sm">
            <p className="font-bold mb-1">本アプリは現在ベータ版です</p>
            <p>
              機能・仕様の予告なき変更、一時的な障害、データの消失等が発生する可能性があります。
              ご了承の上ご利用ください。
            </p>
          </div>

          <p>
            本利用規約は、バドミントンサークル「２８ばど」（以下「当サークル」）が提供する
            「２８ばど 出欠管理」アプリ（以下「本アプリ」）の利用条件を定めるものです。
          </p>

          <section className="space-y-2">
            <h2 className="font-bold">1. 利用範囲</h2>
            <p>
              本アプリは当サークルのメンバー、当サークルが招待した方、および当サークルが許可した閲覧者（ゲスト）
              のみが利用できます。利用にあたっては、本規約のほかプライバシーポリシーに同意したものとみなします。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">2. アカウント</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>ログインは LINE 連携を基本とします。</li>
              <li>登録情報は正確に保つようご協力ください。</li>
              <li>アカウントを他者に貸与・譲渡しないでください。</li>
              <li>
                退会・アカウント削除を希望する場合は、下記の連絡先までご連絡ください。管理者が削除手続きを行います。
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">3. 禁止事項</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>虚偽の出欠登録や他メンバーへの嫌がらせ</li>
              <li>本アプリの脆弱性を意図的に突く行為</li>
              <li>取得した他メンバーの情報を当サークル外で利用する行為</li>
              <li>その他、当サークルの運営に支障をきたす行為</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">4. 免責</h2>
            <p>
              本アプリは当サークル運営の便宜のため提供されるものであり、可用性・正確性を保証するものではありません。
              本アプリの利用または利用不能によって生じた損害について、運営者は一切の責任を負いません。
              特にベータ期間中はサービスの予告なき停止やデータの初期化が発生する可能性があります。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">5. 規約の変更</h2>
            <p>
              本規約は必要に応じて変更します。重要な変更はアプリ内のお知らせでお伝えします。
              変更後の規約は、アプリ内に掲示した時点から効力を生じます。
              規約のバージョンが上がった場合、次回アクセス時に改めて同意画面を表示します。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">6. お問い合わせ</h2>
            <p>
              本規約に関するご質問・退会のご依頼などは、以下までご連絡ください。
            </p>
            <p>
              連絡先: <ContactLink url={officialLineUrl} />
            </p>
          </section>

          <p className="text-xs text-gray-500 pt-4">
            最終更新日: 2026-05-17 / バージョン: {CURRENT_TERMS_VERSION}
          </p>
        </article>
      </main>
    </div>
  );
}
