-- 04-options: the variant/option matrix. Six result sets; sqlcmd writes them sequentially
-- into one file separated by a blank line, and the importer splits on the header rows.
SET NOCOUNT ON;

-- 4a option groups
SELECT 'optionsGroups' AS _table, idOptionGroup, optionGroupDesc, optionReq, optionType, sortOrder, sizingLink
FROM optionsGroups ORDER BY idOptionGroup;

-- 4b options
SELECT 'options' AS _table, idOption, optionDescrip, priceToAdd, weightToAdd, percToAdd, taxExempt, sortOrder
FROM options ORDER BY idOption;

-- 4c option <-> group
SELECT 'optionsXref' AS _table, idOptOptGroup, idOptionGroup, idOption
FROM optionsXref ORDER BY idOptionGroup, idOption;

-- 4d group <-> product
SELECT 'optionsGroupsXref' AS _table, idOptGrpProd, idProduct, idOptionGroup
FROM optionsGroupsXref ORDER BY idProduct, idOptionGroup;

-- 4e per-product option exclusions
SELECT 'OptionsProdEx' AS _table, idOptionsProdEx, idProduct, idOption
FROM OptionsProdEx ORDER BY idProduct, idOption;

-- 4f per-product option prices
SELECT 'OptionsPrices' AS _table, idProduct, idOption, optPrice, optListPrice, optCgs, optGoogleMinAutoDisc
FROM OptionsPrices ORDER BY idProduct, idOption;

-- 4g per-product option inventory
SELECT 'productOptionInventory' AS _table, idProduct, idOption, stock, Unavailable, Blocked, reasonCode, updateCPStock, dropShip, specialOrder
FROM productOptionInventory ORDER BY idProduct, idOption;

-- 4h option images
SELECT 'product_option_images' AS _table, idProduct, idOption, optionImageUrl
FROM product_option_images ORDER BY idProduct, idOption;
