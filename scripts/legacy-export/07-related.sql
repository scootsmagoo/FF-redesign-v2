-- 07-related: cross-sell, compatible part cross-references, product groups.
SET NOCOUNT ON;

SELECT 'RelatedProductsXref' AS _table, idProduct, relatedIdProduct, sortOrder
FROM RelatedProductsXref ORDER BY idProduct, sortOrder;

SELECT 'productCompSkuList' AS _table, id, idProduct, skuBrand, skuValue
FROM productCompSkuList ORDER BY idProduct, id;

SELECT 'productGroups' AS _table, prodGroupP, prodGroupC
FROM productGroups ORDER BY prodGroupP, prodGroupC;

SELECT 'productManufacturers' AS _table, Manufacturer
FROM productManufacturers ORDER BY Manufacturer;

SELECT 'tsourceprice' AS _table, idproduct, idOption, source, price, adMedium, priceDate
FROM tsourceprice ORDER BY idproduct, idOption, source;
