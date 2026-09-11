-- 11f-redirectHub.sql
-- Keyword redirects (all types; the model-only subset was already exported as redirectHub_models).
-- Save the result grid as: redirectHub.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 11-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.redirectHub') IS NOT NULL
  SELECT 'redirectHub' AS _table, keyword, idProduct, directPagename, typeID FROM redirectHub ORDER BY typeID, keyword;
ELSE
BEGIN
  PRINT 'MISSING TABLE: redirectHub';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('redirect_hub', 'tRedirectHub')
     OR t.name LIKE '%redirectHub%'
  ORDER BY t.name;
END
