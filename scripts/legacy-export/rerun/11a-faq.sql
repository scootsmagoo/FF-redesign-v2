-- 11a-faq.sql
-- Site, product and category FAQs. Line breaks in answers are flattened so rows stay on one line.
-- Save the result grid as: faq.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 11-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.faq') IS NOT NULL
  SELECT 'faq' AS _table, id, qType, qDesc, idProduct, idCat, qRank, question,
         REPLACE(REPLACE(CAST(answer AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS answer, active, typeDesc
  FROM faq ORDER BY qType, idCat, idProduct, qRank;
ELSE
BEGIN
  PRINT 'MISSING TABLE: faq';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('faqs', 'tFaq', 'productFAQ')
     OR t.name LIKE '%faq%'
  ORDER BY t.name;
END
