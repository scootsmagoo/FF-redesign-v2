-- 09b-actualSizes.sql
-- Nominal vs actual filter dimensions per product.
-- Save the result grid as: actualSizes.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.actualSizes') IS NOT NULL
  SELECT 'actualSizes' AS _table, idProduct, nomSize, actSize, sActive FROM filtersfast.actualSizes ORDER BY idProduct;
ELSE IF OBJECT_ID('dbo.actualSizes') IS NOT NULL
  SELECT 'actualSizes' AS _table, idProduct, nomSize, actSize, sActive FROM dbo.actualSizes ORDER BY idProduct;
ELSE
BEGIN
  PRINT 'MISSING TABLE: actualSizes';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%actualSizes%' ORDER BY s.name, t.name;
END
