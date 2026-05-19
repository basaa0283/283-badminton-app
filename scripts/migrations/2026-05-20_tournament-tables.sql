-- =====================================================================
-- 2026-05-20_tournament-tables.sql
--
-- 大会実績機能 (v1) のために Tournament と TournamentResult を追加する。
--   - Tournament: 大会マスター (誰でも自分が出場した大会を登録できる)
--   - TournamentResult: 各メンバーの個人成績
--
-- 対象: Azure SQL Database (DEV / PROD)。
-- 適用方法:
--   1. Azure Portal の SQL Database クエリエディタにこのファイルを貼り付ける
--   2. ROLLBACK のまま実行 → 末尾の SELECT で 2 テーブルが見えることを確認
--   3. 末尾の ROLLBACK を COMMIT に書き換えて再実行 → 確定
-- =====================================================================

BEGIN TRAN

-- ---------------------------------------------------------------------
-- Tournament テーブル
-- ---------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Tournament')
BEGIN
  CREATE TABLE [Tournament] (
    [id]          NVARCHAR(1000) NOT NULL CONSTRAINT [Tournament_pkey] PRIMARY KEY,
    [name]        NVARCHAR(200)  NOT NULL,
    [heldAt]      DATETIME2      NOT NULL,
    [tier]        NVARCHAR(50)   NOT NULL,
    [format]      NVARCHAR(50)   NOT NULL,
    [classCount]  INT            NULL,
    [location]    NVARCHAR(200)  NULL,
    [description] NVARCHAR(2000) NULL,
    [createdById] NVARCHAR(1000) NOT NULL,
    [createdAt]   DATETIME2      NOT NULL CONSTRAINT [Tournament_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt]   DATETIME2      NOT NULL
  );

  CREATE INDEX [Tournament_heldAt_idx]     ON [Tournament]([heldAt]);
  CREATE INDEX [Tournament_createdById_idx] ON [Tournament]([createdById]);

  -- createdBy は NoAction (User 削除でカスケードしない)
  ALTER TABLE [Tournament]
    ADD CONSTRAINT [Tournament_createdById_fkey]
    FOREIGN KEY ([createdById]) REFERENCES [User]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;
END

-- ---------------------------------------------------------------------
-- TournamentResult テーブル
-- ---------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TournamentResult')
BEGIN
  CREATE TABLE [TournamentResult] (
    [id]           NVARCHAR(1000) NOT NULL CONSTRAINT [TournamentResult_pkey] PRIMARY KEY,
    [tournamentId] NVARCHAR(1000) NOT NULL,
    [userId]       NVARCHAR(1000) NOT NULL,
    [category]     NVARCHAR(20)   NOT NULL,
    [className]    NVARCHAR(50)   NULL,
    [rank]         NVARCHAR(100)  NULL,
    [partnerName]  NVARCHAR(100)  NULL,
    [note]         NVARCHAR(2000) NULL,
    [createdAt]    DATETIME2      NOT NULL CONSTRAINT [TournamentResult_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt]    DATETIME2      NOT NULL
  );

  CREATE INDEX [TournamentResult_userId_idx]       ON [TournamentResult]([userId]);
  CREATE INDEX [TournamentResult_tournamentId_idx] ON [TournamentResult]([tournamentId]);

  -- tournament 側は Cascade、user 側は NoAction (multi-cascade-path 回避)
  ALTER TABLE [TournamentResult]
    ADD CONSTRAINT [TournamentResult_tournamentId_fkey]
    FOREIGN KEY ([tournamentId]) REFERENCES [Tournament]([id])
    ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE [TournamentResult]
    ADD CONSTRAINT [TournamentResult_userId_fkey]
    FOREIGN KEY ([userId]) REFERENCES [User]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;
END

-- ---------------------------------------------------------------------
-- 確認 SELECT
-- ---------------------------------------------------------------------
SELECT name AS table_name
FROM sys.tables
WHERE name IN ('Tournament', 'TournamentResult')
ORDER BY name;

-- 確認 OK なら ROLLBACK を COMMIT に書き換えて再実行
ROLLBACK
