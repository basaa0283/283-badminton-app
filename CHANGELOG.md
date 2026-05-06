# Changelog

このドキュメントは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) の形式に基づいて記述されています。
本プロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) (`MAJOR.MINOR.PATCH`) に従います。

## [1.1.0] - 2026-05-06

### Added

- 単体テスト基盤として [Vitest](https://vitest.dev/) を導入 (#8)
  - `src/lib/validations.ts` に対する28件のテストを追加
  - カバレッジレポートは `npm run test:coverage` で生成
- GitHub Actions による CI 上でのテスト自動実行ワークフロー (`.github/workflows/test.yml`) を追加
  - `dev/release` / `master` への push および PR で自動実行
- テスト方針ドキュメント `docs/TESTING.md` を追加

## [1.0.2] - 2026-05-06

### Fixed

本番環境（Azure App Service + Azure SQL Database）で発生していた LINE OAuth ログインの障害を修正。

- LINE OAuth ユーザー作成時のクラッシュを修正 (#14)
  - signIn コールバックで `prisma.user.update()` がレコード未存在時に失敗していた問題を `upsert` に変更して解消
- セッションクッキーが Azure プロキシ環境で発行されない問題を修正 (#15)
  - `sessionToken` / `callbackUrl` / `csrfToken` を非Secureクッキー名で明示設定
- LINE プロファイルに email がない場合のユーザー作成失敗を修正 (#15)
  - LINE User ID から合成 email (`{sub}@line.local`) を生成して UNIQUE 制約衝突を回避

### Notes

- 本リリース適用時に、本番DBに残っていた email=NULL のオーファンユーザー1件を手動削除して復旧
- 本番 App Service の環境変数 `NEXTAUTH_URL` から末尾スラッシュを除去（プロキシ環境でのコールバックURL生成不整合を解消）

## [1.0.1] - 2026-05-06

### Added

- フッターにアプリバージョン表示を追加
- master マージで GitHub Release を自動作成するワークフロー (`release.yml`) を追加

### Fixed

- LINE OAuth の State cookie が Azure App Service プロキシ環境で読み取れない問題を修正 (#11, #12)
  - 初版修正 (#11): `state` / `pkceCodeVerifier` / `nonce` のクッキー名を明示
  - 追加修正 (#12): `useSecureCookies: false` で `__Secure-` プレフィックス付与を抑止し、SSL終端後のHTTP接続でも一貫したクッキー名を使うよう変更

## [1.0.0] - 2026-05-06

初版リリース。

### Added

#### 認証・ユーザー管理
- LINE OAuth によるログイン (NextAuth.js v4)
- ロール (admin / subadmin / member / visitor / guest) ベースの権限管理
- 仮アカウント作成と LINE 招待トークンによる本登録フロー
- 招待完了時に visitor から member へ自動昇格
- LINE 内ブラウザ検出と外部ブラウザ起動の案内

#### イベント・出欠
- イベントの作成・編集・削除（管理者）
- イベント終了時刻、定員、参加費、締め切りの設定
- 出欠登録 (参加 / 不参加 / キャンセル待ち)
- キャンセル待ちの自動繰り上げ
- 出欠変更履歴の記録
- 管理者による代理出欠登録
- 代理登録時のサーバ側重複バリデーション

#### メンバー管理
- メンバー一覧とプロフィール (ニックネーム / 性別 / 年齢公開設定 / コメント)
- 性別による参加者の色分け表示
- 管理者専用メンバー情報 (スキルレベル 1〜10、管理者メモ)
- 管理者によるメンバー削除

#### 通知 (LINE Messaging API)
- 新規イベント作成時の通知（イベントごとに送信ON/OFF切替可）
- キャンセル待ち繰り上げ時の通知
- イベント前のリマインダー通知（cron エンドポイント経由）
- 管理画面で通知種別ごとのグローバルON/OFF切替

#### インフラ
- Azure App Service (Linux, Node.js 22.x) への DEV / PROD デプロイワークフロー
- Azure SQL Database (Basic 5 DTU) を本番DBに採用、Prisma SQL Server スキーマで対応
- ローカル開発は SQLite + 開発用ログイン (テストユーザー) でLINE依存を回避

[1.1.0]: https://github.com/basaa0283/283-badminton-app/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/basaa0283/283-badminton-app/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/basaa0283/283-badminton-app/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/basaa0283/283-badminton-app/releases/tag/v1.0.0
