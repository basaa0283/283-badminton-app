# マルチテナント化 + ビジネス化 設計 (Issue #42)

作成日: 2026-09-04
ステータス: 承認済み (ブレスト 2026-09-04)
前提ドキュメント: Issue #42 の技術ブレスト (2026-06-03〜06)

## 1. 目的

283-badminton-app を 28ばど 専用アプリから、他のバドミントンサークルも使える
マルチテナント SaaS に拡張し、**個人の副業として収益化**する。

## 2. 事業モデル (決定事項)

| 項目 | 決定 |
|---|---|
| 事業規模 | 副業サイドプロジェクト。成功基準は 5〜10 サークル |
| 収益モデル | フリーミアム。無料プランは撒き餌、有料プランへ誘導 |
| 有料プラン価格 | **月額 ¥1,000 / サークル** (普及重視の価格帯) |
| 決済 | Stripe サブスクリプション (自動課金) |
| 事業体 | 個人・副業として受取 (確定申告は雑所得/事業所得) |
| サポート | 基本セルフサービス (FAQ/ガイド + ベストエフォート回答) |
| パイロット | 最初の 2〜3 サークルは知人に **全機能無料 (complimentary)** で提供。手応えがあれば一般公開 |

## 3. 無料 / 有料 / 対象外の機能マトリクス

### 無料 (サークル運営の根幹のみ)

- イベント作成 (日時・場所・定員などの基本情報)
- 出欠登録・キャンセル待ち・繰り上げ
- メンバー一覧 (基本情報のみ、タグなし)
- 大会・実績記録 (サークル横断のグローバル機能として無料維持)

### 有料 (月額 ¥1,000)

- お知らせ機能 (アプリ内配信・当日連絡含む)
- LINE 通知 (Push・リマインダー)
- メール通知配信
- メンバータグ
- 非公開イベント・タグ限定公開
- 会計管理 (シャトル代・体育館代・経費・参加費支払い管理)

### 対象外 (マルチテナント提供に含めない)

- ポイント・実績 (バッジ) 制度 — 28ばど でも活用できていないため凍結。
  28ばど 本体からの削除は別途判断 (コードは当面残す)
- 分析・利用状況ダッシュボード — テナント向け機能から外し、
  プラットフォーム管理者ツールに移行

## 4. 収益・コスト試算

### 収益 (一般公開後の想定)

フリーミアムのため収益 = 有料転換数 × ¥1,000。パイロット期 (知人2〜3サークル) は収益ゼロ。

| シナリオ | 無料登録 | 有料転換 | 月次売上 | Stripe手数料(3.6%) | 月次純利益(概算) |
|---|---|---|---|---|---|
| 控えめ | 10 | 2 | ¥2,000 | ¥72 | 約 ¥1,900 |
| 目標 | 20 | 5 | ¥5,000 | ¥180 | 約 ¥4,800 |
| 好調 | 40 | 10 | ¥10,000 | ¥360 | 約 ¥7,400 (※インフラ昇格込) |

### コスト

| 項目 | 現状 | スケール時 |
|---|---|---|
| Azure App Service B1 | 既存 (28ばど と共用、増分 ¥0) | 高負荷時 Standard 昇格 (+数千円/月) |
| Azure SQL Basic | 既存 (増分 ¥0) | **2GB 上限リスク** → Standard S0 昇格 (+約¥2,200/月)。テナント増加時の最初のコスト増要因 |
| Stripe 手数料 | - | 売上の 3.6% |
| メール送信 (Gmail SMTP) | ¥0 | 送信量増で日次上限に接触 → SendGrid/SES 等へ移行 (従量課金)。有料機能なので売上と連動 |
| LINE 通知 | ¥0 (各テナントが自前のLINEチャネルを契約・負担) | 同左。プラットフォーム側コストなし |

## 5. 技術アーキテクチャ (Issue #42 ブレスト + 今回の追加)

#42 で決定済みの土台 (ハイブリッドメンバー基盤 / サブパス URL / インフラ共用 /
LINE bot 完全分離 / 大会グローバル / 申請承認フロー) はそのまま採用。
今回のビジネス化で以下を追加する。

### 5.1 Tenant のプラン管理

```prisma
model Tenant {
  id     String @id @default(cuid())
  slug   String @unique          // URL サブパス (例: "283bad")
  name   String                  // サークル表示名
  status String @default("active")  // active / frozen / pending
  plan   String @default("free")    // free / paid / complimentary

  // Stripe (plan=paid のみ使用)
  stripeCustomerId     String?
  stripeSubscriptionId String?

  // LINE チャネル (テナント自前契約、P3 で使用)
  lineLoginChannelId       String?
  lineLoginChannelSecret   String?
  lineMessagingChannelId   String?
  lineMessagingChannelSecret String?
  lineMessagingAccessToken String?

  ownerUserId String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- `complimentary` = Stripe 決済なしで有料機能を全解放 (知人パイロット用)。
  プラットフォーム管理者だけが設定できる
- `frozen` = 未払い・解約・障害対応でテナント全体をロック (閲覧のみ or 完全遮断)

### 5.2 Feature Gate

有料機能の API / UI は `tenantHasPaidFeatures(tenant)` を通す:

```
plan = "paid" (Stripe active) または "complimentary" → 有料機能 ON
plan = "free" → 有料機能 OFF (403 + アップグレード誘導)
```

機能単位の細かい gate は作らない (プラン 2 段階のみ、YAGNI)。

### 5.3 プラットフォーム管理者 (platform_admin)

- `User.isPlatformAdmin Boolean @default(false)` を追加 (既存 role とは独立)
- 管理ツールは `/platform` 配下 (テナントサブパスの外)
- 機能:
  1. テナント一覧・プラン切替 (free / paid / complimentary)・状態変更 (active / frozen)
  2. 新規テナント作成 + 申請承認フロー (TenantApplication)
  3. 全テナント横断ダッシュボード (テナント数 / アクティブ数 / MRR / 利用状況)
  4. 凍結管理 (未払い・解約テナントのロック)

### 5.4 Membership (#42 決定の再掲)

`User` は本人特定情報のみ (lineId / email / 規約同意) に最小化し、
プロフィール・ロールは `Membership` (userId × tenantId) に移動する。

## 6. 段階的フェーズ計画 (28ばど 保護最優先)

| Phase | 内容 | 既存ユーザー影響 |
|---|---|---|
| **P0** | Tenant / Membership / TenantApplication schema 追加 + `283bad` seed + Membership 移行スクリプト + `User.isPlatformAdmin` | **なし** (テーブル追加のみ、アプリ挙動不変) |
| P1 | 全 API に tenantId フィルタ (内部で `283bad` に固定解決) + feature gate 骨格 | なし (URL/挙動同じ) |
| P2 | URL を `/283bad/...` に切替 (旧 URL リダイレクト) | リダイレクト 1 回 |
| **P2.5** | Stripe 決済統合 + プラン管理 + feature gate 本稼働 | なし (28ばど は complimentary) |
| P3 | 動的 LINE OAuth (Tenant のチャネルで認証) | なし (env → Tenant レコードへ移行) |
| **P3.5** | プラットフォーム管理者ツール (/platform) | なし |
| P4 | 申請→承認 UI 公開、パイロット 2〜3 サークル受け入れ | なし |
| P5 | 一般公開 (Stripe 課金開始) | なし |

太字が今回のビジネス化で追加したフェーズ。

## 7. 未決事項

- ポイント制度を 28ばど 本体から削除するか (別途判断)
- 一般公開のタイミング・集客方法 (パイロットの結果を見て決定)
- 独自ドメイン取得 (#94 の 28bad.net をプロダクトブランドに使うか)
- 特定商取引法に基づく表記・利用規約のマルチテナント対応 (P5 までに整備)

## 8. 人間の手作業が必要なもの (フェーズ到達時に都度確認)

- Stripe アカウント開設・API キー取得 (P2.5)
- パイロットサークルの LINE チャネル契約案内 (P4)
- DEV/PROD への移行スクリプト実行 (P0)
