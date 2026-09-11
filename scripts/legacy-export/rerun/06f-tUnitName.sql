-- 06f-tUnitName.sql
-- Pack-size unit names (each, 2-pack, case...).
-- Save the result grid as: tUnitName.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.tUnitName') IS NOT NULL
  SELECT 'tUnitName' AS _table, idUnit, idProduct, unitName, uActive FROM filtersfast.tUnitName ORDER BY idProduct;
ELSE IF OBJECT_ID('dbo.tUnitName') IS NOT NULL
  SELECT 'tUnitName' AS _table, idUnit, idProduct, unitName, uActive FROM dbo.tUnitName ORDER BY idProduct;
ELSE
BEGIN
  PRINT 'MISSING TABLE: tUnitName';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%UnitName%' ORDER BY s.name, t.name;
END
