-- 11h-termsAndCond.sql
-- The Terms of Use / Privacy Policy / Shipping Policy / Returns Policy / Accessibility Statement HTML.
-- The first export truncated this value at 32,767 characters (Excel's cell limit), cutting off every
-- policy after the Terms of Use. Export it as TEXT, not into a workbook:
--   SSMS: Query > Results To > Results to File (or right-click the cell > Save Results As),
--   then save as  scripts/legacy-export/termsAndCond.txt  (UTF-8). It is a single HTML string.
-- Read-only.
SET NOCOUNT ON;

SELECT CAST(configValLong AS nvarchar(max)) AS termsAndCond
FROM storeAdmin
WHERE configVar = 'termsAndCond';
