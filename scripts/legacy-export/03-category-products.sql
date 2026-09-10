-- 03-category-products: category membership.
SET NOCOUNT ON;
SELECT idCatProd, idProduct, idCategory
FROM Categories_Products
ORDER BY idCategory, idProduct;
