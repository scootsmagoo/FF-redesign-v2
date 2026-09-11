-- 13b-product_order_reminders.sql
-- Active filter-change reminders per customer.
-- Save the result grid as: product_order_reminders.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 13-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.product_order_reminders') IS NOT NULL
  SELECT 'product_order_reminders' AS _table, idCust, idProduct, idOption, idOrder, remindIn, remindActive
  FROM product_order_reminders WHERE remindActive = 1 ORDER BY idCust;
ELSE
BEGIN
  PRINT 'MISSING TABLE: product_order_reminders';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('productOrderReminders', 'order_reminders', 'reminders')
     OR t.name LIKE '%product%orde%'
  ORDER BY t.name;
END
