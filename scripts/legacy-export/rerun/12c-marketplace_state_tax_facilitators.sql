-- 12c-marketplace_state_tax_facilitators.sql
-- States where marketplaces collect tax (all columns).
-- Save the result grid as: marketplace_state_tax_facilitators.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 12-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.marketplace_state_tax_facilitators') IS NOT NULL
  SELECT 'marketplace_state_tax_facilitators' AS _table, * FROM marketplace_state_tax_facilitators;
ELSE
BEGIN
  PRINT 'MISSING TABLE: marketplace_state_tax_facilitators';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('marketplaceStateTaxFacilitators', 'marketplace_facilitator_states')
     OR t.name LIKE '%marketplace%%'
  ORDER BY t.name;
END
