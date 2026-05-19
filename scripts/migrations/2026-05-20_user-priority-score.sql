-- =====================================================================
-- 2026-05-20_user-priority-score.sql
--
-- キャンセル待ち繰り上げの「優先度順」モードのために
-- User.priorityScore (INT NOT NULL DEFAULT 0) を追加する。
--
-- なお SystemSetting.waitlistPolicy ("fifo" | "priority") は
-- key-value テーブルなのでスキーマ変更は不要。値が未設定 = "fifo" 扱い。
--
-- 対象: Azure SQL Database (DEV / PROD)。
-- 適用方法:
--   1. Azure Portal の SQL Database クエリエディタにこのファイルを貼り付ける
--   2. ROLLBACK のまま実行 → 末尾の SELECT で priorityScore 列が出ることを確認
--   3. 末尾の ROLLBACK を COMMIT に書き換えて再実行 → 確定
-- =====================================================================

BEGIN TRAN

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('[User]') AND name = 'priorityScore'
)
BEGIN
  ALTER TABLE [User]
    ADD [priorityScore] INT NOT NULL
    CONSTRAINT [User_priorityScore_df] DEFAULT 0;
END

-- 確認: priorityScore 列が出ること
SELECT name AS column_name
FROM sys.columns
WHERE object_id = OBJECT_ID('[User]') AND name = 'priorityScore';

-- 確認 OK なら ROLLBACK を COMMIT に書き換えて再実行
ROLLBACK
