-- 15-wallet: OPTIONAL, PERSONAL DATA. Saved payment method references.
-- `token` is the gateway (CyberSource) token, RC4-obfuscated in the legacy app; it is only useful
-- if v2 keeps the same CyberSource merchant account. No card numbers are stored here.
-- Skip this file entirely if we are not migrating saved cards.
SET NOCOUNT ON;
SELECT 'wallet' AS _table, idWallet, idCust, token, last4, expMo, expYr, [type], nickname, isEnabled, isValid, isDefault, autoToken, dtCreated
FROM wallet
WHERE isEnabled = 1 AND isValid = 1
ORDER BY idCust, idWallet;
