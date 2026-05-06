# プロジェクト固有ガイドライン

## リリースルール

`dev/release` → `master` への PR を作成する前に、**必ず以下の2点を実施する**。

### 1. CHANGELOG.md の更新

- `[Unreleased]` セクションに項目を追加するのではなく、新バージョン番号のセクションを直接追加する
- リリース日 (`YYYY-MM-DD`) を併記する
- [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) のカテゴリを使用：
  - `Added` (新機能)
  - `Changed` (既存機能の変更)
  - `Deprecated` (非推奨化)
  - `Removed` (削除)
  - `Fixed` (バグ修正)
  - `Security` (セキュリティ修正)
- 各項目の末尾に PR 番号 (`(#123)`) を付ける
- 末尾の compare リンクも更新する

### 2. `package.json` のバージョンバンプ

[Semantic Versioning](https://semver.org/lang/ja/) に従う：

| 種類 | 増加させる箇所 | 適用基準 |
|---|---|---|
| MAJOR (`x.0.0`) | 1桁目 | 後方互換性のない変更 |
| MINOR (`1.x.0`) | 2桁目 | 後方互換性のある機能追加 |
| PATCH (`1.0.x`) | 3桁目 | 後方互換性のあるバグ修正のみ |

**判定の目安：**

- `Added` のみ含む / `Added` + `Fixed` → MINOR
- `Fixed` のみ → PATCH
- `Removed` / 破壊的な `Changed` → MAJOR

### 3. リリースフロー

1. `dev/release` ブランチで CHANGELOG.md と package.json を更新するコミットを作成
2. master 向けに PR を作成（タイトルにバージョンを含める例: `Release v1.0.3`）
3. PR の本文に CHANGELOG の該当バージョンセクションを抜粋して貼り付ける
4. master へマージすると `release.yml` が自動的にタグ (`v1.0.x`) と GitHub Release を作成
5. `deploy-prod.yml` が PROD へデプロイ

### CHANGELOG の例（追加時のテンプレート）

```markdown
## [1.0.3] - 2026-05-10

### Added
- 新機能の説明 (#123)

### Fixed
- バグ修正の説明 (#124)
```

---

## ブランチ運用

- `master`: 本番デプロイ対象。直接コミットしない。
- `dev/release`: 開発統合ブランチ。DEV環境にデプロイされる。
- `feature/*`: 機能開発用。`dev/release` から派生し、`dev/release` に PR でマージ。

## 環境

- DEV: `dev-283-badminton-app-dae7h5bjbddcdnd3.japaneast-01.azurewebsites.net`
- PROD: `prod-283-badminton-app-gsacfjcnezadeugd.japanwest-01.azurewebsites.net`
- DB: 本番は Azure SQL Database (`prisma/schema.sqlserver.prisma`)、ローカルは SQLite (`prisma/schema.prisma`)
