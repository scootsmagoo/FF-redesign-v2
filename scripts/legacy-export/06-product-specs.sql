-- 06-product-specs: the wide specifications row per product, plus the typed attribute system.
SET NOCOUNT ON;

SELECT 'productSpecs' AS _table, s.*
FROM productSpecs s
ORDER BY s.idProduct;

SELECT 'productTypes' AS _table, productTypeID, typeName FROM productTypes ORDER BY productTypeID;
SELECT 'productTypeXref' AS _table, idProduct, typeID FROM productTypeXref ORDER BY idProduct;
SELECT 'productTypeAttribute' AS _table, attributeID, attributeName, valueSuffix FROM productTypeAttribute ORDER BY attributeID;
SELECT 'productTypeAttrXref' AS _table, productTypeID, attributeID FROM productTypeAttrXref ORDER BY productTypeID, attributeID;
SELECT 'productTypeAttributeValue' AS _table, attributeID, idProduct, attributeValue FROM productTypeAttributeValue ORDER BY idProduct, attributeID;

SELECT 'prod_dim_codes' AS _table, * FROM prod_dim_codes;
SELECT 'prod_dim_values' AS _table, * FROM prod_dim_values;
SELECT 'productDimensions' AS _table, idProduct, idVal FROM productDimensions ORDER BY idProduct;

SELECT 'tUnitName' AS _table, idUnit, idProduct, unitName, uActive FROM tUnitName ORDER BY idProduct;
SELECT 'sale_restrictions' AS _table, idProduct, blockedCountry, blockedState FROM sale_restrictions ORDER BY idProduct;
