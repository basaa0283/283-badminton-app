import nodemailer from "nodemailer";
import { prisma } from "./prisma";

/**
 * 管理者通知メールの宛先を SystemSetting から取得する。
 *   - キー: `contactEmail` (元はフッターのお問い合わせ用だったが、表向き連絡は
 *     公式 LINE 一本にしたので、現在は管理者通知の宛先としてのみ利用)。
 *   - 未設定 / 取得失敗時は空文字。空のときはメール送信を行わない。
 */
async function getAdminNotifyEmail(): Promise<string> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: "contactEmail" },
    });
    return row?.value?.trim() ?? "";
  } catch {
    return "";
  }
}

interface SendArgs {
  subject: string;
  body: string;
}

/**
 * Gmail SMTP 経由で管理者通知メールを送る。
 * - GMAIL_USER / GMAIL_APP_PASSWORD 環境変数が必要 (Azure App Service の設定で投入)。
 * - 宛先は SystemSetting.contactEmail。未設定なら no-op。
 * - 例外は log して握り潰す (本筋のフローを止めない)。
 */
export async function sendAdminNotification({ subject, body }: SendArgs): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn("[email] GMAIL_USER / GMAIL_APP_PASSWORD 未設定。メール送信スキップ。");
    return;
  }

  const to = await getAdminNotifyEmail();
  if (!to) {
    console.warn("[email] SystemSetting.contactEmail 未設定。メール送信スキップ。");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `283-badminton-app <${user}>`,
      to,
      subject,
      text: body,
    });
  } catch (err) {
    console.error("[email] 送信失敗:", err);
  }
}
