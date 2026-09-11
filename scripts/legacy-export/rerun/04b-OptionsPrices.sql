-- 04b-OptionsPrices.sql
-- Per-product option price overrides.
-- Save the result grid as: OptionsPrices.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 04-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.OptionsPrices') IS NOT NULL
  SELECT 'OptionsPrices' AS _table, idProduct, idOption, optPrice, optListPrice, optCgs, optGoogleMinAutoDisc
  FROM OptionsPrices ORDER BY idProduct, idOption;
ELSE
BEGIN
  PRINT 'MISSING TABLE: OptionsPrices';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('optionsPrices', 'optionPrices', 'productOptionPrices')
     OR t.name LIKE '%OptionsPrice%'
  ORDER BY t.name;
END
