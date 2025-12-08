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
| DEV | https://dev-283-badminton-app.azurewebsites.net | 開発・検証用 |
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
