-- 05-product-images: gallery rows (may include YouTube URLs and PDF links).
SET NOCOUNT ON;
SELECT idProduct, imageUrl, imgSortOrder
FROM product_images
ORDER BY idProduct, imgSortOrder;
