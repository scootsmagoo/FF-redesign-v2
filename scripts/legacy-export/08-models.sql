-- 08-models: appliance model -> product mapping (drives /models/{model} pages) and the fridge finder.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.tFridgeModelLookup') IS NOT NULL
  SELECT 'tFridgeModelLookup' AS _table,
    idModel, idProduct, Manufacturer, FridgeModelNumber, Category, excludeFromFeed, noindex, cpAddition
  FROM tFridgeModelLookup
  ORDER BY FridgeModelNumber, idProduct;
ELSE PRINT 'MISSING TABLE: tFridgeModelLookup';
GO

IF OBJECT_ID('dbo.refrigerator_finder') IS NOT NULL
  SELECT 'refrigerator_finder' AS _table,
    idBrand, idStyle, styleDesc, idLoc, locDesc, idRemove, removeDesc, altRemovalImg, idProduct, altprod1, altprod2, active
  FROM refrigerator_finder
  ORDER BY idBrand, idStyle, idLoc, idRemove;
ELSE PRINT 'MISSING TABLE: refrigerator_finder';
GO

IF OBJECT_ID('dbo.redirectHub') IS NOT NULL
  SELECT 'redirectHub_models' AS _table, keyword, idProduct, directPagename, typeID
  FROM redirectHub WHERE typeID = 2 ORDER BY keyword;
ELSE PRINT 'MISSING TABLE: redirectHub';
GO

