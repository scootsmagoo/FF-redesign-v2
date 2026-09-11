-- 13b-product_order_reminders.sql
-- Active filter-change reminders per customer. Not run yet.
-- Save the result grid as: product_order_reminders.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.product_order_reminders') IS NOT NULL
  SELECT 'product_order_reminders' AS _table, idCust, idProduct, idOption, idOrder, remindIn, remindActive
  FROM filtersfast.product_order_reminders WHERE remindActive = 1 ORDER BY idCust;
ELSE IF OBJECT_ID('dbo.product_order_reminders') IS NOT NULL
  SELECT 'product_order_reminders' AS _table, idCust, idProduct, idOption, idOrder, remindIn, remindActive
  FROM dbo.product_order_reminders WHERE remindActive = 1 ORDER BY idCust;
ELSE
BEGIN
  PRINT 'MISSING TABLE: product_order_reminders';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%product%orde%' ORDER BY s.name, t.name;
END
