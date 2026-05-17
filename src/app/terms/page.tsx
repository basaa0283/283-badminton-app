import Link from "next/link";

export const metadata = {
  title: "利用規約 | 283バドミントン",
};

export default function TermsPage() {
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

          <p>
            本利用規約は、バドミントンサークル「２８ばど」（以下「当サークル」）が提供する
            「２８ばど 出欠管理」アプリ（以下「本アプリ」）の利用条件を定めるものです。
          </p>

          <section className="space-y-2">
            <h2 className="font-bold">1. 利用範囲</h2>
            <p>
              本アプリは当サークルのメンバーおよび当サークルが許可した方のみが利用できます。
              利用にあたっては、本規約のほかプライバシーポリシーに同意したものとみなします。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">2. アカウント</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>ログインは LINE 連携を基本とします。</li>
              <li>登録情報は正確に保つようご協力ください。</li>
              <li>アカウントを他者に貸与・譲渡しないでください。</li>
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
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">5. 規約の変更</h2>
            <p>
              本規約は必要に応じて変更します。重要な変更はアプリ内のお知らせでお伝えします。
              変更後の規約は、アプリ内に掲示した時点から効力を生じます。
            </p>
          </section>

          <p className="text-xs text-gray-500 pt-4">最終更新日: 2026-05-17</p>
        </article>
      </main>
    </div>
  );
}
