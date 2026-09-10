-- 10-discounts: promo engine configuration. No customer data.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.DiscOrder') IS NOT NULL
  SELECT 'DiscOrder' AS _table, d.idDiscOrder, d.discCode, d.discTag, d.discPerc, d.discAmt, d.discFromAmt, d.discToAmt, d.discStatus, d.discOnceOnly, d.discValidFrom, d.discValidTo, d.discFreeShipping, d.discThresh, d.discThreshFlag, d.displayPerc, d.discMatchValue, d.discMultiByQty, d.discTitle, d.promoItemFlag, d.promoItemDisc, d.giftWithPurchaseFlag, d.giftWithPurchaseGroup, d.bogoFlag, d.tieredSaleFlag, d.tieredThresh1, d.tieredThresh2, d.tieredThresh3, d.tieredThresh4, d.tieredDiscAmt1, d.tieredDiscAmt2, d.tieredDiscAmt3, d.tieredDiscAmt4, d.requirePresenceType, d.requirePresenceID, d.autoAddWithPresenceId, d.exclusiveDiscount, d.isCompoundable, d.addOnDiscounts, d.hideFreeShipBanner, d.allowOnForms, d.redirectPagename, d.discLandingPage, d.discImageLoc, d.discSplashImage, d.discUseCustomContent, REPLACE(REPLACE(CAST(d.discContent AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS discContent, REPLACE(REPLACE(CAST(d.discProductText AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS discProductText
  FROM DiscOrder d
  ORDER BY d.idDiscOrder;
ELSE PRINT 'MISSING TABLE: DiscOrder';
GO

IF OBJECT_ID('dbo.DiscProd') IS NOT NULL
  SELECT 'DiscProd' AS _table, idDiscProd, idProduct, discAmt, discPerc, discFromQty, discToQty, source
  FROM DiscProd ORDER BY idProduct, discFromQty;
ELSE PRINT 'MISSING TABLE: DiscProd';
GO

-- single-use codes: export only active ones, they are numerous
IF OBJECT_ID('dbo.tDiscCode') IS NOT NULL
  SELECT 'tDiscCode' AS _table, discCode, discTag, discStatus FROM tDiscCode WHERE discStatus = 'A';
ELSE PRINT 'MISSING TABLE: tDiscCode';
GO

IF OBJECT_ID('dbo.tReorderCode') IS NOT NULL
  SELECT 'tReorderCode' AS _table, discCode, discStatus FROM tReorderCode WHERE discStatus = 'A';
ELSE PRINT 'MISSING TABLE: tReorderCode';
GO

IF OBJECT_ID('dbo.deal') IS NOT NULL
  SELECT 'deal' AS _table, iddeal, dealdiscription, startprice, endprice, units FROM deal;
ELSE PRINT 'MISSING TABLE: deal';
GO

IF OBJECT_ID('dbo.custom_sales_code') IS NOT NULL
  SELECT 'custom_sales_code' AS _table, salesId, name, salesCode, active FROM custom_sales_code;
ELSE PRINT 'MISSING TABLE: custom_sales_code';
GO

IF OBJECT_ID('dbo.affiliateRecords') IS NOT NULL
  SELECT 'affiliateRecords' AS _table, idAff, affName, affPagename, CAST(affContent AS nvarchar(max)) AS affContent, affImage, affDiscount, active
  FROM affiliateRecords ORDER BY idAff;
ELSE PRINT 'MISSING TABLE: affiliateRecords';
GO

IF OBJECT_ID('dbo.affiliateProducts') IS NOT NULL
  SELECT 'affiliateProducts' AS _table, idAff, itemID, recordType FROM affiliateProducts ORDER BY idAff;
ELSE PRINT 'MISSING TABLE: affiliateProducts';
GO

