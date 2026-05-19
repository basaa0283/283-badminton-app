# Changelog

このドキュメントは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) の形式に基づいて記述されています。
本プロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) (`MAJOR.MINOR.PATCH`) に従います。

## [2.1.0] - 2026-05-19

ベータ運用中のフィードバックを反映した改善・機能追加と、CI 周りの足回り整理。
事前に PROD DB へ `scripts/migrations/2026-05-19_event-role-thresholds.sql` の適用が必要。

### Added

- `/release-notes` ページ: ユーザー向けの更新履歴を「新機能 / 改善 / 修正 / 重要な変更」のラベル付きで表示。フッターからリンク。
- `/about` サークル概要ページ (未ログインでも閲覧可)。`SystemSetting.aboutPageContent` に Markdown を保存し、`/admin/about` のエディタ (textarea + プレビュー) で編集できる。
- 規約同意画面 (`/onboarding/terms`) に「サークルについて (運営方針・練習の流れ)」へのリンクを追加。
- 承認時の LINE 通知: 管理者が pending ユーザーを承認するとそのユーザーの LINE に「ご参加リクエストが承認されました🎉」が届く。
- 出欠ステータスに「見学」を追加: 定員枠を消費せず、管理者だけが付与可能。参加者一覧では「見学 (N)」セクションを別表示。

### Changed

- イベントの公開/回答権限を `visibleToGuest` ブール値から **`minViewRole` / `minRespondRole`** の閾値方式に置き換え。閲覧最低ロール (guest / visitor / member) と回答最低ロール (visitor / member) をイベント毎に設定できる。管理者・副管理者は閾値に関わらず常にアクセス可。
- 招待リンク完了時に visitor → member へ自動昇格する処理を撤廃: 仮アカウントのロールがそのまま受け継がれる。定着後に管理者が手動で member に昇格する運用へ。
- 管理画面のメンバー一覧で性別を `♂ 男` / `♀ 女` のカラーバッジ表示に変更 (区別しやすく)。
- プロフィール画面の「プロフィールを更新しました」表示を「保存する」ボタンの直上に移動。
- `User.lastActiveAt` を出欠回答以外の操作 (画面アクセス等) でも更新するように (5分スロットル)。
- 規約同意フローのリンク導線を整理: ログイン画面の「サークルについて」リンクは削除し、同意画面に集約。
- フッターのお問い合わせを「公式 LINE」一本化 (旧 contactEmail は管理者通知メール用に転用)。
- パイプライン完了通知メールに、コミット本文から `日本語変更点:` / `確認ポイント:` を抽出した日本語サマリーを掲載するように。
- `prisma db push` を App Service 起動時から CI のデプロイジョブに移動。失敗してもデプロイは止めない (continue-on-error) ことで、スキーマドリフト時の継続運用を確保。

### Fixed

- OS のダークモード設定が ON のユーザーで、ホームの「イベント一覧」「プロフィール」リンクや、プロフィール編集の入力済み値が薄いグレーで表示される問題を修正 (アプリをライトテーマ固定に)。
- `BirthdateInput` で月・日のみクリアすると `1991--` のような不正値を発行していた不具合を修正。これに起因する生年月日の意図しない初期化を防止。
- 未同意ユーザーが `/terms` / `/privacy` から「ホームに戻る」を押した際に、ホーム画面が一瞬表示されてから同意画面へ遷移する flash を解消 (Providers にゲートを追加)。
- `/onboarding/pending` を開いたまま管理者承認を待つ場合に、最大 30 秒で自動的にホームへ遷移するようセッションを定期 refetch するように。

### Removed

- イベント詳細の「参加者一覧は一般メンバー以上のみ閲覧できます」空状態カードを削除 (説明過多のためノイズ削減)。
- `EventCategory.visibleToGuest` と `Event.visibleToGuest` カラム (新 `minViewRole` / `minRespondRole` に置き換え。PROD DB へは `scripts/migrations/2026-05-19_event-role-thresholds.sql` を事前適用)。

### Security

- 管理者向けの承認リクエスト通知メール: 自力でゲスト参加した pending ユーザーが規約同意した時点で `SystemSetting.contactEmail` 宛にメールを送信。

## [2.0.0] - 2026-05-17

ベータ公開版の初版。新規ゲスト動線・規約同意・ゲストロールの厳格化など、既存ユーザーの利用フローに影響する変更が含まれるため MAJOR バンプ。

### Added

#### 規約同意フロー
- 利用規約 / プライバシーポリシーへの同意画面 (`/onboarding/terms`)
  - `User.termsAcceptedAt` / `termsAcceptedVersion` で同意記録 (timestamp + version)
  - `src/lib/legal.ts` の `CURRENT_TERMS_VERSION` をバンプすると全ユーザーが再同意必須
  - 規約・PP のリンクを同意画面から開ける (新規タブ)
  - 規約 / PP の本文をベータ公開向けに加筆 (ベータ告知 / 同意記録の明示 / 公式LINE問い合わせ先)

#### 新規参加リクエスト承認フロー
- `pending` ロールを新設 (新規 LINE ログインユーザーのデフォルトを `guest` → `pending` に変更)
- `/onboarding/pending` 承認待ち画面 (公式 LINE への連絡 CTA + 30秒ごとの session 自動 refetch で承認後自動遷移)
- 管理者向けの `/admin/members` ページに「承認待ち」カードを追加
  - ロール選択 (guest / visitor / member) + 承認 / 却下 (削除) アクション
- 管理者向け承認通知
  - ホーム画面 (`/`) に「参加リクエストが N 件届いています」バナー (admin/subadmin のみ、件数 0 で非表示)
  - 自力ゲストが規約同意した時点で `SystemSetting.contactEmail` 宛にメール通知 (Gmail SMTP)

#### ゲスト動線
- `Event.visibleToGuest` フラグ (デフォルト false)
- イベント作成 / 編集フォームに「ゲスト公開」チェックボックス
- ゲスト向けの「公式 LINE で問い合わせ」CTA カード
- 公式 LINE URL を `SystemSetting.officialLineUrl` で管理 (管理画面で編集)

#### お知らせ機能
- `Announcement` モデル + admin の CRUD (`/admin/announcements`)
- ホーム上部に直近 30日以内の最大 3件をバナー表示 + 全件閲覧用 `/announcements` ページ
- 表示対象: 一般 / ビジター / ゲスト の複数選択 (admin/subadmin は常に閲覧可)
- 重要度: 通常 (青) / 重要 (赤) の2段階で色分け
- お知らせの既読管理 (`AnnouncementRead` テーブル)
  - ホームバナーは「重要は常に表示、通常は未読のみ」
  - `/announcements` を開くと表示中の未読を全件まとめて既読化
  - 各カードに「未読」バッジ

#### イベント・出欠
- イベント中止フラグ (削除と区別。中止理由を記録、参加者に表示)
  - イベント詳細から「中止する」ボタン (admin/subadmin)、解除も可能
  - 一覧・詳細で「中止」バッジ + タイトル取り消し線

#### 管理画面
- メンバー一覧をテーブル形式に (検索 / 権限 / 性別 でフィルタ、各列クリックでソート)
- ヘッダーアバターメニューに「プロフィール」を集約 (タブから除外)
- ヘッダーナビゲーションに「お知らせ」タブを追加
- `/admin` 設定: 公式 LINE URL、管理者通知メール、「お問い合わせ先」を分離

#### 規約・PP / ベータ整備
- `/privacy` / `/terms` ページを新設 (サークル内部利用前提の簡潔テンプレ)
- フッターにプライバシーポリシー / 利用規約 / 公式LINE リンク
- バージョン名と環境 suffix をフッター・ログイン画面に表示
- 「２８ばど」ロゴをヘッダー / ログイン画面 / アプリアイコンに採用 (#1d6dca)
- PWA `manifest.json` + アプリアイコン (iOS ホーム画面追加対応)
- サークル名を「２８ばど」(全角) に統一

#### 開発 / 運用
- CI/CD パイプラインを `dev-pipeline.yml` / `prod-pipeline.yml` / `pr-check.yml` に再編
  - test → deploy → e2e → notify の順次実行 (DEV)、test → deploy → release → notify (PROD)
  - E2E は DEV のみ。本番DBを汚染しないため除外
- E2E パイプラインに自動掃除ジョブ (`scripts/e2e-cleanup.ts`) を追加
- 完了メールに「日本語変更点」「確認ポイント」セクションをコミット本文から抽出して載せる仕組み
- ゲスト挙動の E2E (`e2e/guest-role.spec.ts`)

### Changed

- **ゲストロールを閲覧専用に厳格化**
  - 出欠登録 (`canRespondToEvent`) を visitor 以上に
  - メンバー一覧閲覧 (`canViewMemberList`) を subadmin 以上に
  - イベント閲覧は `visibleToGuest=true` のものに限定
- **新規 LINE ログインのデフォルトロールを `guest` → `pending`** に変更 (招待リンク経由は引き続き member に自動昇格)
- フッターの「お問い合わせ」を公式 LINE 一本化 (`SystemSetting.contactEmail` は管理者通知メール用に転用)
- 過去イベント一覧の表示範囲を「当月 + 先月」に絞り、ページング廃止
- シャトル代の算出を「個数 × イベント日時点で適用される単価」に変更
  - 過去イベントで単価未登録だったケースでも、後から該当期間の単価を追加するだけで経費レポート・経費欄に反映される
  - 編集フォームのシャトル代入力欄は廃止 (自動算出値を表示のみ)
- ホーム画面の「あなたの権限」表示を削除 (ヘッダーのアバター部分で確認可能)
- プロフィール保存メッセージ「プロフィールを更新しました」の位置を「保存する」ボタンの直上に移動
- `User.lastActiveAt` を出欠登録だけでなく任意のページアクセスでも更新するように (5分スロットル)

### Fixed

- イベント編集画面で開催日時が UTC で表示され、新規作成時と乖離する不具合を修正
- `BirthdateInput` で月 / 日だけクリアすると `"1991--"` のような不正な値が出て、保存時にサイレントに null 化されるバグを修正
- 未同意ユーザーが `/terms` / `/privacy` の「ホームに戻る」を押した際にホームが一瞬表示される問題を修正
- 新規ログインの flow で旧 Cookie が残っているケース (DB に user が居ない) を検知して自動 sign-out
- 旧 deploy / e2e / release ワークフローの並列実行による「deploy 失敗でも release が作成される」問題を解消

### Removed

- ゲスト・ビジターからのメンバー一覧アクセス (API + ナビゲーションタブ)
- フッターの mailto: お問い合わせリンク (公式 LINE に統合)
- イベント詳細の「参加者一覧は一般メンバー以上のみ閲覧できます」空状態カード (説明過多のため)
- 旧 `deploy-dev.yml` / `deploy-prod.yml` / `e2e.yml` / `release.yml` / `test.yml` (パイプライン統合)
- 過去イベント一覧の `page` / `limit` ページングパラメータ

### Security

- 利用規約 / プライバシーポリシーへの同意を全ユーザーに必須化、同意記録 (timestamp + バージョン) を保持
- 新規ゲストの自動メンバー化を停止し、管理者承認制に変更
- 招待リンクから入った既存メンバー以外の新規ユーザーに対し、デフォルトでイベント情報を非公開化 (`visibleToGuest=false` がデフォルト)

## [1.4.0] - 2026-05-17

### Added

- イベント種別タグ機能
  - 管理画面に「イベント種別」ページを新設、名称と色を登録/編集/削除
  - イベント作成・編集時に種別を選択可能（任意）
  - イベント一覧・詳細で種別を色付きバッジとして表示
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
- 古い JWT セッション Cookie で無限ログインループに陥る問題を防御
  - `session` callback で DB ユーザー未存在を検出した場合、自動でサインアウトし `/login` へ
- デプロイ成功時のメール通知 (DEV/PROD)
  - Gmail SMTP 経由、失敗時は GitHub 標準通知に任せる
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

[2.1.0]: https://github.com/basaa0283/283-badminton-app/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/basaa0283/283-badminton-app/compare/v1.4.0...v2.0.0
[1.4.0]: https://github.com/basaa0283/283-badminton-app/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/basaa0283/283-badminton-app/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/basaa0283/283-badminton-app/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/basaa0283/283-badminton-app/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/basaa0283/283-badminton-app/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/basaa0283/283-badminton-app/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/basaa0283/283-badminton-app/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/basaa0283/283-badminton-app/releases/tag/v1.0.0
