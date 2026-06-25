import { ja } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "./prisma";

const JST = "Asia/Tokyo";

async function isSettingEnabled(key: string): Promise<boolean> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return setting ? setting.value === "true" : true;
}

const MESSAGING_API_URL = "https://api.line.me/v2/bot/message";
const TOKEN = process.env.LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN;

async function push(lineId: string, text: string): Promise<void> {
  if (!TOKEN) {
    console.warn("[LINE] LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN not set, skipping notification");
    return;
  }
  const res = await fetch(`${MESSAGING_API_URL}/push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: lineId,
      messages: [{ type: "text", text }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[LINE] push failed (${res.status}): ${body}`);
  }
}

async function multicast(lineIds: string[], text: string): Promise<void> {
  if (!TOKEN) {
    console.warn("[LINE] LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN not set, skipping notification");
    return;
  }
  if (lineIds.length === 0) return;
  for (let i = 0; i < lineIds.length; i += 500) {
    const chunk = lineIds.slice(i, i + 500);
    const res = await fetch(`${MESSAGING_API_URL}/multicast`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: chunk,
        messages: [{ type: "text", text }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[LINE] multicast failed (${res.status}): ${body}`);
    }
  }
}

/**
 * LINE 通知本文の日時表記。
 * Azure App Service の Node ランタイムは UTC で動くため、date-fns の format を
 * そのまま使うと JST より 9 時間遅れた表記になっていた。明示的に JST に変換して整形する。
 */
function formatEventDate(date: Date): string {
  return formatInTimeZone(date, JST, "M月d日(E) HH:mm", { locale: ja });
}

export async function notifyApprovalGranted(params: {
  lineId: string;
  nickname: string;
  roleLabel: string;
  appUrl: string;
}): Promise<void> {
  // 承認通知は重要なのでグローバル設定の影響を受けず常に送る (LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN
  // が未設定なら push 側で skip)。
  const text =
    `【283バドミントン】\nご参加リクエストが承認されました🎉\n\n` +
    `${params.nickname} さん、ようこそ！\n` +
    `権限: ${params.roleLabel}\n\n` +
    `アプリを開いてご利用を始めてください:\n${params.appUrl}/`;
  await push(params.lineId, text);
}

// 保留時のテンプレ返信。SystemSetting の holdReplyMessage に上書き文があればそれを送り、
// 無ければ HOLD_REPLY_DEFAULT を送る。
export const HOLD_REPLY_DEFAULT =
  `【283バドミントン】\nご参加リクエストありがとうございます。\n\n` +
  `ご検討のため、以下の情報をこの公式LINEにメッセージで送ってください:\n` +
  `- お名前 (ニックネームでも可)\n` +
  `- 性別 / 年代\n` +
  `- バドミントン経験 (年数・レベル感)\n` +
  `- 参加希望日 (例: 6/15 池袋会場)\n\n` +
  `お返事をいただき次第、運営から参加可否をご連絡します。`;

export async function notifyHoldRequest(params: {
  lineId: string;
}): Promise<void> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "holdReplyMessage" },
  });
  const text = setting?.value?.trim() ? setting.value : HOLD_REPLY_DEFAULT;
  await push(params.lineId, text);
}

export async function notifyWaitlistPromotion(params: {
  lineId: string;
  eventTitle: string;
  eventDate: Date;
  location: string | null;
}): Promise<void> {
  if (!(await isSettingEnabled("notifyWaitlistEnabled"))) return;
  const text =
    `【283バドミントン】\nキャンセル待ちが繰り上がりました🎉\n\n` +
    `${params.eventTitle}\n` +
    `📅 ${formatEventDate(params.eventDate)}\n` +
    (params.location ? `📍 ${params.location}\n` : "") +
    `\n参加が確定しました！`;
  await push(params.lineId, text);
}

export async function notifyNewEvent(params: {
  lineIds: string[];
  eventTitle: string;
  eventDate: Date;
  location: string | null;
  appUrl: string;
}): Promise<void> {
  const text =
    `【283バドミントン】\n新しいイベントが追加されました！\n\n` +
    `${params.eventTitle}\n` +
    `📅 ${formatEventDate(params.eventDate)}\n` +
    (params.location ? `📍 ${params.location}\n` : "") +
    `\n参加登録はアプリから：\n${params.appUrl}/events`;
  await multicast(params.lineIds, text);
}

export async function notifyEventReminder(params: {
  lineId: string;
  eventTitle: string;
  eventDate: Date;
  location: string | null;
  hoursUntil: number;
}): Promise<void> {
  if (!(await isSettingEnabled("notifyReminderEnabled"))) return;
  const label = params.hoursUntil <= 3 ? "まもなく" : "明日";
  const text =
    `【283バドミントン】\n${label}のイベントのお知らせ\n\n` +
    `${params.eventTitle}\n` +
    `📅 ${formatEventDate(params.eventDate)}\n` +
    (params.location ? `📍 ${params.location}` : "");
  await push(params.lineId, text);
}
