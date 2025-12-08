# システム設計書

## システム概要

283バドミントンサークルのイベント出欠管理システム。
メンバーがLINEアカウントでログインし、練習会などのイベントへの参加・不参加を登録できる。

---

## システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                        クライアント                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   PC/Mac    │  │  スマホ     │  │  タブレット  │         │
│  │  (ブラウザ)  │  │ (ブラウザ)  │  │  (ブラウザ)  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼───────────────┼───────────────┼───────────────────┘
          │               │               │
          └───────────────┼───────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Azure App Service                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Next.js 16                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │  App Router │  │  API Routes │  │  NextAuth   │   │  │
│  │  │   (SSR)     │  │   (REST)    │  │ (LINE OAuth)│   │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │  │
│  │         │                │                │           │  │
│  │         └────────────────┼────────────────┘           │  │
│  │                          │                            │  │
│  │                   ┌──────▼──────┐                     │  │
│  │                   │   Prisma    │                     │  │
│  │                   │    ORM      │                     │  │
│  │                   └──────┬──────┘                     │  │
│  └──────────────────────────┼────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Azure SQL Database                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │  User   │  │  Event  │  │Attendance│  │ Message │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
└─────────────────────────────────────────────────────────────┘

                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     LINE Platform                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   LINE Login                         │    │
│  │              (OAuth 2.0 + OpenID Connect)            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## データベース設計

### ER図

```
┌─────────────────┐       ┌─────────────────┐
│      User       │       │     Account     │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │
│ lineId          │  │    │ userId (FK)     │──┐
│ name            │  │    │ type            │  │
│ email           │  │    │ provider        │  │
│ nickname        │  │    │ providerAccountId│  │
│ firstName       │  │    │ access_token    │  │
│ lastName        │  │    │ refresh_token   │  │
│ gender          │  │    │ id_token        │  │
│ age             │  │    └─────────────────┘  │
│ ageVisible      │  │                         │
│ comment         │  │    ┌─────────────────┐  │
│ role            │  │    │     Session     │  │
│ createdAt       │  │    ├─────────────────┤  │
│ updatedAt       │  └────│ userId (FK)     │──┘
└────────┬────────┘       │ sessionToken    │
         │                │ expires         │
         │                └─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐       ┌─────────────────┐
│     Event       │       │   Attendance    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │
│ title           │  │    │ userId (FK)     │──┐
│ description     │  │    │ eventId (FK)    │──┤
│ eventDate       │  │    │ status          │  │
│ location        │  │    │ comment         │  │
│ capacity        │  │    │ position        │  │
│ fee             │  │    │ createdAt       │  │
│ feeVisible      │  │    │ updatedAt       │  │
│ deadline        │  │    └─────────────────┘  │
│ deadlineEnabled │  │                         │
│ createdById(FK) │──┤    ┌─────────────────┐  │
│ createdAt       │  │    │     Message     │  │
│ updatedAt       │  │    ├─────────────────┤  │
└─────────────────┘  │    │ id (PK)         │  │
                     │    │ eventId (FK)    │──┘
                     │    │ senderId (FK)   │──┐
                     │    │ targetType      │  │
                     │    │ content         │  │
                     └────│ sentAt          │  │
                          └─────────────────┘  │
                                               │
                          User ◄───────────────┘
```

### テーブル定義

#### User（ユーザー）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String | プライマリキー (cuid) |
| lineId | String? | LINE User ID |
| name | String? | NextAuth標準（LINE表示名） |
| email | String? | NextAuth標準 |
| nickname | String | 表示名（公開） |
| firstName | String? | 名（非公開） |
| lastName | String? | 姓（非公開） |
| gender | String? | 性別 (male/female) |
| age | Int? | 年齢 |
| ageVisible | Boolean | 年齢公開フラグ |
| comment | String? | 自己紹介 |
| role | String | 権限 (admin/subadmin/member/visitor/guest) |
| createdAt | DateTime | 作成日時 |
| updatedAt | DateTime | 更新日時 |

#### Event（イベント）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String | プライマリキー (cuid) |
| title | String | イベント名 |
| description | String? | 説明 |
| eventDate | DateTime | 開催日時 |
| location | String? | 場所 |
| capacity | Int? | 定員（nullで無制限） |
| fee | Int? | 参加費 |
| feeVisible | Boolean | 参加費表示フラグ |
| deadline | DateTime? | 締め切り日時 |
| deadlineEnabled | Boolean | 締め切り有効フラグ |
| createdById | String | 作成者ID |
| createdAt | DateTime | 作成日時 |
| updatedAt | DateTime | 更新日時 |

#### Attendance（出欠）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String | プライマリキー (cuid) |
| userId | String | ユーザーID |
| eventId | String | イベントID |
| status | String | 状態 (attending/not_attending/waitlist) |
| comment | String? | コメント |
| position | Int? | キャンセル待ち順 |
| createdAt | DateTime | 作成日時 |
| updatedAt | DateTime | 更新日時 |

---

## 認証・認可設計

### 認証フロー

```
1. ユーザーが「LINEでログイン」をクリック
2. LINE認証画面にリダイレクト
3. ユーザーがLINEで認証
4. コールバックURLにリダイレクト
5. NextAuthがJWTトークンを発行
6. セッションCookieを設定
7. アプリにリダイレクト
```

### 権限マトリックス

| 機能 | admin | subadmin | member | visitor | guest |
|------|:-----:|:--------:|:------:|:-------:|:-----:|
| イベント閲覧 | ○ | ○ | ○ | ○ | ○ |
| 出欠登録 | ○ | ○ | ○ | ○ | ○ |
| 参加者一覧閲覧 | ○ | ○ | ○ | × | × |
| イベント作成/編集/削除 | ○ | ○ | × | × | × |
| メンバー詳細閲覧 | ○ | ○ | ○ | × | × |
| 権限変更 | ○ | ○ | × | × | × |
| 管理画面アクセス | ○ | ○ | × | × | × |

### 権限チェック実装

```typescript
// src/lib/permissions.ts
export function canManageEvents(role: string): boolean {
  return role === "admin" || role === "subadmin";
}

export function canViewAttendees(role: string): boolean {
  return role === "admin" || role === "subadmin" || role === "member";
}
```

---

## キャンセル待ちロジック

### フロー

```
1. 参加登録時
   ├── 定員なし → attending で登録
   └── 定員あり
       ├── 空きあり → attending で登録
       └── 空きなし → waitlist で登録（position = 最大+1）

2. キャンセル時
   └── attending の人がキャンセル
       └── waitlist の position=1 の人を attending に繰り上げ
           └── 残りの waitlist の position を -1
```

### 実装

```typescript
// キャンセル待ち繰り上げ
async function promoteFromWaitlist(eventId: string) {
  const nextInLine = await prisma.attendance.findFirst({
    where: { eventId, status: "waitlist" },
    orderBy: { position: "asc" },
  });

  if (nextInLine) {
    await prisma.attendance.update({
      where: { id: nextInLine.id },
      data: { status: "attending", position: null },
    });

    // 残りの順番を繰り上げ
    await prisma.attendance.updateMany({
      where: { eventId, status: "waitlist" },
      data: { position: { decrement: 1 } },
    });
  }
}
```

---

## 環境構成

### ローカル開発

| コンポーネント | 技術 |
|---------------|------|
| アプリケーション | Next.js (localhost:3000) |
| データベース | SQLite (file:./dev.db) |
| 認証 | NextAuth.js + LINE OAuth |

### DEV環境

| コンポーネント | 技術 |
|---------------|------|
| ホスティング | Azure App Service (Linux) |
| データベース | Azure SQL Database |
| 認証 | NextAuth.js + LINE OAuth |
| CI/CD | GitHub Actions |

### 環境変数

| 変数 | ローカル | DEV |
|------|---------|-----|
| DATABASE_URL | file:./dev.db | sqlserver://... |
| NEXTAUTH_URL | http://localhost:3000 | https://dev-283-badminton-app.azurewebsites.net |
| NEXTAUTH_SECRET | ローカル用シークレット | 本番用シークレット |
| LINE_CHANNEL_ID | 共通 | 共通 |
| LINE_CHANNEL_SECRET | 共通 | 共通 |

---

## セキュリティ

### 認証

- LINE OAuth 2.0 + OpenID Connect
- JWT セッション（サーバーサイドで検証）
- HTTPS必須（本番環境）

### データ保護

- 姓名は管理者のみ閲覧可能
- 年齢は公開設定可能
- パスワードはシステム内で保持しない（LINE認証のみ）

### API保護

- 全APIでセッション検証
- 権限に応じたアクセス制御
- 入力値バリデーション（Zod）

---

## 将来の拡張

### Phase 2（予定）

- LINE通知機能（キャンセル待ち繰り上げ通知）
- イベントリマインダー
- 出欠統計・レポート

### Phase 3（予定）

- 本番環境構築
- バックアップ・リカバリ
- 監視・アラート

---

*最終更新: 2024年12月*
