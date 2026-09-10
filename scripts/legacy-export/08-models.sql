-- 08-models: appliance model -> product mapping (drives /models/{model} pages) and the fridge finder.
SET NOCOUNT ON;

SELECT 'tFridgeModelLookup' AS _table,
  idModel, idProduct, Manufacturer, FridgeModelNumber, Category, excludeFromFeed, noindex, cpAddition
FROM tFridgeModelLookup
ORDER BY FridgeModelNumber, idProduct;

SELECT 'refrigerator_finder' AS _table,
  idBrand, idStyle, styleDesc, idLoc, locDesc, idRemove, removeDesc, altRemovalImg, idProduct, altprod1, altprod2, active
FROM refrigerator_finder
ORDER BY idBrand, idStyle, idLoc, idRemove;

SELECT 'redirectHub_models' AS _table, keyword, idProduct, directPagename, typeID
FROM redirectHub WHERE typeID = 2 ORDER BY keyword;
