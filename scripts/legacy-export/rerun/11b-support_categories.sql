-- 11b-support_categories.sql
-- Support center categories.
-- Save the result grid as: support_categories.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 11-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.support_categories') IS NOT NULL
  SELECT 'support_categories' AS _table, idCategory, categoryName, categoryImage, categoryURL, categorySortOrder, categoryActive, categoryVisible, categoryBot
  FROM support_categories ORDER BY categorySortOrder;
ELSE
BEGIN
  PRINT 'MISSING TABLE: support_categories';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('supportCategories')
     OR t.name LIKE '%support%cate%'
  ORDER BY t.name;
END
