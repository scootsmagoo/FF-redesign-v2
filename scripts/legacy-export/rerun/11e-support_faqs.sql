-- 11e-support_faqs.sql
-- Articles promoted as FAQs.
-- Save the result grid as: support_faqs.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.support_faqs') IS NOT NULL
  SELECT 'support_faqs' AS _table, idFAQ, idArticle, OrderSort FROM filtersfast.support_faqs ORDER BY OrderSort;
ELSE IF OBJECT_ID('dbo.support_faqs') IS NOT NULL
  SELECT 'support_faqs' AS _table, idFAQ, idArticle, OrderSort FROM dbo.support_faqs ORDER BY OrderSort;
ELSE
BEGIN
  PRINT 'MISSING TABLE: support_faqs';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%support%faqs%' ORDER BY s.name, t.name;
END
