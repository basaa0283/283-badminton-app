# 実績 × ポイント × キャンセル抑制 統合システム 設計

- 関連 Issue: #46
- 日付: 2026-06-11
- 状態: ブレスト完了、実装プラン待ち

## 1. 目的

サークル運営でメンバーの貢献を可視化し、当日キャンセルを抑制するための統合的な仕組みを導入する。
ポイント制度を共通基盤として、以下 3 つの機能を連動させる:

1. **実績システム** (アチーブメント): 行動の節目をバッジで認知する
2. **ポイント制度** (#72 を統合): 行動に応じてポイントを加減算する
3. **当日キャンセル抑制**: ペナルティ (= ポイント減点) と運営の可視性で減らす

## 2. データモデル

### 2.1 User に追加

```prisma
model User {
  // 既存フィールド ...
  lifetimePoints  Int @default(0)   // 累積、減らない (経験値/レベル/ランキング用)
  availablePoints Int @default(10)  // 有効、キャンセル待ち優先度に直結
  // 既存の priorityScore は廃止 (availablePoints へ移行)
}
```

### 2.2 Event に追加

```prisma
model Event {
  // 既存フィールド ...
  attendanceBonusPoints Int? // 不人気イベントへの追加ボーナス (任意)
}
```

加算式: `event.attendance` イベント時の delta = `1 + (event.attendanceBonusPoints ?? 0)`

### 2.3 AttendanceHistory に追加

```prisma
model AttendanceHistory {
  // 既存フィールド ...
  cancelType String? // "regular" | "same_day_with_notice" | "same_day_no_notice" | "no_show"
}
```

### 2.4 新規テーブル

```prisma
model PointTransaction {
  id         String   @id @default(cuid())
  userId     String
  delta      Int      // 正=加算、負=減算
  reason     String   // "signup.bonus" / "event.attendance" / "cancel.same_day_with_notice" など
  entityType String?  // "Event" / "TournamentResult" / "Achievement"
  entityId   String?
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([reason])
}

model AchievementUnlock {
  userId        String
  achievementId String   // src/lib/achievements.ts の定数 ID
  unlockedAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, achievementId])
  @@index([achievementId])
}
```

## 3. ポイント加算/減算ルール

### 3.1 加算 (positive)

| イベント | delta | reason | 検知 |
|---|---|---|---|
| 新規メンバー登録 | +10 (= availablePoints の初期値) | `signup.bonus` | 一回限り、自動 |
| イベント参加完了 (attending で開催日を越えた) | +1 + bonus | `event.attendance` | バッチ or 出席確認 UI |
| 大会実績の登録 + 承認 | +1 | `tournament.result_approved` | TournamentResult が approved になったとき |
| 実績バッジ解除 | バッジごと (下記 4 章) | `achievement.<id>` | scanner で自動付与 |

### 3.2 減算 (negative)

| アクション | delta | reason | 検知 |
|---|---|---|---|
| 前日までキャンセル (12h より前) | 0 (PointTransaction レコードは作らない) | — | 自動 (時刻判定) |
| 当日 (12h 以内) キャンセル、アプリ内 = 連絡あり | -1 | `cancel.same_day_with_notice` | 自動 |
| 当日 (12h 以内) キャンセル、連絡なし | -3 | `cancel.same_day_no_notice` | 管理者が AdminAttendanceManager で手動フラグ |
| no-show (参加のまま無断不参加) | -5 | `cancel.no_show` | 管理者が手動フラグ |

### 3.3 規約

- 加算 (delta > 0) は `lifetimePoints` と `availablePoints` の**両方**に反映
- 減算 (delta < 0) は `availablePoints` のみ (lifetime は減らさない → レベル/ランキングは保持)
- `availablePoints` は 0 を下限とする (マイナスにはしない)
- 全ての増減は `PointTransaction` レコードを作成 (delta = 0 はレコードを作らない)
- 新規登録の +10 pt は `lifetimePoints` と `availablePoints` 両方に加算される (= デフォルト値 10 が直接入る + PointTransaction で `signup.bonus +10` を残す)

## 4. 実績バッジ (叩き台、レビュー必要)

### 4.1 定義方法

`src/lib/achievements.ts` にコード定数として定義。各バッジは `{ id, title, description, points, hidden?, condition }` を持つ。

`hidden: true` のバッジは解除されるまで一覧に表示しない (隠しバッジ)。

### 4.2 初期セット (叩き台)

| id | title | points | hidden | 解除条件 |
|---|---|---|---|---|
| `first_attendance` | 初参加 | +5 | no | 初めて出席履歴ができたとき |
| `10_attendances` | 10 回参加 | +10 | no | 累計参加 10 回 |
| `30_attendances` | 30 回参加 | +20 | no | 累計参加 30 回 |
| `first_tournament` | 大会初出場 | +5 | no | 初めて TournamentResult が承認 |
| `5_tournaments` | 大会 5 回登録 | +10 | no | 大会実績 5 件承認 |
| `first_medal` | 大会で初メダル | +10 | no | TournamentResult.placement <= 3 |
| `profile_complete` | プロフィール完成 | +5 | no | 氏名 + 性別 + 生年月日 が全て埋まる (初回のみ) |

**運営が後から隠しバッジを追加**: 「土砂降り参加」「3 年連続所属」「深夜にプロフィール完成」など、運営の遊び心で。コードに追加するだけで scanner が自動で付与する。

## 5. 検知ロジック

### 5.1 ポイント加減算ヘルパー

```ts
// src/lib/points.ts
async function addPoints(userId: string, delta: number, reason: string, entity?: {type: string, id: string}): Promise<void>;
```

- `delta > 0`: lifetime + available 両方に加算
- `delta < 0`: available のみ減算 (0 下限)
- 必ず `PointTransaction` を残す

### 5.2 イベント参加完了の検知

候補 (どちらでも実装可、要選択):
- **A: バッチ実行** — 毎晩 0 時に「前日終了 + attending のままだった」レコードを抽出し、ポイント加算
- **B: 出席確認 UI** — 管理者がイベント開催後に「出席確認」ボタンを押す → そこで加算 + no-show 判定

→ **B を推奨** (no-show 判定と同じ UI で一括処理できる + 「結果入力忘れ」もそこで気付ける)。

### 5.3 キャンセル時の自動減点

`PUT /api/events/[eventId]/attendance` で `status` が `attending` → 他状態に変わるとき:

```ts
const hoursUntilEvent = (event.eventDate.getTime() - now.getTime()) / (3600 * 1000);
if (hoursUntilEvent < 12) {
  // 当日キャンセル (連絡あり)
  await addPoints(userId, -1, "cancel.same_day_with_notice", { type: "Event", id: event.id });
  await prisma.attendanceHistory.update({
    where: ...,
    data: { cancelType: "same_day_with_notice" },
  });
}
```

### 5.4 連絡なし/no-show の手動フラグ

`AdminAttendanceManager` (admin がイベント詳細から開く) に追加:

- 「**連絡なし当日キャンセル**」ボタン: 該当参加者を選択 → `cancelType = "same_day_no_notice"` + `-3 pt`
- 「**no-show 確定**」ボタン: 該当参加者 (attending のままの人) → `cancelType = "no_show"` + `-5 pt`

両方とも管理者が誤って付けた場合に取消できる UI も必要 (= 取消で `+N pt` 戻す)。

### 5.5 実績バッジスキャナ

`src/lib/achievement-scanner.ts` の `scanAndUnlock(userId)`:

```ts
for (const ach of ACHIEVEMENTS) {
  const already = await prisma.achievementUnlock.findUnique({...});
  if (already) continue;
  if (await ach.condition(userId)) {
    await prisma.achievementUnlock.create({...});
    await addPoints(userId, ach.points, `achievement.${ach.id}`, { type: "Achievement", id: ach.id });
  }
}
```

呼び出しタイミング: `event.attendance` 加算後、`tournament.result_approved` 加算後、プロフィール更新後など。

## 6. キャンセル待ち優先度の連携

既存の `waitlistPolicy = "priority"` モード時、繰り上げ順を `availablePoints` の降順で決定する。
従来の `priorityScore` を `availablePoints` で置き換え、初期マイグレーション時に値を転記する。

## 7. UI

### 7.1 プロフィール (本人)

- レベル/lifetimePoints をカード表示
- バッジ一覧 (解除済み = カラー、未解除 = グレースケール、隠し = 解除前は非表示)
- 直近の PointTransaction (10 件) を「アクティビティ」として表示

### 7.2 メンバー詳細 (admin)

- 本人画面の表示に加え、`availablePoints` 表示
- 手動付与/取消 UI (将来 P5、初期は無し)

### 7.3 公開範囲

- **本人**: 自分の全データ
- **admin**: 全メンバーの全データ
- **一般メンバー**: 当面非公開 (= 段階的、後でランキング判断)

## 8. 段階的実装プラン

| Phase | 内容 | 目安 |
|---|---|---|
| **P1** | スキーマ追加 + `addPoints` ヘルパー + 既存 priorityScore → availablePoints マイグレーション + 新規登録 +10 pt | 中 |
| **P2** | キャンセル抑制ロジック (-1 pt 自動 + AttendanceHistory.cancelType) | 小 |
| **P3** | AdminAttendanceManager に「連絡なし / no-show 確定」ボタン (-3 / -5 pt) + 取消 | 中 |
| **P4** | 実績バッジ定義 + スキャナ + 自動付与 | 中 |
| **P5** | プロフィール画面でレベル/バッジ表示 + PointTransaction 一覧 | 中 |
| **P6** | (将来) 管理画面で手動付与/取消、全体ランキング公開判断 | 小 |

## 9. LINE 通知への影響

- ポイント加減算で LINE push は **送らない** (フリープラン 200 通/月の制約があるため)
- バッジ解除も push は送らない (アプリ内通知のみ)
- 当日キャンセル時の確認ダイアログ内で「-1 pt します」と明示するに留める

## 10. オープン論点 (実装時に確定)

- 既存メンバー (移行時の lifetimePoints / availablePoints 初期値): 全員 0 から始めるか、過去の AttendanceHistory を遡って付与するか
- 実績バッジの初期セット内容 (4.2 はあくまで叩き台)
- 実績バッジの各 pt 値 (4.2 はあくまで叩き台)
- 出席完了検知方法の A/B 決定 (5.2)

---

**次のステップ**: この設計をレビュー → サブ Issue 分解 → writing-plans skill で P1 の実装プラン作成
