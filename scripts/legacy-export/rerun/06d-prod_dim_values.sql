-- 06d-prod_dim_values.sql
-- Dimension values (all columns).
-- Save the result grid as: prod_dim_values.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.prod_dim_values') IS NOT NULL
  SELECT 'prod_dim_values' AS _table, * FROM filtersfast.prod_dim_values;
ELSE IF OBJECT_ID('dbo.prod_dim_values') IS NOT NULL
  SELECT 'prod_dim_values' AS _table, * FROM dbo.prod_dim_values;
ELSE
BEGIN
  PRINT 'MISSING TABLE: prod_dim_values';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%prod%dim%val%' ORDER BY s.name, t.name;
END
