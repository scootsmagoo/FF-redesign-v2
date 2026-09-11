-- 12a-upsHolidays.sql
-- Carrier holidays used for delivery estimates.
-- Save the result grid as: upsHolidays.csv (or tab-delimited .txt, UTF-8) in packages/db/import/legacy/
-- The table is in the filtersfast schema (the first re-run looked in dbo and found it here). Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('filtersfast.upsHolidays') IS NOT NULL
  SELECT 'upsHolidays' AS _table, holidayDate FROM filtersfast.upsHolidays ORDER BY holidayDate;
ELSE IF OBJECT_ID('dbo.upsHolidays') IS NOT NULL
  SELECT 'upsHolidays' AS _table, holidayDate FROM dbo.upsHolidays ORDER BY holidayDate;
ELSE
BEGIN
  PRINT 'MISSING TABLE: upsHolidays';
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name LIKE '%upsHolidays%' ORDER BY s.name, t.name;
END
