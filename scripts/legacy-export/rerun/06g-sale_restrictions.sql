-- 06g-sale_restrictions.sql
-- State/country sales restrictions per product.
-- Save the result grid as: sale_restrictions.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 06-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.sale_restrictions') IS NOT NULL
  SELECT 'sale_restrictions' AS _table, idProduct, blockedCountry, blockedState FROM sale_restrictions ORDER BY idProduct;
ELSE
BEGIN
  PRINT 'MISSING TABLE: sale_restrictions';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('saleRestrictions', 'sales_restrictions', 'stateRestrictions')
     OR t.name LIKE '%sale%restric%'
  ORDER BY t.name;
END
