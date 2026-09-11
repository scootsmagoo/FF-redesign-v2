-- 12b-currencyRates.sql
-- Currency conversion rates (currencyUpdate.asp). Not run yet.
-- Save the result grid as: currencyRates.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.currencyRates') IS NOT NULL
  SELECT 'currencyRates' AS _table, cName, cRate, cDate FROM filtersfast.currencyRates;
ELSE IF OBJECT_ID('dbo.currencyRates') IS NOT NULL
  SELECT 'currencyRates' AS _table, cName, cRate, cDate FROM dbo.currencyRates;
ELSE
BEGIN
  PRINT 'MISSING TABLE: currencyRates';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%currencyRate%' ORDER BY s.name, t.name;
END
