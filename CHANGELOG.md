# Changelog

このドキュメントは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) の形式に基づいて記述されています。
本プロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) (`MAJOR.MINOR.PATCH`) に従います。

## [1.4.0] - 2026-05-16

### Added

- 会計機能 Phase 1: イベントごとの経費・収支管理を追加 (#24)
  - イベント詳細ページに「経費・収支」セクションを追加（管理者のみ表示）
  - 入力項目: シャトル個数 / シャトル代 / 体育館代 / その他経費 + メモ / 実集金額
  - 収支 = 実集金額 − 経費合計 を自動算出
  - 管理画面に「経費レポート」ページを新設、過去イベントの収支一覧と合計を表示
- シャトル単価マスタ機能を追加
  - 管理画面に「シャトル単価」ページを新設、期間ごとのケース単価を登録
  - イベント開催日に対し最新の単価が自動適用、個数入力でシャトル代を自動算出
  - 現在適用中の単価を一覧でハイライト表示
- 管理者向け「参加者管理」セクションをイベント詳細に追加
  - **過去イベント**でも出欠ステータスを書き換え可能（運用ミスや当日キャンセル対応）
  - 参加者リストから出席メンバーを直接追加可能
  - 各 attending メンバーに「受取済み」チェック + 金額入力 (デフォルト = `event.fee`)
  - イレギュラーな金額/割引はメンバーごとに個別調整可能
- ヘッダーナビゲーションを整理
  - タブ名をホームのカードと統一（イベント一覧 / メンバー / プロフィール / 管理）
  - ログアウトを右上アバターのドロップダウンに移動
  - メンバータブは管理者のみ表示（API側の権限と整合）
- メンバー一覧 (`/members`) でメンバー名タップ時、管理者なら管理詳細画面に遷移
- イベント作成・編集 UI を改善
  - 開催日時を「年/月/日」3select + 「開始時刻/終了時刻 (30分刻み、必要に応じて1分単位)」に分割
  - 新規作成時は開催日に今日をプリセット
  - 場所は過去使用した施設からの autocomplete + チップで最近5件をワンタップ入力
  - LINE通知のデフォルトを OFF に変更
- メンバー情報の年齢入力を生年月日に変更
  - 生年月日からの自動年齢計算 (毎年再入力が不要)
  - 「生年月日・年齢を他のメンバーに公開する」設定を維持
  - **既存ユーザーの age データは初期化されます。新UIから生年月日を再登録してください。**
- イベント詳細の管理者セクション名を「参加者管理 (管理者)」→「代理出欠管理」に変更
- イベント詳細の各カード間に余白を統一
- E2E テスト基盤の整備
  - Playwright 導入、スモーク〜主要動線まで 22 ケース追加
  - iOS Safari (WebKit) / Android Chrome ビューポートでの動作確認も自動化
  - `dev/release` への push、`master` 向け PR で GitHub Actions が自動実行
  - 過去のリグレッション (v1.3.0 / v1.3.1) も検出対象に
- 自動生成されるテストケース一覧 (`docs/E2E_TEST_CASES.md`)
- リリース後検証チェックリスト (`docs/RELEASE_VERIFICATION.md`)

## [1.3.1] - 2026-05-16

### Fixed

- LINEログイン後に `User.lineId` / `User.profileImageUrl` が DB に同期されない問題を修正
  - `@auth/prisma-adapter` v2 + NextAuth v4 の組み合わせで `user.id` が DB の CUID と一致しないため、Account 行経由で DB の userId を解決するよう変更
  - LINE 情報の同期処理を `events.signIn` から `jwt` callback に移動し、確実に走るように
  - これにより管理画面でメンバーの LINE アイコンが表示されない、LINE 通知が届かないといった不具合を解消

## [1.3.0] - 2026-05-07

### Added

- フッターのバージョン表示に環境 suffix を追加（DEV: `+dev`, ローカル: `+local`, PROD: なし）
- 管理画面のメンバー一覧でゲスト権限のアカウントも表示（自己登録ユーザーを把握可能に）

### Fixed

- 管理者が自分自身を編集しようとした際、`role` を変更していなくても「自分自身の権限は変更できません」エラーで保存できなかった問題を修正
- 代理出欠登録で、対象メンバーが既に参加/不参加を回答していても「参加」「不参加」ボタンが未選択状態で表示され、現在の回答が分からなかった問題を修正
- 招待リンク完了処理（`/invite/complete`）が二重実行され、2回目で「招待リンクが見つかりません」エラーが表示されていた問題を修正

### Changed

- LIFF（LINE in-app browser）統合を削除（無限ループ等の不具合を解消）。今後の再挑戦は #21 で追跡

## [1.2.0] - 2026-05-06

### Added

- LINE プロフィール画像を `User.profileImageUrl` に自動同期（メンバー一覧などにLINEアイコンが表示される）
- スキルレベル定義（区民大会・公式戦・都内オープン3軸でマッピング）を追加
  - 範囲を `1-10` から `0-10` に拡張（Lv.0 = サークル基準未達）
  - 管理画面のメンバー詳細に「定義を見る」モーダルを追加
- 単体テスト基盤の拡充（カバレッジ 8% → 88%）
  - Vitest + React Testing Library で 218 件のテスト追加
  - CI でカバレッジレポートを artifact として保存
- 開発運用ルールを `CLAUDE.md` に明文化（master向けリリースは確認必須）

### Fixed

- イベント詳細ページで未回答時に「参加」ボタンが選択済みのように見えるUX問題を修正
  - 未回答状態は両ボタン未選択・送信ボタン disabled に
- LINE OAuth signIn コールバックが重複ユーザーを作成しうる問題を修正
  - `upsert` を `update`-only に変更し、想定外のIDで新規作成しないよう防御
- iOS Safari で LINE ログインが「State cookie was missing」エラーで完走できない問題を修正
  - カスタムCookie設定を削除しNextAuthデフォルト（`__Secure-`プレフィックス・`maxAge` 付き永続Cookie）に切替

### Notes

- **iOS Safari プライベートモードではOAuth系ログイン全般が動作しません**（Safari の Cookie 制限による仕様）。通常モードでご利用ください。

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

[1.4.0]: https://github.com/basaa0283/283-badminton-app/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/basaa0283/283-badminton-app/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/basaa0283/283-badminton-app/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/basaa0283/283-badminton-app/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/basaa0283/283-badminton-app/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/basaa0283/283-badminton-app/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/basaa0283/283-badminton-app/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/basaa0283/283-badminton-app/releases/tag/v1.0.0
