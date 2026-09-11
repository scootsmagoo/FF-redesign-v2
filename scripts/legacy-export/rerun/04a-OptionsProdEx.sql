-- 04a-OptionsProdEx.sql
-- Per-product option exclusions (option hidden for this product).
-- Save the result grid as: OptionsProdEx.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 04-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.OptionsProdEx') IS NOT NULL
  SELECT 'OptionsProdEx' AS _table, idOptionsProdEx, idProduct, idOption
  FROM OptionsProdEx ORDER BY idProduct, idOption;
ELSE
BEGIN
  PRINT 'MISSING TABLE: OptionsProdEx';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('optionsProdEx', 'options_prod_ex', 'optionProdExclusions')
     OR t.name LIKE '%OptionsProdE%'
  ORDER BY t.name;
END
