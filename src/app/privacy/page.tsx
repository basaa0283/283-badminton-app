import Link from "next/link";

export const metadata = {
  title: "プライバシーポリシー | 283バドミントン",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-4">
          <Link href="/" className="text-blue-600 text-sm hover:underline">
            ← ホームに戻る
          </Link>
        </div>

        <article className="bg-white rounded-lg shadow p-6 space-y-4 text-sm text-gray-800 leading-relaxed">
          <h1 className="text-xl font-bold text-gray-900">プライバシーポリシー</h1>

          <p>
            本アプリ「２８ばど 出欠管理」（以下「本アプリ」）は、バドミントンサークル「２８ばど」（以下「当サークル」）
            のメンバー向け内部利用を目的としたサービスです。本ポリシーでは、本アプリで取得・利用する情報の取り扱いを定めます。
          </p>

          <section className="space-y-2">
            <h2 className="font-bold">1. 取得する情報</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>LINEログインで取得する情報: LINE ユーザーID、表示名、プロフィール画像URL</li>
              <li>ユーザーが入力した情報: ニックネーム、生年月日、性別、コメント等</li>
              <li>イベントへの出欠回答および履歴</li>
              <li>アプリの操作に伴うタイムスタンプ</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">2. 利用目的</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>イベントの出欠管理および参加者一覧の表示</li>
              <li>会計（参加費の受領記録）</li>
              <li>LINE Messaging API による通知（イベント案内、リマインダー等）</li>
              <li>アプリの不具合調査・改善</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">3. 第三者提供</h2>
            <p>取得した情報を第三者に提供することはありません（法令に基づく場合を除く）。</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">4. 情報の管理</h2>
            <p>
              情報は Microsoft Azure 上に保管し、必要な範囲のみアクセスできるよう管理します。
              不要となった情報は削除します。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">5. ユーザーの権利</h2>
            <p>
              ご自身のプロフィール情報は本アプリの「プロフィール」画面からいつでも変更可能です。
              退会・データ削除を希望する場合は管理者までご連絡ください。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">6. 改定</h2>
            <p>
              本ポリシーは必要に応じて改定します。重要な変更はアプリ内のお知らせでお伝えします。
            </p>
          </section>

          <p className="text-xs text-gray-500 pt-4">最終更新日: 2026-05-17</p>
        </article>
      </main>
    </div>
  );
}
