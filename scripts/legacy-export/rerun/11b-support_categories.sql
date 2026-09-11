-- 11b-support_categories.sql
-- Support center categories.
-- Save the result grid as: support_categories.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.support_categories') IS NOT NULL
  SELECT 'support_categories' AS _table, idCategory, categoryName, categoryImage, categoryURL, categorySortOrder, categoryActive, categoryVisible, categoryBot
  FROM filtersfast.support_categories ORDER BY categorySortOrder;
ELSE IF OBJECT_ID('dbo.support_categories') IS NOT NULL
  SELECT 'support_categories' AS _table, idCategory, categoryName, categoryImage, categoryURL, categorySortOrder, categoryActive, categoryVisible, categoryBot
  FROM dbo.support_categories ORDER BY categorySortOrder;
ELSE
BEGIN
  PRINT 'MISSING TABLE: support_categories';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%support%cate%' ORDER BY s.name, t.name;
END
