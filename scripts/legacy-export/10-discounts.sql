-- 10-discounts: promo engine configuration. No customer data.
SET NOCOUNT ON;

SELECT 'DiscOrder' AS _table, d.*
FROM DiscOrder d
ORDER BY d.idDiscOrder;

SELECT 'DiscProd' AS _table, idDiscProd, idProduct, discAmt, discPerc, discFromQty, discToQty, source
FROM DiscProd ORDER BY idProduct, discFromQty;

-- single-use codes: export only active ones, they are numerous
SELECT 'tDiscCode' AS _table, discCode, discTag, discStatus FROM tDiscCode WHERE discStatus = 'A';
SELECT 'tReorderCode' AS _table, discCode, discStatus FROM tReorderCode WHERE discStatus = 'A';

SELECT 'deal' AS _table, iddeal, dealdiscription, startprice, endprice, units FROM deal;
SELECT 'custom_sales_code' AS _table, salesId, name, salesCode, active FROM custom_sales_code;

SELECT 'affiliateRecords' AS _table, idAff, affName, affPagename, CAST(affContent AS nvarchar(max)) AS affContent, affImage, affDiscount, active
FROM affiliateRecords ORDER BY idAff;
SELECT 'affiliateProducts' AS _table, idAff, itemID, recordType FROM affiliateProducts ORDER BY idAff;
