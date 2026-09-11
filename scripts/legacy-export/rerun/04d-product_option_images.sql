-- 04d-product_option_images.sql
-- Image per product+option (swatches).
-- Save the result grid as: product_option_images.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 04-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.product_option_images') IS NOT NULL
  SELECT 'product_option_images' AS _table, idProduct, idOption, optionImageUrl
  FROM product_option_images ORDER BY idProduct, idOption;
ELSE
BEGIN
  PRINT 'MISSING TABLE: product_option_images';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('productOptionImages', 'option_images')
     OR t.name LIKE '%product%opti%'
  ORDER BY t.name;
END
