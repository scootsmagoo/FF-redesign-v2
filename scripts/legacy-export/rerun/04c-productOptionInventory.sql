-- 04c-productOptionInventory.sql
-- Per-product option stock and availability flags.
-- Save the result grid as: productOptionInventory.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.productOptionInventory') IS NOT NULL
  SELECT 'productOptionInventory' AS _table, idProduct, idOption, stock, Unavailable, Blocked, reasonCode, updateCPStock, dropShip, specialOrder
  FROM filtersfast.productOptionInventory ORDER BY idProduct, idOption;
ELSE IF OBJECT_ID('dbo.productOptionInventory') IS NOT NULL
  SELECT 'productOptionInventory' AS _table, idProduct, idOption, stock, Unavailable, Blocked, reasonCode, updateCPStock, dropShip, specialOrder
  FROM dbo.productOptionInventory ORDER BY idProduct, idOption;
ELSE
BEGIN
  PRINT 'MISSING TABLE: productOptionInventory';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%productOptio%' ORDER BY s.name, t.name;
END
