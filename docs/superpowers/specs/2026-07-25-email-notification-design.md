# メール通知機能 設計 (2026-07-25)

## 背景

通知は現在 LINE Push のみだが、LINE 公式アカウントの無料枠は月 200 通で、
メンバー数 × 通知種別が増えると簡単に枯渇する。そこで **任意登録のメール通知ルート**を
新設し、LINE を「必須・少量」、メールを「任意・多量」の分担にする。

## 確定要件

- 本人確認あり: 登録アドレスに確認メールを送り、リンククリックで有効化。
  **未確認アドレスには一切送らない**。
- 配信種別 (4 つ): 新規イベント公開 / お知らせ / リマインダー / 当日連絡。
- 設定粒度: 種別ごとの ON/OFF スイッチ 4 つ。登録時デフォルトは全 ON。
- 対象ロール: 全ロール登録可。
- `User.email` (NextAuth 標準・unique) とは独立した `notifyEmail` を新設。
  unique 制約なし = 家族で同じアドレスを共有できる。

## データモデル

User に追加 (両 schema: `prisma/schema.prisma` / `prisma/schema.sqlserver.prisma`):

| フィールド | 型 | 意味 |
|---|---|---|
| `notifyEmail` | String? | 通知先アドレス (unique なし) |
| `notifyEmailVerifiedAt` | DateTime? | null = 未確認。未確認には送信しない |
| `notifyOnNewEvent` | Boolean @default(true) | 新規イベント公開 |
| `notifyOnAnnouncement` | Boolean @default(true) | お知らせ |
| `notifyOnReminder` | Boolean @default(true) | リマインダー |
| `notifyOnEventMessage` | Boolean @default(true) | 当日連絡 |

新規モデル `EmailToken`: `token` (PK) / `userId` / `purpose` ("verify" = 24h 期限,
"unsubscribe" = 無期限) / `expiresAt` (null = 無期限) / `createdAt`。
**User へのリレーションは張らない** (SQL Server の FK 循環・削除時問題を回避)。
代わりに `deleteUserCascade` (src/lib/user-delete.ts) で `emailToken.deleteMany` を実行。

## 送信設計

- 送信基盤: `src/lib/notify-email.ts`。既存 `src/lib/email.ts` と同じ
  Gmail SMTP (env: `GMAIL_USER` / `GMAIL_APP_PASSWORD`) を流用。
- `sendEmail({ to, subject, body })` を汎用入口とし、transport 生成を関数内に
  閉じ込める。将来 SendGrid / Azure Communication Services 等へ差し替える際は
  この 1 関数の実装だけを入れ替えればよい。
- **Gmail 制約: 500 通/日** (通常アカウント)。当面のメンバー規模 (数十人 × 数通/日)
  では十分だが、超過が見えたら専用送信サービスへ移行する。
  M2 の一括送信では逐次送信 + 失敗ログで様子を見る (レート制御は移行時に検討)。
- すべての通知メール末尾に配信停止リンク (`buildFooter`) を付ける。

## 宛先フィルタ (M2/M3)

各配信種別の宛先 = 以下の AND:

1. `notifyEmail != null` かつ `notifyEmailVerifiedAt != null` (確認済み)
2. 該当スイッチが ON (例: 新規イベントなら `notifyOnNewEvent`)
3. **既存の公開制御**をそのまま適用:
   - 新規イベント: `minViewRole` 閾値 + `EventAllowedTag` (タグ制限)
   - お知らせ / 当日連絡: `audienceMember/Visitor/Guest` + `attendanceTargetType`
   - リマインダー: 対象イベントの参加確定者 (既存 cron の対象と同一)

つまり「アプリ内で見える人にだけメールも届く」。メール専用の公開拡大はしない。

## UI フロー

プロフィール画面に「メール通知」カードを追加。3 状態:

1. **未登録**: 説明文 + アドレス入力 + 「確認メールを送る」
2. **確認待ち** (notifyEmail あり & verifiedAt null): アドレス表示 + 再送 + 登録解除
3. **確認済み**: アドレス表示 + 種別スイッチ ×4 (変更即保存) + 登録解除

確認メール内リンク → `/email/verify?token=...` (認証不要ページ、自動 POST)。
通知メール末尾リンク → `/email/unsubscribe?token=...` (ボタン押下で全スイッチ OFF)。

## フェーズ分割

- **M1 (今回)**: schema / 送信基盤 / 登録・確認・解除・配信停止 API / 各ページ /
  プロフィール UI。スイッチは保存されるだけでまだ配信されない。
- **M2**: 新規イベント公開・お知らせ投稿をトリガに一括送信 (宛先フィルタ実装)。
- **M3**: リマインダー (既存 cron に相乗り)・当日連絡の配信。

## セキュリティ考慮

- トークンは `crypto.randomBytes(32).toString("hex")` (256bit)。推測不能。
- verify トークンは 24h 期限 + 使用後即削除 (ワンタイム)。
- unsubscribe トークンは無期限だがユーザーごとに発行し、漏れても
  「通知が止まる」以外の影響はない (アドレス自体は消さない・表示もしない)。
- **prefetch 対策**: メールクライアント / セキュリティゲートウェイのリンク先読みで
  誤発火しないよう、verify / unsubscribe とも副作用は GET でなく POST で実行。
  unsubscribe はさらに「配信停止する」ボタンの明示クリックを要求する
  (verify は自動 POST。誤発火しても「有効化」なので実害が小さい)。
- verify 成功レスポンスのアドレスは `ab***@gmail.com` 形式にマスク
  (トークンだけ知る第三者にフルアドレスを開示しない)。
- 登録 API はログイン必須 + zod 検証 (メール形式, max 254)。
- 監査: `notify_email.register` / `notify_email.remove` / `notify_email.verify` /
  `notify_email.unsubscribe` を ActivityLog に記録。
