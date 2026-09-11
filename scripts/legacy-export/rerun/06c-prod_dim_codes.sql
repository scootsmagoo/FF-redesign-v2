-- 06c-prod_dim_codes.sql
-- Dimension code list (all columns).
-- Save the result grid as: prod_dim_codes.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 06-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.prod_dim_codes') IS NOT NULL
  SELECT 'prod_dim_codes' AS _table, * FROM prod_dim_codes;
ELSE
BEGIN
  PRINT 'MISSING TABLE: prod_dim_codes';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('prodDimCodes', 'product_dim_codes')
     OR t.name LIKE '%prod%dim%cod%'
  ORDER BY t.name;
END
