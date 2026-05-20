-- =====================================================================
-- 2026-05-20_user-tournament-results-public.sql
--
-- User に「大会実績の全体公開スイッチ」(tournamentResultsPublic) を追加。
--   false (デフォルト): 他のメンバーには大会実績を一切見せない
--   true             : サークル内の他メンバーにも見せる (個別 isPublic と AND)
--
-- 既存ユーザーは default 0 (= 非公開) で埋まる。
--
-- 対象: Azure SQL Database (DEV / PROD)。
-- 適用方法:
--   1. Azure Portal の SQL Database クエリエディタにこのファイルを貼り付ける
--   2. ROLLBACK のまま実行 → 末尾の SELECT で列が見えることを確認
--   3. ROLLBACK を COMMIT に書き換えて再実行 → 確定
-- =====================================================================

BEGIN TRAN

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('[User]') AND name = 'tournamentResultsPublic'
)
BEGIN
  ALTER TABLE [User]
    ADD [tournamentResultsPublic] BIT NOT NULL
    CONSTRAINT [User_tournamentResultsPublic_df] DEFAULT 0;
END

SELECT name AS column_name
FROM sys.columns
WHERE object_id = OBJECT_ID('[User]') AND name = 'tournamentResultsPublic';

-- 確認 OK なら ROLLBACK を COMMIT に書き換えて再実行
ROLLBACK
