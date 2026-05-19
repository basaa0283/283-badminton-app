-- =====================================================================
-- 2026-05-20_event-is-all-day.sql
--
-- イベントに「終日 (isAllDay)」フラグを追加する。
-- 既存イベントは default false で「時刻あり」のまま (UI 上は変化なし)。
--
-- 対象: Azure SQL Database (DEV / PROD)。
-- 適用方法:
--   1. Azure Portal の SQL Database クエリエディタにこのファイルを貼り付ける
--      (接続先 DB は prod-283-badminton-app 系 / dev-283-badminton-app 系。
--       master DB ではなくアプリ用 DB を選ぶこと)
--   2. ROLLBACK のまま実行 → 末尾の SELECT で期待結果になっていることを確認
--   3. 末尾の `ROLLBACK` を `COMMIT` に書き換えて再実行 → 確定
--
-- 期待される確認結果:
--   Event_isAllDay   (1 行だけ出ればOK)
-- =====================================================================

BEGIN TRAN

-- isAllDay カラム追加 (default false で既存行も埋まる)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Event') AND name = 'isAllDay'
)
  ALTER TABLE [Event]
    ADD [isAllDay] BIT NOT NULL
    CONSTRAINT [Event_isAllDay_df] DEFAULT 0;

-- 確認
SELECT 'Event_isAllDay' AS section, name
FROM sys.columns
WHERE object_id = OBJECT_ID('Event') AND name = 'isAllDay';

-- 確認 OK なら ROLLBACK を COMMIT に書き換えて再実行
ROLLBACK
