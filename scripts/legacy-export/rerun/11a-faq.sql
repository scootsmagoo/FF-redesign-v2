-- 11a-faq.sql
-- Site, product and category FAQs (answers flattened to one line).
-- Save the result grid as: faq.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.faq') IS NOT NULL
  SELECT 'faq' AS _table, id, qType, qDesc, idProduct, idCat, qRank, question,
         REPLACE(REPLACE(CAST(answer AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS answer, active, typeDesc
  FROM filtersfast.faq ORDER BY qType, idCat, idProduct, qRank;
ELSE IF OBJECT_ID('dbo.faq') IS NOT NULL
  SELECT 'faq' AS _table, id, qType, qDesc, idProduct, idCat, qRank, question,
         REPLACE(REPLACE(CAST(answer AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS answer, active, typeDesc
  FROM dbo.faq ORDER BY qType, idCat, idProduct, qRank;
ELSE
BEGIN
  PRINT 'MISSING TABLE: faq';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%faq%' ORDER BY s.name, t.name;
END
