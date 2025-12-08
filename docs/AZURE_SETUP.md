# Azure DEV環境 セットアップガイド

## 概要

Azure App Service + Azure SQL Database を使用したDEV環境の構築手順です。

---

## 1. Azure SQL Database の作成

### Azure Portal での操作

1. **Azure Portal** にログイン
2. **リソースの作成** → **SQL Database** を選択
3. 以下の設定で作成:

| 項目 | 設定値 |
|------|--------|
| サブスクリプション | 使用するサブスクリプション |
| リソースグループ | `rg-283-badminton-dev` (新規作成) |
| データベース名 | `db-283-badminton-dev` |
| サーバー | 新規作成 |

### SQL Server の設定

| 項目 | 設定値 |
|------|--------|
| サーバー名 | `sql-283-badminton-dev` |
| 場所 | `Japan East` |
| 認証方法 | SQL認証 |
| サーバー管理者ログイン | `sqladmin` |
| パスワード | (安全なパスワードを設定) |

### コンピューティング + ストレージ

- **Basic** または **S0** (開発用には十分)
- コスト: 約500円/月〜

### ファイアウォール設定

作成後、SQL Server の **ファイアウォールと仮想ネットワーク** で:
- 「Azureサービスおよびリソースにこのサーバーへのアクセスを許可する」を **はい**
- 開発用に自分のIPアドレスを追加

---

## 2. Azure App Service の作成

### Azure Portal での操作

1. **リソースの作成** → **Web App** を選択
2. 以下の設定で作成:

| 項目 | 設定値 |
|------|--------|
| サブスクリプション | 使用するサブスクリプション |
| リソースグループ | `rg-283-badminton-dev` (既存) |
| 名前 | `283-badminton-dev` |
| 公開 | コード |
| ランタイムスタック | Node 20 LTS |
| オペレーティングシステム | Linux |
| 地域 | Japan East |

### App Service プラン

- **Basic B1** (開発用)
- コスト: 約1,500円/月

---

## 3. 環境変数の設定

### Azure Portal → App Service → 構成 → アプリケーション設定

以下の環境変数を追加:

| 名前 | 値 |
|------|-----|
| `DATABASE_URL` | `sqlserver://sql-283-badminton-dev.database.windows.net:1433;database=db-283-badminton-dev;user=sqladmin;password=YOUR_PASSWORD;encrypt=true;trustServerCertificate=false` |
| `NEXTAUTH_URL` | `https://dev-283-badminton-app-dae7h5bjbddcdnd3.japaneast-01.azurewebsites.net` |
| `NEXTAUTH_SECRET` | (openssl rand -base64 32 で生成) |
| `LINE_CHANNEL_ID` | (LINE Developersから取得) |
| `LINE_CHANNEL_SECRET` | (LINE Developersから取得) |

### DATABASE_URL の確認方法

Azure Portal → SQL Database → 接続文字列 → ADO.NET

---

## 4. LINE Developers Console の設定

### コールバックURLの追加

LINE Developers Console → チャネル → LINE Login → コールバックURL に追加:

```
https://dev-283-badminton-app-dae7h5bjbddcdnd3.japaneast-01.azurewebsites.net/api/auth/callback/line
```

**注意**: ローカル用のURLも残しておく
```
http://localhost:3000/api/auth/callback/line
```

---

## 5. GitHub Secrets の設定

### GitHub → リポジトリ → Settings → Secrets and variables → Actions

以下のシークレットを追加:

| シークレット名 | 値 |
|---------------|-----|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | (App Serviceからダウンロード) |
| `DATABASE_URL` | (Azure SQL Database接続文字列) |
| `NEXTAUTH_URL` | `https://dev-283-badminton-app-dae7h5bjbddcdnd3.japaneast-01.azurewebsites.net` |
| `NEXTAUTH_SECRET` | (openssl rand -base64 32 で生成) |
| `LINE_CHANNEL_ID` | (LINE Developersから取得) |
| `LINE_CHANNEL_SECRET` | (LINE Developersから取得) |

### 発行プロファイルのダウンロード

Azure Portal → App Service → 概要 → **発行プロファイルのダウンロード**

ダウンロードしたXMLファイルの内容をそのまま `AZURE_WEBAPP_PUBLISH_PROFILE` に設定

---

## 6. データベースマイグレーション

### 初回デプロイ前にローカルから実行

```bash
# Azure SQL Database用スキーマに切り替え
cp prisma/schema.sqlserver.prisma prisma/schema.prisma

# 環境変数を設定（Azure SQL Database接続文字列）
export DATABASE_URL="sqlserver://..."

# マイグレーション実行
npx prisma db push

# ローカル開発用に戻す
git checkout prisma/schema.prisma
```

---

## 7. デプロイ

### 自動デプロイ

`dev/release` ブランチにプッシュすると自動的にデプロイされます。

```bash
git checkout dev/release
git merge master
git push origin dev/release
```

### 手動デプロイ

GitHub → Actions → Deploy to Azure App Service (DEV) → Run workflow

---

## 8. 動作確認

1. `https://dev-283-badminton-app-dae7h5bjbddcdnd3.japaneast-01.azurewebsites.net` にアクセス
2. LINEログインをテスト
3. 各機能の動作確認

---

## トラブルシューティング

### デプロイエラー

- App Service → デプロイセンター → ログを確認
- GitHub Actions のログを確認

### データベース接続エラー

- ファイアウォール設定を確認
- 接続文字列のパスワードを確認
- SSL設定（encrypt=true）を確認

### LINE ログインエラー

- コールバックURLが正しく設定されているか確認
- NEXTAUTH_URL が正しいか確認

---

## コスト見積もり（月額）

| リソース | プラン | 月額目安 |
|---------|-------|---------|
| Azure SQL Database | Basic | ~500円 |
| App Service | Basic B1 | ~1,500円 |
| **合計** | | **~2,000円** |

※ 無料枠やクレジットがある場合は無料で運用可能

---

*最終更新: 2024年12月*
