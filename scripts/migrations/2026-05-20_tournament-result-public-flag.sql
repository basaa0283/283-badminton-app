-- =====================================================================
-- 2026-05-20_tournament-result-public-flag.sql
--
-- TournamentResult に「公開/非公開」フラグを追加する。
--   isPublic = 0 (デフォルト): 本人と管理者のみ閲覧可
--   isPublic = 1:                サークル内の他メンバーにも閲覧可
--
-- 既存行は default 0 で埋まる (= 全部非公開) ので、公開したいものだけ
-- 利用者が編集で公開に切り替える運用。
--
-- 対象: Azure SQL Database (DEV / PROD)。
-- 適用方法:
--   1. Azure Portal の SQL Database クエリエディタにこのファイルを貼り付ける
--   2. ROLLBACK のまま実行 → 末尾の SELECT で isPublic 列が見えることを確認
--   3. ROLLBACK を COMMIT に書き換えて再実行 → 確定
-- =====================================================================

BEGIN TRAN

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('[TournamentResult]') AND name = 'isPublic'
)
BEGIN
  ALTER TABLE [TournamentResult]
    ADD [isPublic] BIT NOT NULL
    CONSTRAINT [TournamentResult_isPublic_df] DEFAULT 0;
END

SELECT name AS column_name
FROM sys.columns
WHERE object_id = OBJECT_ID('[TournamentResult]') AND name = 'isPublic';

-- 確認 OK なら ROLLBACK を COMMIT に書き換えて再実行
ROLLBACK
