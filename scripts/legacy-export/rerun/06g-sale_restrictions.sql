-- 06g-sale_restrictions.sql
-- State/country sales restrictions per product.
-- Save the result grid as: sale_restrictions.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.sale_restrictions') IS NOT NULL
  SELECT 'sale_restrictions' AS _table, idProduct, blockedCountry, blockedState FROM filtersfast.sale_restrictions ORDER BY idProduct;
ELSE IF OBJECT_ID('dbo.sale_restrictions') IS NOT NULL
  SELECT 'sale_restrictions' AS _table, idProduct, blockedCountry, blockedState FROM dbo.sale_restrictions ORDER BY idProduct;
ELSE
BEGIN
  PRINT 'MISSING TABLE: sale_restrictions';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%sale%restric%' ORDER BY s.name, t.name;
END
