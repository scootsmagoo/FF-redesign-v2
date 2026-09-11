-- 13a-customer_models.sql
-- Saved appliances per customer ("Appliance Profile").
-- Save the result grid as: customer_models.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 13-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.customer_models') IS NOT NULL
  SELECT 'customer_models' AS _table, idCust, idModel, dateAdded FROM customer_models ORDER BY idCust;
ELSE
BEGIN
  PRINT 'MISSING TABLE: customer_models';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('customerModels', 'cust_models', 'tCustomerModels')
     OR t.name LIKE '%customer%mod%'
  ORDER BY t.name;
END
