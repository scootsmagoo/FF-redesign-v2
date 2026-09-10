-- 12-shipping: shipping methods/rates, locations, holidays, currency.
SET NOCOUNT ON;

SELECT 'ShipMethod' AS _table, idShipMethod, shipDesc, status FROM ShipMethod ORDER BY idShipMethod;
SELECT 'shipRates' AS _table, * FROM shipRates ORDER BY idShipMethod, locShipZone, unitsFrom;
SELECT 'Locations' AS _table, idLocation, locName, locCountry, locState, locTax, locShipZone, locStatus FROM Locations ORDER BY locCountry, locState;
SELECT 'upsHolidays' AS _table, holidayDate FROM upsHolidays ORDER BY holidayDate;
SELECT 'currencyRates' AS _table, cName, cRate, cDate FROM currencyRates;
SELECT 'marketplace_state_tax_facilitators' AS _table, * FROM marketplace_state_tax_facilitators;
