-- =====================================================================
-- 2026-05-20_tournament-v2-restructure.sql
--
-- 大会実績機能の構造変更 (v2):
--   - Tournament に approvalStatus / approvedById / approvedAt / rejectionReason を追加
--   - Tournament.classCount を削除
--   - 新規 TournamentClass テーブル (gender + name + order)
--   - TournamentResult.className 削除 → tournamentClassId FK に置き換え
--
-- 既存 (v1) のテスト登録は破棄する方針なので、Tournament 系テーブルを
-- 一度全て drop して新スキーマで再作成する。
--
-- 対象: Azure SQL Database (DEV / PROD)。
-- 適用方法:
--   1. Azure Portal の SQL Database クエリエディタにこのファイルを貼り付ける
--   2. ROLLBACK のまま実行 → 末尾の SELECT で 3 テーブルが見えることを確認
--   3. 末尾の ROLLBACK を COMMIT に書き換えて再実行 → 確定
-- =====================================================================

BEGIN TRAN

-- ---------------------------------------------------------------------
-- 既存テーブルを drop (FK の依存順)
-- ---------------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TournamentResult')
  DROP TABLE [TournamentResult];

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TournamentClass')
  DROP TABLE [TournamentClass];

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Tournament')
  DROP TABLE [Tournament];

-- ---------------------------------------------------------------------
-- Tournament
-- ---------------------------------------------------------------------
CREATE TABLE [Tournament] (
  [id]              NVARCHAR(1000) NOT NULL CONSTRAINT [Tournament_pkey] PRIMARY KEY,
  [name]            NVARCHAR(200)  NOT NULL,
  [heldAt]          DATETIME2      NOT NULL,
  [tier]            NVARCHAR(50)   NOT NULL,
  [format]          NVARCHAR(50)   NOT NULL,
  [location]        NVARCHAR(200)  NULL,
  [description]     NVARCHAR(2000) NULL,
  [createdById]     NVARCHAR(1000) NOT NULL,
  [approvalStatus]  NVARCHAR(20)   NOT NULL CONSTRAINT [Tournament_approvalStatus_df] DEFAULT 'pending',
  [approvedById]    NVARCHAR(1000) NULL,
  [approvedAt]      DATETIME2      NULL,
  [rejectionReason] NVARCHAR(500)  NULL,
  [createdAt]       DATETIME2      NOT NULL CONSTRAINT [Tournament_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt]       DATETIME2      NOT NULL
);

CREATE INDEX [Tournament_heldAt_idx]         ON [Tournament]([heldAt]);
CREATE INDEX [Tournament_createdById_idx]    ON [Tournament]([createdById]);
CREATE INDEX [Tournament_approvalStatus_idx] ON [Tournament]([approvalStatus]);

ALTER TABLE [Tournament]
  ADD CONSTRAINT [Tournament_createdById_fkey]
  FOREIGN KEY ([createdById]) REFERENCES [User]([id])
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------
-- TournamentClass
-- ---------------------------------------------------------------------
CREATE TABLE [TournamentClass] (
  [id]           NVARCHAR(1000) NOT NULL CONSTRAINT [TournamentClass_pkey] PRIMARY KEY,
  [tournamentId] NVARCHAR(1000) NOT NULL,
  [gender]       NVARCHAR(10)   NOT NULL,
  [name]         NVARCHAR(50)   NOT NULL,
  [order]        INT            NOT NULL CONSTRAINT [TournamentClass_order_df] DEFAULT 0
);

CREATE INDEX [TournamentClass_tournamentId_idx] ON [TournamentClass]([tournamentId]);

ALTER TABLE [TournamentClass]
  ADD CONSTRAINT [TournamentClass_tournamentId_fkey]
  FOREIGN KEY ([tournamentId]) REFERENCES [Tournament]([id])
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- TournamentResult
-- ---------------------------------------------------------------------
CREATE TABLE [TournamentResult] (
  [id]                NVARCHAR(1000) NOT NULL CONSTRAINT [TournamentResult_pkey] PRIMARY KEY,
  [tournamentId]      NVARCHAR(1000) NOT NULL,
  [tournamentClassId] NVARCHAR(1000) NULL,
  [userId]            NVARCHAR(1000) NOT NULL,
  [category]          NVARCHAR(20)   NOT NULL,
  [rank]              NVARCHAR(100)  NULL,
  [partnerName]       NVARCHAR(100)  NULL,
  [note]              NVARCHAR(2000) NULL,
  [createdAt]         DATETIME2      NOT NULL CONSTRAINT [TournamentResult_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt]         DATETIME2      NOT NULL
);

CREATE INDEX [TournamentResult_userId_idx]            ON [TournamentResult]([userId]);
CREATE INDEX [TournamentResult_tournamentId_idx]      ON [TournamentResult]([tournamentId]);
CREATE INDEX [TournamentResult_tournamentClassId_idx] ON [TournamentResult]([tournamentClassId]);

ALTER TABLE [TournamentResult]
  ADD CONSTRAINT [TournamentResult_tournamentId_fkey]
  FOREIGN KEY ([tournamentId]) REFERENCES [Tournament]([id])
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE [TournamentResult]
  ADD CONSTRAINT [TournamentResult_tournamentClassId_fkey]
  FOREIGN KEY ([tournamentClassId]) REFERENCES [TournamentClass]([id])
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [TournamentResult]
  ADD CONSTRAINT [TournamentResult_userId_fkey]
  FOREIGN KEY ([userId]) REFERENCES [User]([id])
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------
-- 確認 SELECT
-- ---------------------------------------------------------------------
SELECT name AS table_name
FROM sys.tables
WHERE name IN ('Tournament', 'TournamentClass', 'TournamentResult')
ORDER BY name;

-- 確認 OK なら ROLLBACK を COMMIT に書き換えて再実行
ROLLBACK
