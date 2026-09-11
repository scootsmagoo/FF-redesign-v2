-- 06a-productTypeAttrXref.sql
-- Which attributes apply to a product type.
-- Save the result grid as: productTypeAttrXref.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 06-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.productTypeAttrXref') IS NOT NULL
  SELECT 'productTypeAttrXref' AS _table, productTypeID, attributeID FROM productTypeAttrXref ORDER BY productTypeID, attributeID;
ELSE
BEGIN
  PRINT 'MISSING TABLE: productTypeAttrXref';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('productTypeAttributeXref', 'productTypeAttr_Xref')
     OR t.name LIKE '%productTypeA%'
  ORDER BY t.name;
END
