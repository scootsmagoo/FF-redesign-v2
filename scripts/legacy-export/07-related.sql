-- 07-related: cross-sell, compatible part cross-references, product groups.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.RelatedProductsXref') IS NOT NULL
  SELECT 'RelatedProductsXref' AS _table, idProduct, relatedIdProduct, sortOrder
  FROM RelatedProductsXref ORDER BY idProduct, sortOrder;
ELSE PRINT 'MISSING TABLE: RelatedProductsXref';
GO

IF OBJECT_ID('dbo.productCompSkuList') IS NOT NULL
  SELECT 'productCompSkuList' AS _table, id, idProduct, skuBrand, skuValue
  FROM productCompSkuList ORDER BY idProduct, id;
ELSE PRINT 'MISSING TABLE: productCompSkuList';
GO

IF OBJECT_ID('dbo.productGroups') IS NOT NULL
  SELECT 'productGroups' AS _table, prodGroupP, prodGroupC
  FROM productGroups ORDER BY prodGroupP, prodGroupC;
ELSE PRINT 'MISSING TABLE: productGroups';
GO

IF OBJECT_ID('dbo.productManufacturers') IS NOT NULL
  SELECT 'productManufacturers' AS _table, Manufacturer
  FROM productManufacturers ORDER BY Manufacturer;
ELSE PRINT 'MISSING TABLE: productManufacturers';
GO

IF OBJECT_ID('dbo.tsourceprice') IS NOT NULL
  SELECT 'tsourceprice' AS _table, idproduct, idOption, source, price, adMedium, priceDate
  FROM tsourceprice ORDER BY idproduct, idOption, source;
ELSE PRINT 'MISSING TABLE: tsourceprice';
GO

