-- 04-options: the variant/option matrix. Six result sets; sqlcmd writes them sequentially
-- into one file separated by a blank line, and the importer splits on the header rows.
SET NOCOUNT ON;

-- 4a option groups
IF OBJECT_ID('dbo.optionsGroups') IS NOT NULL
  SELECT 'optionsGroups' AS _table, idOptionGroup, optionGroupDesc, optionReq, optionType, sortOrder, sizingLink
  FROM optionsGroups ORDER BY idOptionGroup;
ELSE PRINT 'MISSING TABLE: optionsGroups';
GO

-- 4b options
IF OBJECT_ID('dbo.options') IS NOT NULL
  SELECT 'options' AS _table, idOption, optionDescrip, priceToAdd, weightToAdd, percToAdd, taxExempt, sortOrder
  FROM options ORDER BY idOption;
ELSE PRINT 'MISSING TABLE: options';
GO

-- 4c option <-> group
IF OBJECT_ID('dbo.optionsXref') IS NOT NULL
  SELECT 'optionsXref' AS _table, idOptOptGroup, idOptionGroup, idOption
  FROM optionsXref ORDER BY idOptionGroup, idOption;
ELSE PRINT 'MISSING TABLE: optionsXref';
GO

-- 4d group <-> product
IF OBJECT_ID('dbo.optionsGroupsXref') IS NOT NULL
  SELECT 'optionsGroupsXref' AS _table, idOptGrpProd, idProduct, idOptionGroup
  FROM optionsGroupsXref ORDER BY idProduct, idOptionGroup;
ELSE PRINT 'MISSING TABLE: optionsGroupsXref';
GO

-- 4e per-product option exclusions
IF OBJECT_ID('dbo.OptionsProdEx') IS NOT NULL
  SELECT 'OptionsProdEx' AS _table, idOptionsProdEx, idProduct, idOption
  FROM OptionsProdEx ORDER BY idProduct, idOption;
ELSE PRINT 'MISSING TABLE: OptionsProdEx';
GO

-- 4f per-product option prices
IF OBJECT_ID('dbo.OptionsPrices') IS NOT NULL
  SELECT 'OptionsPrices' AS _table, idProduct, idOption, optPrice, optListPrice, optCgs, optGoogleMinAutoDisc
  FROM OptionsPrices ORDER BY idProduct, idOption;
ELSE PRINT 'MISSING TABLE: OptionsPrices';
GO

-- 4g per-product option inventory
IF OBJECT_ID('dbo.productOptionInventory') IS NOT NULL
  SELECT 'productOptionInventory' AS _table, idProduct, idOption, stock, Unavailable, Blocked, reasonCode, updateCPStock, dropShip, specialOrder
  FROM productOptionInventory ORDER BY idProduct, idOption;
ELSE PRINT 'MISSING TABLE: productOptionInventory';
GO

-- 4h option images
IF OBJECT_ID('dbo.product_option_images') IS NOT NULL
  SELECT 'product_option_images' AS _table, idProduct, idOption, optionImageUrl
  FROM product_option_images ORDER BY idProduct, idOption;
ELSE PRINT 'MISSING TABLE: product_option_images';
GO

