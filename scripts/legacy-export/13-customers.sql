-- 13-customers: PERSONAL DATA. Transfer privately. Excludes anything card-related.
-- The password column is the legacy hash (SHA-256 hex for converted accounts, RC4-hex for older
-- ones; secConvDt is set when converted). v2 verifies the legacy hash once at first login, then
-- re-hashes with a modern KDF and clears it.
SET NOCOUNT ON;

SELECT 'customer' AS _table,
  idCust, status, dateCreated, email, password, secConvDt,
  name, lastName, customerCompany, phone,
  address, city, zip, locState, locState2, locCountry, addressclassification,
  shippingName, shippingLastName, shippingPhone, shippingAddress, shippingCity, shippingZip,
  shippingLocState, shippingLocState2, shippingLocCountry,
  remindin, newsletter, futureMail, futureSMS, taxExempt, taxExemptExpiration,
  affiliate, commPerc, guestAccount, isMilitary, isEmployee, changePwdOnLogin
FROM customer
WHERE status = 'A'
ORDER BY idCust;

-- saved appliance models
SELECT 'customer_models' AS _table, idCust, idModel, dateAdded FROM customer_models ORDER BY idCust;

-- reorder reminders
SELECT 'product_order_reminders' AS _table, idCust, idProduct, idOption, idOrder, remindIn, remindActive
FROM product_order_reminders WHERE remindActive = 1 ORDER BY idCust;
