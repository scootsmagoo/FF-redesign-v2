-- 11c-support_articles.sql
-- Support center articles (content flattened to one line).
-- Save the result grid as: support_articles.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 11-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.support_articles') IS NOT NULL
  SELECT 'support_articles' AS _table, idArticle, articleURL, articleTitle,
         REPLACE(REPLACE(CAST(articleContent AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS articleContent, articleKeywords
  FROM support_articles ORDER BY idArticle;
ELSE
BEGIN
  PRINT 'MISSING TABLE: support_articles';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('supportArticles')
     OR t.name LIKE '%support%arti%'
  ORDER BY t.name;
END
