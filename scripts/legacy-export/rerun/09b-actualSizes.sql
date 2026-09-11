-- 09b-actualSizes.sql
-- Nominal vs actual filter dimensions per product.
-- Save the result grid as: actualSizes.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 09-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.actualSizes') IS NOT NULL
  SELECT 'actualSizes' AS _table, idProduct, nomSize, actSize, sActive FROM actualSizes ORDER BY idProduct;
ELSE
BEGIN
  PRINT 'MISSING TABLE: actualSizes';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('actual_sizes', 'tActualSizes', 'actualSize')
     OR t.name LIKE '%actualSizes%'
  ORDER BY t.name;
END
