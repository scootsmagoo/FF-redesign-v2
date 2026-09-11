-- 07a-tsourceprice.sql
-- Channel-specific pricing (Google Shopping, marketplaces).
-- Save the result grid as: tsourceprice.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.tsourceprice') IS NOT NULL
  SELECT 'tsourceprice' AS _table, idproduct, idOption, source, price, adMedium, priceDate
  FROM filtersfast.tsourceprice ORDER BY idproduct, idOption, source;
ELSE IF OBJECT_ID('dbo.tsourceprice') IS NOT NULL
  SELECT 'tsourceprice' AS _table, idproduct, idOption, source, price, adMedium, priceDate
  FROM dbo.tsourceprice ORDER BY idproduct, idOption, source;
ELSE
BEGIN
  PRINT 'MISSING TABLE: tsourceprice';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%tsourceprice%' ORDER BY s.name, t.name;
END
