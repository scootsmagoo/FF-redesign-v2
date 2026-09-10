-- 02-categories: full category tree with content and flags.
SET NOCOUNT ON;
SELECT
  c.idCategory,
  c.idParentCategory,
  c.categoryDesc,
  c.categoryH1,
  c.categoryHTML,
  CAST(c.categoryHTMLLong AS nvarchar(max)) AS categoryHTMLLong,
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
