-- 09-finders: water/humidifier finders, stock air-filter sizes, actual sizes, custom-size cross refs.
SET NOCOUNT ON;

SELECT 'tWaterFilterType' AS _table, idType, typeDesc, typeImg, active FROM tWaterFilterType ORDER BY idType;
SELECT 'tWaterFilterSize' AS _table, idType, [length], width, sizeImg FROM tWaterFilterSize ORDER BY idType;
SELECT 'tWaterFilterFinder' AS _table, idCat, idType, len, wid, micron, idProduct, active FROM tWaterFilterFinder ORDER BY idCat, idType;
SELECT 'tHumidifierFinder' AS _table, idCat, len, wid, thick, idProduct FROM tHumidifierFinder ORDER BY idCat;

SELECT 'search_products' AS _table, filterId, idProduct, idOption, size, depth, [type], brand, sizeActive, [row], [column]
FROM search_products ORDER BY size, depth, [type];

SELECT 'actualSizes' AS _table, idProduct, nomSize, actSize, sActive FROM actualSizes ORDER BY idProduct;
SELECT 'custom_size_xref' AS _table, option_sku, actual FROM custom_size_xref ORDER BY option_sku;
SELECT 'custom_std_productID' AS _table, product_id, custom_id, [type], depth FROM custom_std_productID ORDER BY product_id;
