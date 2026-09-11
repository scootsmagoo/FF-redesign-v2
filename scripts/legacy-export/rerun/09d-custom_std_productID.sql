-- 09d-custom_std_productID.sql
-- Standard product -> custom-filter product mapping.
-- Save the result grid as: custom_std_productID.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 09-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.custom_std_productID') IS NOT NULL
  SELECT 'custom_std_productID' AS _table, product_id, custom_id, [type], depth FROM custom_std_productID ORDER BY product_id;
ELSE
BEGIN
  PRINT 'MISSING TABLE: custom_std_productID';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('custom_std_productid', 'customStdProductID')
     OR t.name LIKE '%custom%std%p%'
  ORDER BY t.name;
END
