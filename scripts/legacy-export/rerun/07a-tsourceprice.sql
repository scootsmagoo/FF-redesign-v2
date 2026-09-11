-- 07a-tsourceprice.sql
-- Channel-specific pricing (Google Shopping, marketplaces).
-- Save the result grid as: tsourceprice.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 07-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.tsourceprice') IS NOT NULL
  SELECT 'tsourceprice' AS _table, idproduct, idOption, source, price, adMedium, priceDate
  FROM tsourceprice ORDER BY idproduct, idOption, source;
ELSE
BEGIN
  PRINT 'MISSING TABLE: tsourceprice';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('tSourcePrice', 'sourceprice', 'tsourceprices')
     OR t.name LIKE '%tsourceprice%'
  ORDER BY t.name;
END
