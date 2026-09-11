-- 13a-customer_models.sql
-- Saved appliances per customer. Not run yet.
-- Save the result grid as: customer_models.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.customer_models') IS NOT NULL
  SELECT 'customer_models' AS _table, idCust, idModel, dateAdded FROM filtersfast.customer_models ORDER BY idCust;
ELSE IF OBJECT_ID('dbo.customer_models') IS NOT NULL
  SELECT 'customer_models' AS _table, idCust, idModel, dateAdded FROM dbo.customer_models ORDER BY idCust;
ELSE
BEGIN
  PRINT 'MISSING TABLE: customer_models';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%customer%mod%' ORDER BY s.name, t.name;
END
