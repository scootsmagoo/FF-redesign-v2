-- 06e-productDimensions.sql
-- Product to dimension value links.
-- Save the result grid as: productDimensions.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 06-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.productDimensions') IS NOT NULL
  SELECT 'productDimensions' AS _table, idProduct, idVal FROM productDimensions ORDER BY idProduct;
ELSE
BEGIN
  PRINT 'MISSING TABLE: productDimensions';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('product_dimensions', 'prodDimensions')
     OR t.name LIKE '%productDimen%'
  ORDER BY t.name;
END
