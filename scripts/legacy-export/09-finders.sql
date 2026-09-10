-- 09-finders: water/humidifier finders, stock air-filter sizes, actual sizes, custom-size cross refs.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.tWaterFilterType') IS NOT NULL
  SELECT 'tWaterFilterType' AS _table, idType, typeDesc, typeImg, active FROM tWaterFilterType ORDER BY idType;
ELSE PRINT 'MISSING TABLE: tWaterFilterType';
GO

IF OBJECT_ID('dbo.tWaterFilterSize') IS NOT NULL
  SELECT 'tWaterFilterSize' AS _table, idType, [length], width, sizeImg FROM tWaterFilterSize ORDER BY idType;
ELSE PRINT 'MISSING TABLE: tWaterFilterSize';
GO

IF OBJECT_ID('dbo.tWaterFilterFinder') IS NOT NULL
  SELECT 'tWaterFilterFinder' AS _table, idCat, idType, len, wid, micron, idProduct, active FROM tWaterFilterFinder ORDER BY idCat, idType;
ELSE PRINT 'MISSING TABLE: tWaterFilterFinder';
GO

IF OBJECT_ID('dbo.tHumidifierFinder') IS NOT NULL
  SELECT 'tHumidifierFinder' AS _table, idCat, len, wid, thick, idProduct FROM tHumidifierFinder ORDER BY idCat;
ELSE PRINT 'MISSING TABLE: tHumidifierFinder';
GO

IF OBJECT_ID('dbo.search_products') IS NOT NULL
  SELECT 'search_products' AS _table, filterId, idProduct, idOption, size, depth, [type], brand, sizeActive, [row], [column]
  FROM search_products ORDER BY size, depth, [type];
ELSE PRINT 'MISSING TABLE: search_products';
GO

IF OBJECT_ID('dbo.actualSizes') IS NOT NULL
  SELECT 'actualSizes' AS _table, idProduct, nomSize, actSize, sActive FROM actualSizes ORDER BY idProduct;
ELSE PRINT 'MISSING TABLE: actualSizes';
GO

IF OBJECT_ID('dbo.custom_size_xref') IS NOT NULL
  SELECT 'custom_size_xref' AS _table, option_sku, actual FROM custom_size_xref ORDER BY option_sku;
ELSE PRINT 'MISSING TABLE: custom_size_xref';
GO

IF OBJECT_ID('dbo.custom_std_productID') IS NOT NULL
  SELECT 'custom_std_productID' AS _table, product_id, custom_id, [type], depth FROM custom_std_productID ORDER BY product_id;
ELSE PRINT 'MISSING TABLE: custom_std_productID';
GO

