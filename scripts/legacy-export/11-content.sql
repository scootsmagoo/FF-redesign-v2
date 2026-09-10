-- 11-content: FAQs, support articles, legacy reviews, redirects, store config.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.faq') IS NOT NULL
  SELECT 'faq' AS _table, id, qType, qDesc, idProduct, idCat, qRank, question, REPLACE(REPLACE(CAST(answer AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS answer, active, typeDesc
  FROM faq ORDER BY qType, idCat, idProduct, qRank;
ELSE PRINT 'MISSING TABLE: faq';
GO

IF OBJECT_ID('dbo.support_categories') IS NOT NULL
  SELECT 'support_categories' AS _table, idCategory, categoryName, categoryImage, categoryURL, categorySortOrder, categoryActive, categoryVisible, categoryBot
  FROM support_categories ORDER BY categorySortOrder;
ELSE PRINT 'MISSING TABLE: support_categories';
GO

IF OBJECT_ID('dbo.support_articles') IS NOT NULL
  SELECT 'support_articles' AS _table, idArticle, articleURL, articleTitle, REPLACE(REPLACE(CAST(articleContent AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS articleContent, articleKeywords
  FROM support_articles ORDER BY idArticle;
ELSE PRINT 'MISSING TABLE: support_articles';
GO

IF OBJECT_ID('dbo.support_categories_articles') IS NOT NULL
  SELECT 'support_categories_articles' AS _table, idEntry, idCategory, idArticle, sortOrder FROM support_categories_articles ORDER BY idCategory, sortOrder;
ELSE PRINT 'MISSING TABLE: support_categories_articles';
GO

IF OBJECT_ID('dbo.support_faqs') IS NOT NULL
  SELECT 'support_faqs' AS _table, idFAQ, idArticle, OrderSort FROM support_faqs ORDER BY OrderSort;
ELSE PRINT 'MISSING TABLE: support_faqs';
GO

-- legacy on-site reviews (Trustpilot is the live source; these are older)
IF OBJECT_ID('dbo.reviews') IS NOT NULL
  SELECT 'reviews' AS _table, idReview, idProduct, revDate, revStatus, revRating, revName, revLocation, revSubj, REPLACE(REPLACE(CAST(revDetail AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS revDetail
  FROM reviews WHERE revStatus = 'A' ORDER BY idProduct, revDate;
ELSE PRINT 'MISSING TABLE: reviews';
GO

IF OBJECT_ID('dbo.prodRedirect') IS NOT NULL
  SELECT 'prodRedirect' AS _table, id, oldPagename, newPagename, rStatus FROM prodRedirect ORDER BY id;
ELSE PRINT 'MISSING TABLE: prodRedirect';
GO

IF OBJECT_ID('dbo.catRedirect') IS NOT NULL
  SELECT 'catRedirect' AS _table, oldPagename, newPagename, rStatus FROM catRedirect;
ELSE PRINT 'MISSING TABLE: catRedirect';
GO

IF OBJECT_ID('dbo.redirectHub') IS NOT NULL
  SELECT 'redirectHub' AS _table, keyword, idProduct, directPagename, typeID FROM redirectHub ORDER BY typeID, keyword;
ELSE PRINT 'MISSING TABLE: redirectHub';
GO

-- store configuration blob (83 values joined by *|*) plus simple flags. Contains a few legacy
-- payment-gateway credentials in positions 24/41/63/72/73; the importer discards those.
IF OBJECT_ID('dbo.storeAdmin') IS NOT NULL
  SELECT 'storeAdmin' AS _table, configVar, configVal, REPLACE(REPLACE(CAST(configValLong AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS configValLong, adminType FROM storeAdmin;
ELSE PRINT 'MISSING TABLE: storeAdmin';
GO

IF OBJECT_ID('dbo.mods') IS NOT NULL
  SELECT 'mods' AS _table, * FROM mods;
ELSE PRINT 'MISSING TABLE: mods';
GO

