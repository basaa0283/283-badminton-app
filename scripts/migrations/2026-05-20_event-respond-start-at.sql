-- =====================================================================
-- 2026-05-20_event-respond-start-at.sql
--
-- イベントに「回答開始日時 (respondStartAt)」フィールドを追加する。
-- null なら制限なし (現状と同じ挙動)。値を入れると、その日時より前は
-- 出欠回答 API が 400 NOT_OPEN を返す。
--
-- 対象: Azure SQL Database (DEV / PROD)。
-- 適用方法:
--   1. Azure Portal の SQL Database クエリエディタにこのファイルを貼り付ける
--      (接続先 DB は dev-/prod-283-badminton-app 系。master ではないアプリ用 DB)
--   2. ROLLBACK のまま実行 → 末尾の SELECT で期待結果になっていることを確認
--   3. 末尾の `ROLLBACK` を `COMMIT` に書き換えて再実行 → 確定
--
-- 期待される確認結果:
--   Event_respondStartAt   (1 行だけ出ればOK)
-- =====================================================================

BEGIN TRAN

-- respondStartAt カラムを追加 (nullable、default なし)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Event') AND name = 'respondStartAt'
)
  ALTER TABLE [Event] ADD [respondStartAt] DATETIME2 NULL;

-- 確認
SELECT 'Event_respondStartAt' AS section, name
FROM sys.columns
WHERE object_id = OBJECT_ID('Event') AND name = 'respondStartAt';

-- 確認 OK なら ROLLBACK を COMMIT に書き換えて再実行
ROLLBACK
