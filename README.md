# 283バドミントン 出欠管理アプリ

283バドミントンサークルのイベント出欠管理Webアプリケーションです。

## 概要

LINEアカウントでログインして、練習会などのイベントへの参加・不参加を登録できます。

### 主な機能

- LINEログイン認証
- イベント作成・編集・削除（管理者）
- 出欠登録（参加/不参加/キャンセル待ち）
- メンバー一覧・権限管理
- プロフィール編集

## 環境

| 環境 | URL | 用途 |
|------|-----|------|
| DEV | https://dev-283-badminton-app-dae7h5bjbddcdnd3.japaneast-01.azurewebsites.net | 開発・検証用 |
| LOCAL | http://localhost:3000 | ローカル開発 |

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript |
| ORM | Prisma 5 |
| データベース | SQLite (ローカル) / Azure SQL Database (DEV/本番) |
| 認証 | NextAuth.js + LINE OAuth |
| スタイリング | Tailwind CSS |
| ホスティング | Azure App Service |
| CI/CD | GitHub Actions |

## クイックスタート

### 前提条件

- Node.js 20.x
- npm

### セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/basaa0283/283-badminton-app.git
cd 283-badminton-app

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env
# .env を編集して LINE_CHANNEL_ID, LINE_CHANNEL_SECRET, NEXTAUTH_SECRET を設定

# データベースをセットアップ
npx prisma db push
npx prisma generate

# 開発サーバーを起動
npm run dev
```

http://localhost:3000 にアクセス

## ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | ユーザーマニュアル |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 開発ガイド |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | システム設計書 |
| [docs/AZURE_SETUP.md](docs/AZURE_SETUP.md) | Azure環境セットアップ |

## ディレクトリ構成

```
283-badminton-app/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API Routes
│   │   ├── events/          # イベント関連ページ
│   │   ├── members/         # メンバー関連ページ
│   │   ├── profile/         # プロフィールページ
│   │   ├── admin/           # 管理画面
│   │   └── login/           # ログインページ
│   ├── components/          # Reactコンポーネント
│   │   ├── layout/          # レイアウト
│   │   ├── events/          # イベント関連
│   │   ├── members/         # メンバー関連
│   │   └── ui/              # 共通UI
│   ├── lib/                 # ライブラリ
│   │   ├── auth.ts          # NextAuth設定
│   │   ├── prisma.ts        # Prismaクライアント
│   │   ├── permissions.ts   # 権限チェック
│   │   └── validations.ts   # バリデーション
│   └── types/               # 型定義
├── prisma/
│   ├── schema.prisma        # DBスキーマ (SQLite)
│   └── schema.sqlserver.prisma # DBスキーマ (SQL Server)
├── docs/                    # ドキュメント
└── .github/workflows/       # CI/CD
```

## 権限

| 権限 | 説明 |
|------|------|
| admin | 全ての機能が使用可能 |
| subadmin | イベント作成・編集・削除、権限変更が可能 |
| member | イベント参加、メンバー詳細閲覧が可能 |
| visitor | イベント参加のみ可能 |
| guest | 初回ログイン時の権限。イベント参加のみ可能 |

## ブランチ戦略

| ブランチ | 用途 |
|---------|------|
| master | 安定版 |
| dev/release | DEV環境デプロイ用 |
| feature/* | 機能開発用 |

## ライセンス

Private

---

*最終更新: 2024年12月*

## Longplay お知らせ作成権限 (任意の試験導入)

`LONGPLAY_ANNOUNCEMENTS_FEATURE_ID` 未設定時は課金サービスに接続せず、従来の作成動作を維持します。有効時は access Feature UUID と `LONGPLAY_BASE_URL`、サーバー専用 `LONGPLAY_SECRET_KEY`、`LONGPLAY_APP_ID`、明示的な `LONGPLAY_ENVIRONMENT` (`sandbox` / `live`) を設定します。SDK は 0.10.15 固定で、Node.js 22 以上が必要です。

管理者セッションと入力検証の後、現在のテナントを DB から取得し、`283bad:tenant:<id>` の権限を新規お知らせの保存前に確認します。セッションの所属判定・課金・保存先で同じテナントを使用し、別テナントからデフォルトの28ばどへ投稿しません。active な complimentary パイロットは購入不要です。frozen/pending は許可せず、保存済み paid フラグだけでは購入済みと判断しません。本文、宛先、LINE/メール資格情報は課金先へ送信しません。

対象は `POST /api/admin/announcements` のみです。既存お知らせの閲覧、他の有料候補機能、購入・解約・webhook・プラン UI の全体実装は #64 に残ります。拒否や障害ではお知らせを保存せず、メール通知も開始しません。採用前に課金商品の範囲と SDK 利用許諾を確認してください。
