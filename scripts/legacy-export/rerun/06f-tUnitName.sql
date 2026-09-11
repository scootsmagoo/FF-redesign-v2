-- 06f-tUnitName.sql
-- Pack-size unit names (each, 2-pack, case...).
-- Save the result grid as: tUnitName.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 06-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.tUnitName') IS NOT NULL
  SELECT 'tUnitName' AS _table, idUnit, idProduct, unitName, uActive FROM tUnitName ORDER BY idProduct;
ELSE
BEGIN
  PRINT 'MISSING TABLE: tUnitName';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('unitName', 'tUnitNames')
     OR t.name LIKE '%UnitName%'
  ORDER BY t.name;
END
