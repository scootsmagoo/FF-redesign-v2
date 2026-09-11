-- 11h-termsAndCond.sql
-- The Terms of Use / Privacy Policy / Shipping Policy / Returns Policy / Accessibility Statement HTML
-- (storeAdmin.termsAndCond, about 100k characters).
--
-- SSMS caps a single text value at 65,535 characters when writing results to a file (and Excel at
-- 32,767 per cell), so this returns the value in numbered 30,000-character parts, one row each.
--
--   SSMS: Query > Results To > Results to File, run, save as
--         scripts/legacy-export/termsAndCond.txt
--   then: pnpm --filter @ff/db exec tsx import/terms.ts   (stitches the parts back together)
-- Read-only.
SET NOCOUNT ON;

;WITH n(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM n WHERE n < 40)
SELECT n.n AS part,
       SUBSTRING(CAST(s.configValLong AS nvarchar(max)), (n.n - 1) * 30000 + 1, 30000) AS termsAndCond
FROM storeAdmin s
CROSS JOIN n
WHERE s.configVar = 'termsAndCond'
  AND (n.n - 1) * 30000 < LEN(CAST(s.configValLong AS nvarchar(max)))
ORDER BY n.n;
