-- 14-orders: PERSONAL DATA. Order history for the account area (default: last 3 years of
-- completed orders). Card columns are deliberately excluded. Adjust DATEADD(year, -3, GETDATE()) as needed.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.cartHead') IS NOT NULL
  SELECT 'cartHead' AS _table,
    h.idOrder, h.idCust, h.randomKey, h.orderDate, h.paidDate, h.DateCancelled, h.ReasonCancelled, h.orderStatus,
    h.subTotal, h.taxTotal, h.shipmentTotal, h.Total, h.taxRate, h.handlingFeeTotal, h.InsuranceTotal, h.donationAmount, h.adjustAmount,
    h.discCode, h.discPerc, h.discTotal, h.promoDiscCode, h.promoDiscAmt, h.ogAutoship, h.ogAutoshipAmt,
    h.shipmentMethod, h.Tracking,
    h.name, h.lastName, h.customerCompany, h.phone, h.email,
    h.address, h.city, h.locState, h.locCountry, h.zip,
    h.shippingName, h.shippingLastName, h.shippingPhone, h.shippingAddress, h.shippingCity, h.shippingLocState, h.shippingLocCountry, h.shippingZip,
    h.paymentType, h.cardType,
    h.referralSource, h.utmCampaign, h.idAffiliate, h.salesPersonCode,
    h.reorderFlag, h.mobileOrder, h.guestCheckout, h.intCurrency, h.intCheckout, h.thirdpartyordernumber
  FROM cartHead h
  WHERE h.orderStatus IN ('1','2','7','9') AND h.orderDate >= DATEADD(year, -3, GETDATE())
  ORDER BY h.idOrder;
ELSE PRINT 'MISSING TABLE: cartHead';
GO

IF OBJECT_ID('dbo.cartRows') IS NOT NULL
  SELECT 'cartRows' AS _table,
    r.idCartRow, r.idOrder, r.idProduct, r.sku, r.customSKU, r.quantity, r.unitPrice, r.unitWeight, r.description,
    r.idDiscProd, r.discAmt, r.autoshipDiscAmt, r.free, r.custom, r.giftParentID, r.autoshipFlag, r.subFreq, r.subDisc
  FROM cartRows r
  JOIN cartHead h ON h.idOrder = r.idOrder
  WHERE h.orderStatus IN ('1','2','7','9') AND h.orderDate >= DATEADD(year, -3, GETDATE())
  ORDER BY r.idOrder, r.idCartRow;
ELSE PRINT 'MISSING TABLE: cartRows';
GO

IF OBJECT_ID('dbo.cartRowsOptions') IS NOT NULL
  SELECT 'cartRowsOptions' AS _table, o.idOrder, o.idCartRow, o.idOption, o.optionPrice, o.optionDescrip
  FROM cartRowsOptions o
  JOIN cartHead h ON h.idOrder = o.idOrder
  WHERE h.orderStatus IN ('1','2','7','9') AND h.orderDate >= DATEADD(year, -3, GETDATE())
  ORDER BY o.idOrder, o.idCartRow;
ELSE PRINT 'MISSING TABLE: cartRowsOptions';
GO

IF OBJECT_ID('dbo.tShipHistory') IS NOT NULL
  SELECT 'tShipHistory' AS _table, s.idorder, s.track, s.ServiceType, s.ShipDate
  FROM tShipHistory s
  JOIN cartHead h ON h.idOrder = s.idorder
  WHERE h.orderDate >= DATEADD(year, -3, GETDATE())
  ORDER BY s.idorder;
ELSE PRINT 'MISSING TABLE: tShipHistory';
GO

IF OBJECT_ID('dbo.returnHeader') IS NOT NULL
  SELECT 'returnHeader' AS _table, idReturn, idOrder, idCust, returnDate, returnStatus, retTotalAmt, returnComment
  FROM returnHeader WHERE returnDate >= DATEADD(year, -3, GETDATE()) ORDER BY idReturn;
ELSE PRINT 'MISSING TABLE: returnHeader';
GO

IF OBJECT_ID('dbo.returnRows') IS NOT NULL
  SELECT 'returnRows' AS _table, rr.idOrder, rr.idReturn, rr.idProduct, rr.idOption, rr.quantity, rr.returnReason, rr.unitPrice, rr.refundOnly
  FROM returnRows rr JOIN returnHeader rh ON rh.idReturn = rr.idReturn WHERE rh.returnDate >= DATEADD(year, -3, GETDATE()) ORDER BY rr.idReturn;
ELSE PRINT 'MISSING TABLE: returnRows';
GO

