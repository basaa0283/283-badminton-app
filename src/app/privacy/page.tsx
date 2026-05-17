import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";

export const metadata = {
  title: "プライバシーポリシー | 283バドミントン",
};

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

export default async function PrivacyPage() {
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
          <h1 className="text-xl font-bold text-gray-900">プライバシーポリシー</h1>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-900 text-sm">
            <p className="font-bold mb-1">本アプリは現在ベータ版です</p>
            <p>
              ベータ期間中はサービスの予告なき停止やデータの初期化・削除が発生する可能性があります。
              ご了承の上ご利用ください。
            </p>
          </div>

          <p>
            本アプリ「２８ばど 出欠管理」（以下「本アプリ」）は、バドミントンサークル「２８ばど」（以下「当サークル」）
            のメンバー向け内部利用を目的としたサービスです。本ポリシーでは、本アプリで取得・利用する情報の取り扱いを定めます。
          </p>

          <section className="space-y-2">
            <h2 className="font-bold">1. 取得する情報</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>LINEログインで取得する情報: LINE ユーザーID、表示名、プロフィール画像URL</li>
              <li>ユーザーが入力した情報: ニックネーム、姓名、生年月日、性別、コメント等</li>
              <li>イベントへの出欠回答および履歴</li>
              <li>参加費の受領記録 (支払額・支払日時等)</li>
              <li>利用規約・プライバシーポリシーへの同意記録 (同意日時・同意したバージョン)</li>
              <li>アプリの操作に伴うタイムスタンプ (最終操作日時等)</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">2. 利用目的</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>イベントの出欠管理および参加者一覧の表示</li>
              <li>会計（参加費の受領記録）</li>
              <li>LINE Messaging API による通知（イベント案内、リマインダー等）</li>
              <li>規約・PP の改定時の再同意確認</li>
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
              不要となった情報は削除します。なおベータ期間中は試験運用の都合により、
              予告なくデータの初期化・削除を行う場合があります。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">5. ユーザーの権利</h2>
            <p>
              ご自身のプロフィール情報は本アプリの「プロフィール」画面からいつでも変更可能です。
              退会・データ削除を希望する場合は、下記の連絡先までご連絡ください。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">6. 改定</h2>
            <p>
              本ポリシーは必要に応じて改定します。重要な変更はアプリ内のお知らせでお伝えします。
              改定後は、次回アクセス時に改めて同意画面を表示します。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">7. お問い合わせ</h2>
            <p>
              個人情報の取り扱いに関するご質問は、以下までご連絡ください。
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
