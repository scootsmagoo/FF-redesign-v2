-- 11c-support_articles.sql
-- Support center articles (content flattened to one line).
-- Save the result grid as: support_articles.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.support_articles') IS NOT NULL
  SELECT 'support_articles' AS _table, idArticle, articleURL, articleTitle,
         REPLACE(REPLACE(CAST(articleContent AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS articleContent, articleKeywords
  FROM filtersfast.support_articles ORDER BY idArticle;
ELSE IF OBJECT_ID('dbo.support_articles') IS NOT NULL
  SELECT 'support_articles' AS _table, idArticle, articleURL, articleTitle,
         REPLACE(REPLACE(CAST(articleContent AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS articleContent, articleKeywords
  FROM dbo.support_articles ORDER BY idArticle;
ELSE
BEGIN
  PRINT 'MISSING TABLE: support_articles';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%support%arti%' ORDER BY s.name, t.name;
END
