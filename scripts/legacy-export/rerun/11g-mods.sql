-- 11g-mods.sql
-- Site modules/config flags (all columns).
-- Save the result grid as: mods.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 11-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.mods') IS NOT NULL
  SELECT 'mods' AS _table, * FROM mods;
ELSE
BEGIN
  PRINT 'MISSING TABLE: mods';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('tMods', 'siteMods')
     OR t.name LIKE '%mods%'
  ORDER BY t.name;
END
