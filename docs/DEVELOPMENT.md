# 開発ガイド

## 開発環境セットアップ

### 前提条件

- Node.js 20.x
- npm
- Git
- LINE Developers アカウント

### 初期セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/basaa0283/283-badminton-app.git
cd 283-badminton-app

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env
```

### 環境変数の設定

`.env` ファイルを編集：

```env
# ローカル開発用 (SQLite)
DATABASE_URL="file:./dev.db"

# NextAuth設定
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# LINE Login
LINE_CHANNEL_ID="your-line-channel-id"
LINE_CHANNEL_SECRET="your-line-channel-secret"
```

### LINE Developers Console 設定

1. https://developers.line.biz/console/ にアクセス
2. プロバイダー → LINEログインチャネルを選択
3. コールバックURLに追加：
   ```
   http://localhost:3000/api/auth/callback/line
   ```

### データベースセットアップ

```bash
# テーブル作成
npx prisma db push

# Prisma Client生成
npx prisma generate

# （オプション）Prisma Studioでデータ確認
npx prisma studio
```

### 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 にアクセス

---

## 開発フロー

### ブランチ戦略

```
master          # 安定版（本番相当）
├── dev/release # DEV環境デプロイ用
└── feature/*   # 機能開発用
```

### 新機能開発

```bash
# dev/releaseから機能ブランチを作成
git checkout dev/release
git pull origin dev/release
git checkout -b feature/your-feature-name

# 開発...

# コミット
git add .
git commit -m "feat: 機能の説明"

# プッシュ
git push origin feature/your-feature-name

# dev/releaseにマージ（GitHub PRまたはローカル）
git checkout dev/release
git merge feature/your-feature-name
git push origin dev/release
```

### コミットメッセージ規約

```
feat: 新機能
fix: バグ修正
docs: ドキュメント
refactor: リファクタリング
test: テスト
chore: その他
```

---

## プロジェクト構成

### ディレクトリ構造

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── auth/             # NextAuth.js
│   │   ├── events/           # イベントAPI
│   │   ├── members/          # メンバーAPI
│   │   └── profile/          # プロフィールAPI
│   ├── events/               # イベントページ
│   ├── members/              # メンバーページ
│   ├── profile/              # プロフィールページ
│   ├── admin/                # 管理画面
│   ├── login/                # ログインページ
│   ├── layout.tsx            # ルートレイアウト
│   └── page.tsx              # トップページ
├── components/               # Reactコンポーネント
│   ├── layout/               # レイアウト（Header等）
│   ├── events/               # イベント関連
│   ├── members/              # メンバー関連
│   └── ui/                   # 共通UIコンポーネント
├── lib/                      # ユーティリティ
│   ├── auth.ts               # NextAuth設定
│   ├── prisma.ts             # Prismaクライアント
│   ├── permissions.ts        # 権限チェックヘルパー
│   └── validations.ts        # Zodバリデーション
└── types/                    # 型定義
```

### 主要ファイル

| ファイル | 説明 |
|---------|------|
| `src/lib/auth.ts` | NextAuth.js設定（LINE OAuth） |
| `src/lib/prisma.ts` | Prismaクライアントシングルトン |
| `src/lib/permissions.ts` | 権限チェックヘルパー |
| `src/lib/validations.ts` | Zodバリデーションスキーマ |
| `prisma/schema.prisma` | DBスキーマ（SQLite用） |
| `prisma/schema.sqlserver.prisma` | DBスキーマ（SQL Server用） |

---

## API設計

### エンドポイント一覧

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | `/api/events` | イベント一覧 | 全員 |
| POST | `/api/events` | イベント作成 | admin/subadmin |
| GET | `/api/events/[id]` | イベント詳細 | 全員 |
| PUT | `/api/events/[id]` | イベント更新 | admin/subadmin |
| DELETE | `/api/events/[id]` | イベント削除 | admin/subadmin |
| GET | `/api/events/[id]/attendance` | 出欠一覧 | member以上 |
| POST | `/api/events/[id]/attendance` | 出欠登録 | 全員 |
| GET | `/api/members` | メンバー一覧 | 全員 |
| GET | `/api/members/[id]` | メンバー詳細 | member以上 |
| PUT | `/api/members/[id]` | 権限変更 | admin/subadmin |
| GET | `/api/profile` | 自分のプロフィール | ログイン済み |
| PUT | `/api/profile` | プロフィール更新 | ログイン済み |

### レスポンス形式

```typescript
// 成功時
{
  "data": { ... }
}

// エラー時
{
  "error": "エラーメッセージ"
}
```

---

## データベース

### ローカル開発（SQLite）

```bash
# スキーマ変更を反映
npx prisma db push

# マイグレーションファイル作成（本番用）
npx prisma migrate dev --name migration_name

# データ確認
npx prisma studio
```

### Azure SQL Database

```bash
# SQL Serverスキーマに切り替え
cp prisma/schema.sqlserver.prisma prisma/schema.prisma

# 環境変数設定
export DATABASE_URL="sqlserver://..."

# マイグレーション実行
npx prisma db push

# ローカル用に戻す
git checkout prisma/schema.prisma
```

---

## デプロイ

### DEV環境

`dev/release` ブランチにプッシュすると、GitHub Actions が自動的にAzure App Service にデプロイします。

```bash
git checkout dev/release
git merge feature/your-feature
git push origin dev/release
```

### 手動デプロイ

GitHub → Actions → "Deploy to Azure App Service (DEV)" → "Run workflow"

---

## トラブルシューティング

### Prisma Client エラー

```bash
# 再生成
npx prisma generate
```

### ポート3000が使用中

```bash
# Windowsの場合
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### LINE ログインエラー

1. コールバックURLが正しく設定されているか確認
2. NEXTAUTH_URLが正しいか確認
3. ブラウザのCookieを削除

### データベースリセット

```bash
# 警告: データが全て削除されます
npx prisma db push --force-reset
```

---

*最終更新: 2024年12月*
