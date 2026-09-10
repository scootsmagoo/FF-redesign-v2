-- 11-content: FAQs, support articles, legacy reviews, redirects, store config.
SET NOCOUNT ON;

SELECT 'faq' AS _table, id, qType, qDesc, idProduct, idCat, qRank, question, CAST(answer AS nvarchar(max)) AS answer, active, typeDesc
FROM faq ORDER BY qType, idCat, idProduct, qRank;

SELECT 'support_categories' AS _table, idCategory, categoryName, categoryImage, categoryURL, categorySortOrder, categoryActive, categoryVisible, categoryBot
FROM support_categories ORDER BY categorySortOrder;
SELECT 'support_articles' AS _table, idArticle, articleURL, articleTitle, CAST(articleContent AS nvarchar(max)) AS articleContent, articleKeywords
FROM support_articles ORDER BY idArticle;
SELECT 'support_categories_articles' AS _table, idEntry, idCategory, idArticle, sortOrder FROM support_categories_articles ORDER BY idCategory, sortOrder;
SELECT 'support_faqs' AS _table, idFAQ, idArticle, OrderSort FROM support_faqs ORDER BY OrderSort;

-- legacy on-site reviews (Trustpilot is the live source; these are older)
SELECT 'reviews' AS _table, idReview, idProduct, revDate, revStatus, revRating, revName, revLocation, revSubj, CAST(revDetail AS nvarchar(max)) AS revDetail
FROM reviews WHERE revStatus = 'A' ORDER BY idProduct, revDate;

SELECT 'prodRedirect' AS _table, id, oldPagename, newPagename, rStatus FROM prodRedirect ORDER BY id;
SELECT 'catRedirect' AS _table, oldPagename, newPagename, rStatus FROM catRedirect;
SELECT 'redirectHub' AS _table, keyword, idProduct, directPagename, typeID FROM redirectHub ORDER BY typeID, keyword;

-- store configuration blob (83 values joined by *|*) plus simple flags. Contains a few legacy
-- payment-gateway credentials in positions 24/41/63/72/73; the importer discards those.
SELECT 'storeAdmin' AS _table, configVar, configVal, CAST(configValLong AS nvarchar(max)) AS configValLong, adminType FROM storeAdmin;
SELECT 'mods' AS _table, * FROM mods;
