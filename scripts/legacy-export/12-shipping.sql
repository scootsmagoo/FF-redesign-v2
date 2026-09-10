-- 12-shipping: shipping methods/rates, locations, holidays, currency.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.ShipMethod') IS NOT NULL
  SELECT 'ShipMethod' AS _table, idShipMethod, shipDesc, status FROM ShipMethod ORDER BY idShipMethod;
ELSE PRINT 'MISSING TABLE: ShipMethod';
GO

IF OBJECT_ID('dbo.shipRates') IS NOT NULL
  SELECT 'shipRates' AS _table, * FROM shipRates ORDER BY idShipMethod, locShipZone, unitsFrom;
ELSE PRINT 'MISSING TABLE: shipRates';
GO

IF OBJECT_ID('dbo.Locations') IS NOT NULL
  SELECT 'Locations' AS _table, idLocation, locName, locCountry, locState, locTax, locShipZone, locStatus FROM Locations ORDER BY locCountry, locState;
ELSE PRINT 'MISSING TABLE: Locations';
GO

IF OBJECT_ID('dbo.upsHolidays') IS NOT NULL
  SELECT 'upsHolidays' AS _table, holidayDate FROM upsHolidays ORDER BY holidayDate;
ELSE PRINT 'MISSING TABLE: upsHolidays';
GO

IF OBJECT_ID('dbo.currencyRates') IS NOT NULL
  SELECT 'currencyRates' AS _table, cName, cRate, cDate FROM currencyRates;
ELSE PRINT 'MISSING TABLE: currencyRates';
GO

IF OBJECT_ID('dbo.marketplace_state_tax_facilitators') IS NOT NULL
  SELECT 'marketplace_state_tax_facilitators' AS _table, * FROM marketplace_state_tax_facilitators;
ELSE PRINT 'MISSING TABLE: marketplace_state_tax_facilitators';
GO

