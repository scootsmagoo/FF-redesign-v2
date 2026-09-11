-- 09c-custom_size_xref.sql
-- Custom air filter option SKU -> actual size.
-- Save the result grid as: custom_size_xref.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 09-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.custom_size_xref') IS NOT NULL
  SELECT 'custom_size_xref' AS _table, option_sku, actual FROM custom_size_xref ORDER BY option_sku;
ELSE
BEGIN
  PRINT 'MISSING TABLE: custom_size_xref';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('customSizeXref', 'custom_sizes_xref')
     OR t.name LIKE '%custom%size%%'
  ORDER BY t.name;
END
