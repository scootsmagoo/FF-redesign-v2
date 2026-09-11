-- 09a-search_products.sql
-- Air-filter size -> product/option matrix behind listbysize2.asp. Needed for /air-filters/size pages.
-- Save the result grid as: search_products.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 09-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.search_products') IS NOT NULL
  SELECT 'search_products' AS _table, filterId, idProduct, idOption, size, depth, [type], brand, sizeActive, [row], [column]
  FROM search_products ORDER BY size, depth, [type];
ELSE
BEGIN
  PRINT 'MISSING TABLE: search_products';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('searchProducts', 'search_product', 'tSearchProducts')
     OR t.name LIKE '%search%produ%'
  ORDER BY t.name;
END
