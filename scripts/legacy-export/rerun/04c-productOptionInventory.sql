-- 04c-productOptionInventory.sql
-- Per-product option stock and availability flags.
-- Save the result grid as: productOptionInventory.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 04-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.productOptionInventory') IS NOT NULL
  SELECT 'productOptionInventory' AS _table, idProduct, idOption, stock, Unavailable, Blocked, reasonCode, updateCPStock, dropShip, specialOrder
  FROM productOptionInventory ORDER BY idProduct, idOption;
ELSE
BEGIN
  PRINT 'MISSING TABLE: productOptionInventory';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('product_option_inventory', 'optionInventory', 'tOptionInventory')
     OR t.name LIKE '%productOptio%'
  ORDER BY t.name;
END
