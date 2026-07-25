import nodemailer from "nodemailer";

// メール通知 (任意登録ユーザー向け) の送信基盤。
// 設計: docs/superpowers/specs/2026-07-25-email-notification-design.md
//
// 現在は既存の管理者通知 (src/lib/email.ts) と同じ Gmail SMTP を使う。
// Gmail の送信上限は 500 通/日。超過が見えたら sendEmail の実装だけを
// 別サービス (SendGrid / Azure Communication Services 等) に差し替える。

interface SendEmailArgs {
  to: string;
  subject: string;
  body: string;
}

/**
 * 汎用メール送信。transport の生成はこの関数に閉じ込める (将来差し替え可能に)。
 * - GMAIL_USER / GMAIL_APP_PASSWORD 未設定なら warn して false。
 * - 送信失敗は log して false (本筋のフローを止めない)。
 */
export async function sendEmail({ to, subject, body }: SendEmailArgs): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn("[notify-email] GMAIL_USER / GMAIL_APP_PASSWORD 未設定。メール送信スキップ。");
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `２８ばど <${user}>`,
      to,
      subject,
      text: body,
    });
    return true;
  } catch (err) {
    console.error("[notify-email] 送信失敗:", err);
    return false;
  }
}

/**
 * メール通知登録時の確認メールを送る。
 * リンククリック (ページ側で POST /api/email/verify) で有効化される。
 */
export async function sendVerificationEmail(to: string, token: string): Promise<boolean> {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/email/verify?token=${token}`;
  const body =
    `２８ばどのメール通知に、このメールアドレスが登録されました。\n\n` +
    `下記のリンクを開いて、メール通知を有効にしてください (有効期限: 24時間):\n\n` +
    `${verifyUrl}\n\n` +
    `心当たりがない場合は、このメールは破棄してください (何も起こりません)。\n\n` +
    `--\n２８ばど`;

  return sendEmail({
    to,
    subject: "【２８ばど】メール通知の確認",
    body,
  });
}

/**
 * 通知メール本文の末尾に付ける共通フッター (配信停止リンク付き)。
 * M2 の一括送信で全通知メールに付与する。
 */
export function buildFooter(unsubscribeToken: string): string {
  const unsubscribeUrl = `${process.env.NEXTAUTH_URL}/email/unsubscribe?token=${unsubscribeToken}`;
  return (
    `\n\n--\n２８ばど\n` +
    `メール通知の停止はこちら:\n${unsubscribeUrl}\n` +
    `(通知の種類ごとの設定はアプリのプロフィール画面から変更できます)`
  );
}
