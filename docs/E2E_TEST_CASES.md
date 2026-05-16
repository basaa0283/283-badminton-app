# E2E テストケース一覧

> このドキュメントは `scripts/generate-e2e-docs.ts` で自動生成されています。
> 手動編集せず、`npm run docs:e2e` で再生成してください。

- 生成日時: 2026-05-16T07:11:02.715Z
- テスト数: 20
- ファイル数: 13

## ファイル別一覧

### `e2e/admin-edit-others.spec.ts`

#### 管理者による他メンバー編集

- admin が他メンバーの nickname / skillLevel / adminNote を更新できる

### `e2e/admin-members.spec.ts`

#### 管理画面 メンバー編集 (admin)

- 管理者が自分自身の情報を role 据置きで保存できる
- 管理者が自分自身の role を変更しようとすると 403 になる

### `e2e/attendance.spec.ts`

#### 出欠登録

- イベント詳細から参加→不参加に切り替えできる

### `e2e/event-edit.spec.ts`

#### イベント編集 (admin)

- 作成したイベントの title / location / capacity を更新できる

### `e2e/events.spec.ts`

#### イベント (admin)

- API でイベント作成 → 一覧に表示 → 削除でクリーンアップ

### `e2e/expenses.spec.ts`

#### 経費・収支管理 (admin)

- イベントに経費を入力して PUT で保存 → GET で取得できる
- UI からイベント詳細で経費を編集・保存できる
- 経費レポートで合計が表示される

### `e2e/guest-visibility.spec.ts`

#### 管理画面メンバー一覧の guest 表示

- guest 権限のユーザーが GET /api/members に含まれる

### `e2e/invite-double-execution.spec.ts`

#### 招待リンク二重実行防止

- 同じトークンで2回 complete を呼ぶと2回目は NOT_FOUND

### `e2e/invite.spec.ts`

#### 招待リンク発行 (admin)

- UI で仮アカウント作成→招待リンク発行→クリーンアップ

### `e2e/navigation.spec.ts`

#### 主要ページのナビゲーション (admin)

- トップから各ページに遷移できる
- イベント一覧ページ: 今後/過去タブが切り替えできる
- メンバー一覧ページが表示される (admin)
- 管理ページが表示される (admin)

### `e2e/profile.spec.ts`

#### プロフィール

- 自分のプロフィールを取得して更新できる (元の値に復元)

### `e2e/proxy-attendance.spec.ts`

#### 代理出欠登録 (admin)

- 既存の回答が代理出欠UIで選択状態として表示される

### `e2e/smoke.spec.ts`

#### smoke

- 未ログインでトップへアクセスするとログインページへリダイレクト
- dev-login で管理者ログインしてトップに遷移する
