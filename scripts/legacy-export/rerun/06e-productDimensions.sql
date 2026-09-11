-- 06e-productDimensions.sql
-- Product to dimension value links.
-- Save the result grid as: productDimensions.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.productDimensions') IS NOT NULL
  SELECT 'productDimensions' AS _table, idProduct, idVal FROM filtersfast.productDimensions ORDER BY idProduct;
ELSE IF OBJECT_ID('dbo.productDimensions') IS NOT NULL
  SELECT 'productDimensions' AS _table, idProduct, idVal FROM dbo.productDimensions ORDER BY idProduct;
ELSE
BEGIN
  PRINT 'MISSING TABLE: productDimensions';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%productDimen%' ORDER BY s.name, t.name;
END
