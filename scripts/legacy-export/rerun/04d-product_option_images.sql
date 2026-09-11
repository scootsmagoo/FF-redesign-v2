-- 04d-product_option_images.sql
-- Image per product+option (swatches).
-- Save the result grid as: product_option_images.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.product_option_images') IS NOT NULL
  SELECT 'product_option_images' AS _table, idProduct, idOption, optionImageUrl
  FROM filtersfast.product_option_images ORDER BY idProduct, idOption;
ELSE IF OBJECT_ID('dbo.product_option_images') IS NOT NULL
  SELECT 'product_option_images' AS _table, idProduct, idOption, optionImageUrl
  FROM dbo.product_option_images ORDER BY idProduct, idOption;
ELSE
BEGIN
  PRINT 'MISSING TABLE: product_option_images';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%product%opti%' ORDER BY s.name, t.name;
END
