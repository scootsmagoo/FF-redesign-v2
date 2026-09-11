-- 11e-support_faqs.sql
-- Articles promoted as FAQs.
-- Save the result grid as: support_faqs.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 11-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.support_faqs') IS NOT NULL
  SELECT 'support_faqs' AS _table, idFAQ, idArticle, OrderSort FROM support_faqs ORDER BY OrderSort;
ELSE
BEGIN
  PRINT 'MISSING TABLE: support_faqs';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('supportFaqs')
     OR t.name LIKE '%support%faqs%'
  ORDER BY t.name;
END
