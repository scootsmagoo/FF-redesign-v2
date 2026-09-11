-- 12b-currencyRates.sql
-- Currency conversion rates (currencyUpdate.asp).
-- Save the result grid as: currencyRates.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 12-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.currencyRates') IS NOT NULL
  SELECT 'currencyRates' AS _table, cName, cRate, cDate FROM currencyRates;
ELSE
BEGIN
  PRINT 'MISSING TABLE: currencyRates';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('currency_rates', 'tCurrencyRates', 'currency')
     OR t.name LIKE '%currencyRate%'
  ORDER BY t.name;
END
