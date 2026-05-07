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

- `master`: **本番デプロイ対象**。直接コミットしない。マージ＝本番リリース。
- `dev/release`: 開発統合ブランチ。DEV環境にデプロイされる。
- `feature/*`: 機能開発用。`dev/release` から派生し、`dev/release` に PR でマージ。

## リリースポリシー（重要）

`dev/release` へのコミット・push・PR作成・マージは**気軽に進めてよい**（DEV環境のみ影響）。

ただし `master` へのマージは**本番リリース**を意味するので、以下を厳守：

- **明示的な指示がない限り、master向けPRを作成・マージしない**
- 「裏方変更（テスト追加、CI改善、リファクタ等）」だけで本番リリースしない
  - ユーザー影響のある変更が複数溜まってから、まとめて出す
- master向けPRを提案する際は、**含まれる変更とユーザー影響を明示して確認する**
  - 例：「以下の変更を本番リリースしますか？影響範囲は…」
- 本番リリース＝ユーザーの動作に影響するイベントなので、**頻度を最小化**する

### 例

| 状況 | 対応 |
|---|---|
| 機能追加・バグ修正完了 | dev/release にマージ。masterは保留 |
| ユーザー影響なし（テスト/CI/ドキュメント等） | dev/release で蓄積。単独でmasterに出さない |
| ユーザー影響のある変更が溜まった | ユーザーに「リリースする？」と相談してからmaster PR |
| 緊急バグ修正 | 影響を説明して確認後、master PR |

## 環境

- DEV: `dev-283-badminton-app-dae7h5bjbddcdnd3.japaneast-01.azurewebsites.net`
- PROD: `prod-283-badminton-app-gsacfjcnezadeugd.japanwest-01.azurewebsites.net`
- DB: 本番は Azure SQL Database (`prisma/schema.sqlserver.prisma`)、ローカルは SQLite (`prisma/schema.prisma`)
