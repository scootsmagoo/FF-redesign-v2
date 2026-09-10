-- 02-categories: full category tree with content and flags.
SET NOCOUNT ON;
SELECT
  c.idCategory,
  c.idParentCategory,
  c.categoryDesc,
  c.categoryH1,
  REPLACE(REPLACE(CAST(c.categoryHTML AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS categoryHTML,
  REPLACE(REPLACE(CAST(c.categoryHTMLLong AS nvarchar(max)), CHAR(13), ' '), CHAR(10), ' ') AS categoryHTMLLong,
  c.categoryFeatured,
  c.sortOrder,
  c.metatitle,
  c.metadesc,
  c.metacat,
  c.categoryGraphic,
  c.categoryImage,
  c.categoryContentLocation,
  c.pagname,
  c.categoryType,
  c.hideFromListings,
  c.compareActive,
  l.imageUrl AS categoryLogo
FROM categories c
LEFT JOIN tCategoryLogo l ON l.idCat = c.idCategory
ORDER BY c.idParentCategory, c.sortOrder, c.idCategory;
