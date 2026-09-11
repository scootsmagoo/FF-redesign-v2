-- 06b-productTypeAttributeValue.sql
-- Attribute values per product (spec sheet data).
-- Save the result grid as: productTypeAttributeValue.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 06-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.productTypeAttributeValue') IS NOT NULL
  SELECT 'productTypeAttributeValue' AS _table, attributeID, idProduct, attributeValue FROM productTypeAttributeValue ORDER BY idProduct, attributeID;
ELSE
BEGIN
  PRINT 'MISSING TABLE: productTypeAttributeValue';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('productTypeAttributeValues', 'productAttributeValue')
     OR t.name LIKE '%productTypeA%'
  ORDER BY t.name;
END
