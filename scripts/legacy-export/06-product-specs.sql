-- 06-product-specs: the wide specifications row per product, plus the typed attribute system.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.productSpecs') IS NOT NULL
  SELECT 'productSpecs' AS _table, s.*
  FROM productSpecs s
  ORDER BY s.idProduct;
ELSE PRINT 'MISSING TABLE: productSpecs';
GO

IF OBJECT_ID('dbo.productTypes') IS NOT NULL
  SELECT 'productTypes' AS _table, productTypeID, typeName FROM productTypes ORDER BY productTypeID;
ELSE PRINT 'MISSING TABLE: productTypes';
GO

IF OBJECT_ID('dbo.productTypeXref') IS NOT NULL
  SELECT 'productTypeXref' AS _table, idProduct, typeID FROM productTypeXref ORDER BY idProduct;
ELSE PRINT 'MISSING TABLE: productTypeXref';
GO

IF OBJECT_ID('dbo.productTypeAttribute') IS NOT NULL
  SELECT 'productTypeAttribute' AS _table, attributeID, attributeName, valueSuffix FROM productTypeAttribute ORDER BY attributeID;
ELSE PRINT 'MISSING TABLE: productTypeAttribute';
GO

IF OBJECT_ID('dbo.productTypeAttrXref') IS NOT NULL
  SELECT 'productTypeAttrXref' AS _table, productTypeID, attributeID FROM productTypeAttrXref ORDER BY productTypeID, attributeID;
ELSE PRINT 'MISSING TABLE: productTypeAttrXref';
GO

IF OBJECT_ID('dbo.productTypeAttributeValue') IS NOT NULL
  SELECT 'productTypeAttributeValue' AS _table, attributeID, idProduct, attributeValue FROM productTypeAttributeValue ORDER BY idProduct, attributeID;
ELSE PRINT 'MISSING TABLE: productTypeAttributeValue';
GO

IF OBJECT_ID('dbo.prod_dim_codes') IS NOT NULL
  SELECT 'prod_dim_codes' AS _table, * FROM prod_dim_codes;
ELSE PRINT 'MISSING TABLE: prod_dim_codes';
GO

IF OBJECT_ID('dbo.prod_dim_values') IS NOT NULL
  SELECT 'prod_dim_values' AS _table, * FROM prod_dim_values;
ELSE PRINT 'MISSING TABLE: prod_dim_values';
GO

IF OBJECT_ID('dbo.productDimensions') IS NOT NULL
  SELECT 'productDimensions' AS _table, idProduct, idVal FROM productDimensions ORDER BY idProduct;
ELSE PRINT 'MISSING TABLE: productDimensions';
GO

IF OBJECT_ID('dbo.tUnitName') IS NOT NULL
  SELECT 'tUnitName' AS _table, idUnit, idProduct, unitName, uActive FROM tUnitName ORDER BY idProduct;
ELSE PRINT 'MISSING TABLE: tUnitName';
GO

IF OBJECT_ID('dbo.sale_restrictions') IS NOT NULL
  SELECT 'sale_restrictions' AS _table, idProduct, blockedCountry, blockedState FROM sale_restrictions ORDER BY idProduct;
ELSE PRINT 'MISSING TABLE: sale_restrictions';
GO

