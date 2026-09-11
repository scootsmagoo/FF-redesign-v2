-- 11f-redirectHub.sql
-- Keyword redirects (all types).
-- Save the result grid as: redirectHub.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.redirectHub') IS NOT NULL
  SELECT 'redirectHub' AS _table, keyword, idProduct, directPagename, typeID FROM filtersfast.redirectHub ORDER BY typeID, keyword;
ELSE IF OBJECT_ID('dbo.redirectHub') IS NOT NULL
  SELECT 'redirectHub' AS _table, keyword, idProduct, directPagename, typeID FROM dbo.redirectHub ORDER BY typeID, keyword;
ELSE
BEGIN
  PRINT 'MISSING TABLE: redirectHub';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%redirectHub%' ORDER BY s.name, t.name;
END
