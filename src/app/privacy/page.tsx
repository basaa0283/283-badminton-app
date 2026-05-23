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

          <p>
            本アプリ「２８ばど 出欠管理」（以下「本アプリ」）は、バドミントンサークル「２８ばど」（以下「当サークル」）
            のメンバー向け内部利用を目的としたサービスです。本ポリシーでは、本アプリで取得・利用する情報の取り扱いを定めます。
          </p>

          <section className="space-y-2">
            <h2 className="font-bold">1. 取得する情報</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>LINE ログインで取得する情報: LINE ユーザー ID、表示名、プロフィール画像 URL</li>
              <li>ユーザーが入力した情報: ニックネーム、姓名、生年月日、性別、コメント等</li>
              <li>イベントへの出欠回答および履歴</li>
              <li>参加費の受領記録 (支払額・支払日時等)</li>
              <li>大会実績情報 (大会名、開催日、種目、クラス、順位、相方として入力された氏名、メモ等)</li>
              <li>利用規約・プライバシーポリシーへの同意記録 (同意日時・同意したバージョン)</li>
              <li>アプリの操作に伴うタイムスタンプ (最終操作日時等)</li>
              <li>運用上のログ (エラー情報、利用状況など。アプリの改善・障害対応のために収集)</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">2. 利用目的</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>イベントの出欠管理および参加者一覧の表示</li>
              <li>会計（参加費の受領記録）</li>
              <li>LINE Messaging API によるアプリから LINE への通知（イベント案内、リマインダー、承認通知等）</li>
              <li>大会実績のメンバー間共有 (公開設定に従う)</li>
              <li>規約・PP の改定時の再同意確認</li>
              <li>アプリの不具合調査・改善</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">3. 第三者の情報の取り扱い</h2>
            <p>
              大会実績の「相方名」など、ユーザー本人以外の氏名を入力する箇所があります。
              当該情報を入力するユーザーは、入力対象者から事前の了承を得てください。
              本人の同意なく第三者の情報を入力することは利用規約で禁止しています。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">4. 第三者提供</h2>
            <p>取得した情報を第三者に提供することはありません（法令に基づく場合を除く）。</p>
            <p>
              なお本アプリは LINE Messaging API、Azure (Microsoft) 等の外部サービス上で動作しており、
              通信・保管にあたって各サービスのプライバシーポリシーが併せて適用されます。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">5. 情報の管理</h2>
            <p>
              情報は Microsoft Azure 上に保管し、必要な範囲のみアクセスできるよう管理します。
              不要となった情報は削除します。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">6. ユーザーの権利</h2>
            <p>
              ご自身のプロフィール情報は本アプリの「プロフィール」画面からいつでも変更可能です。
              大会実績の公開設定もプロフィール画面から切り替えられます。
              退会・データ削除を希望する場合は、下記の連絡先までご連絡ください。管理者が手続きを行います。
              なお、過去の出欠履歴・大会実績などは、サークル運営の参考情報として匿名化したうえで保持する場合があります。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">7. 未成年者の取り扱い</h2>
            <p>
              本アプリを利用される方が未成年の場合、保護者の同意を得たうえでご利用ください。
              未成年者本人が同意手続きを行った場合、保護者の同意があったものとみなします。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">8. 改定</h2>
            <p>
              本ポリシーは必要に応じて改定します。重要な変更はアプリ内のお知らせでお伝えします。
              改定後は、次回アクセス時に改めて同意画面を表示します。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">9. お問い合わせ</h2>
            <p>
              個人情報の取り扱いに関するご質問は、以下までご連絡ください。
            </p>
            <p>
              連絡先: <ContactLink url={officialLineUrl} />
            </p>
          </section>

          <p className="text-xs text-gray-500 pt-4">
            最終更新日: 2026-05-23 / バージョン: {CURRENT_TERMS_VERSION}
          </p>
        </article>
      </main>
    </div>
  );
}
