-- 12a-upsHolidays.sql
-- Carrier holidays used for delivery estimates.
-- Save the result grid as: upsHolidays.csv  (or .txt tab-delimited, UTF-8) in packages/db/import/legacy/
-- Same columns as 12-*.sql in the main pack. Read-only.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.upsHolidays') IS NOT NULL
  SELECT 'upsHolidays' AS _table, holidayDate FROM upsHolidays ORDER BY holidayDate;
ELSE
BEGIN
  PRINT 'MISSING TABLE: upsHolidays';
  -- If the table lives under another name, this lists candidates; tell Claude the right one.
  SELECT 'candidates' AS _table, s.name AS [schema], t.name AS [table]
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name IN ('ups_holidays', 'holidays', 'shipHolidays')
     OR t.name LIKE '%upsHolidays%'
  ORDER BY t.name;
END
