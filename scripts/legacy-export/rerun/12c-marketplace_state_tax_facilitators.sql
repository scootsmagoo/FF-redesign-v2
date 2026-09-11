-- 12c-marketplace_state_tax_facilitators.sql
-- States where marketplaces collect tax. Not run yet.
-- Save the result grid as: marketplace_state_tax_facilitators.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.marketplace_state_tax_facilitators') IS NOT NULL
  SELECT 'marketplace_state_tax_facilitators' AS _table, * FROM filtersfast.marketplace_state_tax_facilitators;
ELSE IF OBJECT_ID('dbo.marketplace_state_tax_facilitators') IS NOT NULL
  SELECT 'marketplace_state_tax_facilitators' AS _table, * FROM dbo.marketplace_state_tax_facilitators;
ELSE
BEGIN
  PRINT 'MISSING TABLE: marketplace_state_tax_facilitators';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%marketplace%%' ORDER BY s.name, t.name;
END
