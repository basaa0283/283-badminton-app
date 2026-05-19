-- =====================================================================
-- 2026-05-19_event-role-thresholds.sql
--
-- visibleToGuest フラグを廃止し、Event ごとに「閲覧できる最低ロール」と
-- 「出欠回答できる最低ロール」の閾値方式に切り替えるための SQL。
--
-- 対象: Azure SQL Database (DEV / PROD)。
-- 適用方法:
--   1. Azure Portal の SQL Database クエリエディタにこのファイルを貼り付ける
--   2. ROLLBACK のまま実行 → 末尾の SELECT で期待結果になっていることを確認
--   3. 末尾の `ROLLBACK` を `COMMIT` に書き換えて再実行 → 確定
--
-- 期待される確認結果:
--   Event列        minViewRole
--   Event列        minRespondRole
--   (Event.visibleToGuest は出ない / EventCategory.visibleToGuest も出ない)
-- =====================================================================

BEGIN TRAN

-- ---------------------------------------------------------------------
-- Event テーブル: visibleToGuest → minViewRole / minRespondRole
-- ---------------------------------------------------------------------

-- 1) minViewRole / minRespondRole 追加 (既存行は default 'visitor' で埋まる)
ALTER TABLE [Event]
  ADD [minViewRole] NVARCHAR(1000) NOT NULL
  CONSTRAINT [Event_minViewRole_df] DEFAULT 'visitor';

ALTER TABLE [Event]
  ADD [minRespondRole] NVARCHAR(1000) NOT NULL
  CONSTRAINT [Event_minRespondRole_df] DEFAULT 'visitor';

-- 2) Event.visibleToGuest を default 制約ごと削除
DECLARE @ev_cName NVARCHAR(255);
SELECT @ev_cName = dc.name
FROM sys.default_constraints dc
INNER JOIN sys.columns c
  ON c.default_object_id = dc.object_id
WHERE c.object_id = OBJECT_ID('Event') AND c.name = 'visibleToGuest';
IF @ev_cName IS NOT NULL
  EXEC('ALTER TABLE [Event] DROP CONSTRAINT [' + @ev_cName + ']');
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Event') AND name = 'visibleToGuest'
)
  ALTER TABLE [Event] DROP COLUMN [visibleToGuest];

-- ---------------------------------------------------------------------
-- EventCategory テーブル: visibleToGuest 削除
-- ---------------------------------------------------------------------
DECLARE @ec_cName NVARCHAR(255);
SELECT @ec_cName = dc.name
FROM sys.default_constraints dc
INNER JOIN sys.columns c
  ON c.default_object_id = dc.object_id
WHERE c.object_id = OBJECT_ID('EventCategory') AND c.name = 'visibleToGuest';
IF @ec_cName IS NOT NULL
  EXEC('ALTER TABLE [EventCategory] DROP CONSTRAINT [' + @ec_cName + ']');
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('EventCategory') AND name = 'visibleToGuest'
)
  ALTER TABLE [EventCategory] DROP COLUMN [visibleToGuest];

-- ---------------------------------------------------------------------
-- 確認用 SELECT (ROLLBACK のまま流して期待値かどうか目視する)
-- ---------------------------------------------------------------------
SELECT 'Event列' AS section, name
FROM sys.columns
WHERE object_id = OBJECT_ID('Event')
  AND name IN ('minViewRole', 'minRespondRole', 'visibleToGuest')
UNION ALL
SELECT 'EventCategory列', name
FROM sys.columns
WHERE object_id = OBJECT_ID('EventCategory') AND name = 'visibleToGuest';

-- 確認 OK なら ROLLBACK を COMMIT に書き換えて再実行
ROLLBACK
