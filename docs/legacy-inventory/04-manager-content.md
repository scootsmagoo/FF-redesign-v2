# Legacy Manager inventory — content / CMS pages

Survey of `FiltersFast/Manager` (CandyPress Gold 2.4, classic ASP), September 11, 2026. Spec for the
v2 `/manager` parity build. Companion files: `04-manager-products.md`, `04-manager-orders.md`,
`04-manager-admin.md`.

## Global conventions (apply to every page)

**Include chain:** `../_INCconfig_.asp` → `_INCsecurity_.asp` → `_INCappDBConn_.asp` → `_INCappFunctions_.asp` → `_INCadmins.asp` → `_INCheader_.asp` … `_INCfooter_.asp`.

**Two-layer auth:**
1. `_INCsecurity_.asp` — client IP (`HTTP_X_FORWARDED_FOR` else `REMOTE_ADDR`) must pass `internalIPCheck()`, else `session.abandon` + **403**. Then session `<storeID>adminLoggedOn` must be `0` or `1`, else redirect `logon.asp?returnUrl=`.
2. `_INCadmins.asp` → `GetAccessLevel(permissionName)` reads the session string `Name:Level|Name:Level|…` built at logon from `cp_admins ⋈ cp_admin_permissions ⋈ cp_permissions ⋈ cp_roles ⋈ custom_sales_code`. Levels: `-1` none, `0` view, `1` full control, `2` restrictive. List pages accept 0; exec pages demand 1.

**Nav:** sidebar grouped Site Administration / Order Management / Customer Management / Product Management / Marketing Management; each link gated by `GetAccessLevel(...) > -1` (some `= 1`).

**Editors:** CKEditor 4 (`CKEDITOR.replace('<textareaId>')`). tablesorter 2.31.3 inlined in `SA_cat_edit`, `sa_support`, `SA_searchlog`.

**Image browser pattern:** modal iframe `FileManager/Default.aspx?type=<product|category|support|pdf>&select=1[&preview=1]`; upload `FileManager/Upload.aspx?type=…`. **`Manager/FileManager/*.aspx` is not in the repo** — naming/resizing must be re-specified. Folders: `/ProdImages/`, `/ProdImages/category/`, `/ProdImages/support/`, `/ProdImages/PDF/`, placeholder `/ProdImages/no-image-sm.jpg`.

---

## 1. SA_cat.asp — Category list
- Menu: Product Management → Categories. Permission `ProductCategories > -1`.
- Bootstrap: if no `categories` row with `idParentCategory = 0`, show "store requires a Root category" (`SA_cat_exec.asp?action=root`).
- Listing: parents `WHERE idParentCategory = 1` (root hard-coded as id 1) ordered by name; children per parent ordered by `categoryType, categoryDesc`, grouped into collapsible groups titled by `categoryType` (blank → "Uncategorized"); "Lost Categories" = everything not rendered and ≠ 1.
- Columns: ID, Parent, Sub-categories, Sort, Featured, Actions (edit → `SA_cat_edit.asp?action=edit&recid=`, test → `/<pagname>`).
- No server-side search; Ctrl+F expands every group. Bulk delete UI is dead.

## 2. SA_cat_edit.asp — Category add / edit / delete
- Permission `ProductCategories > -1` (write needs 1 in exec). Params `action=edit|add|del`, `recId`, `showproducts=1`.
- Fields (all `categories`): `categoryDesc` (name, ≤50, required) · `idParentCategory` (select of all categories) · `categoryType` (`''`, Brands, Size, Type, Filtration Level, Deal, MarketingPromos) · `categoryFeatured` (Y/N) · `sortOrder` (int) · `categoryH1` (≤255) · `hideFromListings` (0 shown / 1 hidden) · `pagname` URL (**readonly on edit; must contain `-cat`, unique, normalized to `.asp` on add**) · `metatitle` · `metadesc` · `metacat` · `categoryHTML` short (≤255) · `categoryHTMLLong` (CKEditor) · `categoryGraphic` splash image (bare filename from `/ProdImages/`) · `categoryContentLocation` (0 above listings / 1 below) · `categoryImage` graphic.
- Nav: List | Add | Manage Products | Manage FAQs | Delete | Preview.
- Products modal: `categories_products ⋈ products` (Entry id, product id, description → product editor, SKU, Active, Remove). Add by pasted list of SKUs or ids (one per line) → `UpdateCategoryProducts.asp`. Remove one at a time.
- FAQ modal: iframe `SA_GetCatFAQs.asp?idCategory=` (category must be saved first).

## 3. SA_cat_exec.asp
- Permission `ProductCategories = 1`. Actions add / edit / del / bulkdel / root.
- Add validation: `pagname` unique (case-insensitive), must contain `-cat`, `NormalizeFileName` (lowercase, non `[a-z0-9-]` → `-`, `.asp` appended); name non-empty; parent exists; featured ∈ {Y,N}; sortOrder numeric else null; short HTML ≤ 255.
- Edit: rejects self-parent and any descendant as parent (recursive walk). **Never updates `pagname`** (URL changes go through redirects).
- Delete: per id in a transaction `DELETE categories_products WHERE idCategory` then `DELETE categories`. Children/products are orphaned (appear in "Lost").
- Root: inserts `('Root', parent 0, 'N')` if none exists.

## 4. UpdateCategoryProducts.asp — AJAX category↔product
- Permission `ProductCategories = 1`. `action=add|remove`, `idCategory`, `ids` (pipe-delimited), `type=sku|id`.
- add by sku: look up `products.sku` → insert `categories_products`; add by id: insert (bug: not validated); remove: deletes only the first id. Echoes SQL to the client.

## 5–8. Category / Product FAQ managers
- `SA_GetCatFAQs.asp?idCategory=` / `SA_GetProdFAQs.asp?idProduct=` (iframe UIs); writers `SA_CatFAQManager.asp` / `SA_ProdFAQManager.asp` (POST only, 403 when `Products = -1`).
- Table `faq`: `id, qType, qDesc, idProduct, idCat, qRank, question (≤250), answer (HTML), active (1/0), typeDesc ('Category FAQ' | 'Product FAQ')`.
- List `WHERE idCat = ? AND isnull(idProduct,0) = 0 ORDER BY qRank, id` (category) / `WHERE idProduct = ? ORDER BY qRank, id` (product).
- Per row: Rank (number), Active (Yes/No), Question, Answer (CKEditor per row). Actions: Add (inserts blank row rank 999 active 1, returns id), Remove, Save All (one POST per row). Drives the FAQPage JSON-LD on the storefront.

## 9–10. SA_news.asp / SA_news_exec.asp — Newsletters
- Menu: Marketing → Newsletters. View `Newsletter > -1`, exec `= 1`. ScriptTimeout 5 h.
- Segment: `custType` A all / I opt-in (`customer.futureMail='Y'`) / O opt-out; `custPaid=Y` only customers with paid orders (cartHead status 1/2/7); plus every `mailinglist` row. Built in staging table `tosend`.
- Form: `newsSubj` (≤255), `newsBody` (plain textarea), `contType=1` HTML, `newsPreview=Y` (one copy to `pEmailSales`), `newsBookmark` resume-from-last-address, hidden `idNews` (update vs insert into `newsletters`: `idNews, newsBookmark, newsSubj, newsBody, newsDate, newsDateInt`).
- Actions: D display list, F download `MailList.csv` (`"email","lastname,name"`), E send in batches of 20 via `sendmail`, updating `newsBookmark` after each batch, with a progress popup.

## 11. SA_redirects.asp — Redirect manager
- Menu: Product Management → Redirects. Page requires `Redirects = 1`.
- Tabs `?type=product|category` → tables `prodRedirect` / `catRedirect`: `id, oldPagename, newPagename, rStatus (1/0), rDate, qr_redirect` (rows with `qr_redirect=1` hidden). Ordered `rStatus DESC, rDate DESC`. No search/paging.
- Add: strips `https?://www.filtersfast.com/` prefixes, lowercases new; old URL must exist as `categories.pagname` / `products.pagename`; new category URL must contain `-cat`, new product URL must contain `p-`, `-filter` or `-replacement`. Insert `rStatus=1, rDate=now, qr_redirect=0`. (Renaming the live page name is left to the editor.)
- GET actions: delete / enable / disable by id. Per row: Test link.

## 12–15. Images and uploads
- `sa_image_management.asp` (Menu: Product Management → Images; `ProductImages ≥ 0`, upload iframes only at level 1). Views: product-images (default), categories, support, pdfs → FileManager upload + browse iframes per type; success banners link `/ProdImages/<img>`, `/ProdImages/category/<img>`, `/ProdImages/PDF<img>`.
- `img_uploader_form.asp`: orphan PHP form (dead).
- `upload.asp` / `upload_exec.asp` (Setup = 1): five file slots into `pImagesDir` or `pDownloadDir` (store config), pure-VBScript multipart parser, client filename kept verbatim, no extension whitelist, overwrite allowed.

## 16. edit_graphics.asp — CP graphics (scheduled banner swaps)
- Setup = 1. Backend `save_graphic_data.php` (not in repo). Record: `graphicId, location (code name, no spaces), defaultFileName (readonly), specialFileName, startDate, stopDate (YYYY-MM-DD), show (force)`. Purpose: temporarily replace a named site graphic between dates.

## 17–18. SA_mods.asp / SA_mod_exec.asp — feature flags
- Menu: Site Administration → Mods. View `Mods > -1`, exec `= 1`. Single row `mods WHERE ModID = 1`.
- Flags (0/1 unless noted): `Titles` dynamic titles · `Insurance` · `Shipping` shipping mod · `Discount` show discount pricing · `related` show related products · `featuredcart` "Why not try" + `featwording` text · `productshipping` show shipping on PDP (live UPS/USPS calls, slow) · `callLongWait` 0 no / 1 yes / **2 down** · `chatActive` · `txtChatEnabled` · `phoneNumActive`.

## 19. SendModelRequest.asp — compatible models add/remove
- Called from the product editor's "Compatible Models Change" modal (`Products = 1`). `action=add|rmv`, `sku`, `idProduct`, `modelData` (`|`-separated lines, spaces encoded as `*`; add lines are `Manufacturer,Model,Category`).
- add: skip duplicates (`idProduct + FridgeModelNumber`), else `INSERT tFridgeModelLookup (idProduct, Manufacturer, FridgeModelNumber, Category, excludeFromFeed=0, noindex=0, cpAddition=1, adminUser=<admin>)`.
- remove: `DELETE … WHERE idProduct IN (product OR its idPaired children) AND FridgeModelNumber = ?` (cascades to paired products; add does not).
- Used to email a monday.com board for approval; now writes directly.

## 20. sa_support.asp — Support portal (single-file app)
- Menu: Customer Management → Support Portal. Requires `Support = 1` even to read.
- Router `?action=` (add-category, update-category, delete-category, order-category, order-articles, update-article, delete-article, add-category-article, remove-category-article, add-faq, remove-faq) and `?viewType=root|category|article|faqs|bot-logs`.
- Categories (`support_categories`: `idCategory, categoryName, categoryImage (/ProdImages/support/), categoryURL (derived from title on add only), categorySortOrder, categoryActive, categoryVisible, categoryBot`): drag-sortable list; editor with Active / Inactive / Hidden (active=1, visible=0) radio, title, URL (disabled), include-in-virtual-chat radio, image (browse/upload/clear). Delete removes assignments, orphans articles.
- Category ↔ articles: modal of unassigned articles (add appends with next sortOrder); assigned list drag-sortable; remove.
- Articles (`support_articles`: `idArticle, articleURL, articleTitle, articleContent (CKEditor), articleKeywords (lowercased, used by search + chat bot)`): list with category, View / Edit / Delete; editor with title, category select (moves the assignment), keywords, content. **URL is regenerated from the title on every save** (breaks links). Delete removes article + `support_faqs` + assignments.
- FAQs view: per article toggle Add FAQ / Remove FAQ = `support_faqs (idFAQ, idArticle)` — promotes the article onto the support home.
- Virtual chat logs: `support_bot_log (supportGUID, idCust, idOrder, userRequest, articleScore, articleID, userResponseToBot ACCEPT/CONTACT/REJECT, requestTimestamp)` filtered by date.
- `EncodeNameToUrl`: lowercase, trim, spaces → `-`, strip punctuation.

## 21–22. Edit_donate_text.asp / Edit_fund.asp
- Setup = 1, PHP backends not in repo. Donate text = one raw-HTML textarea saved to `/js/fund/fund_docs/w3_more.html`. Fundraiser records: `FundraiserID, CampaignID, StartDate, EndDate, ReqStartDate, OrgName, OrgAddress, OrgCity, OrgState, OrgZip, FederalID, ContactName, ContactEmail, ContactPhone` (+ disabled Active/Approved). Edit-only.

## 23. theme.asp — dark/light toggle (cookie `cp_theme`; no auth include; redirects to referrer).

## 24–26. Reviews (SA_rev, SA_rev_edit, SA_rev_exec)
- Menu: Customer Management → Reviews. View `Reviews > -1`, exec `= 1`.
- List `reviews ⋈ products`: filters status (A active / I pending / R rejected), rating 1–5, phrase (subject, detail, name, location, IP), product (select of products having reviews); sort date desc/asc, name, rating, status; 20 per page; criteria remembered in a cookie for 30 days. Columns: date + subject, name – location, product, IP, status, rating, edit, checkbox. Bulk delete with confirm. Help: reviews are IP-checked per product for anti-spam, so keep rejected ones rather than delete.
- Edit: rating, status, name (≤250), location (≤250), email (≤100), subject (≤100), detail (textarea); all required. Delete confirmation view.
- Columns: `idReview, idProduct, revDate, revAuditInfo (IP), revStatus, revRating, revName, revLocation, revEmail, revSubj, revDetail`.

## 27. SA_searchlog.asp — site search log
- Menu: Product Management → Search Log (menu at `Products = 1`; page accepts 0).
- `TOP 500` from `tffsearchparam` (`searchdate, search, searchModified, redirectUrl, auditInfo, mobile, outcome`), optional `searchTerm` LIKE filter, newest first; internal traffic flagged by four hard-coded office IPs. Columns: date, search (link to `/search/?query=`), modified term, redirect URL, internal, mobile, outcome. Sortable, no paging/export.

---

## Appendix A — tables and columns

| Table | Columns |
|---|---|
| `categories` | idCategory, categoryDesc, categoryH1, idParentCategory, categoryFeatured, categoryHTML, categoryHTMLLong, sortOrder, metatitle, metadesc, metacat, pagname, categoryGraphic, categoryImage, categoryContentLocation, categoryType, hideFromListings |
| `categories_products` | idCatProd, idCategory, idProduct |
| `faq` | id, qType, qDesc, idProduct, idCat, qRank, question, answer, active, typeDesc |
| `newsletters` | idNews, newsBookmark, newsSubj, newsBody, newsDate, newsDateInt |
| `tosend` (staging), `customer` (email, lastname, name, futureMail), `mailinglist` (email, lastname, name) | newsletter recipients |
| `prodRedirect`, `catRedirect` | id, oldPagename, newPagename, rStatus, rDate, qr_redirect |
| `mods` | ModID, Titles, Insurance, Shipping, Discount, related, featuredcart, featwording, productshipping, callLongWait, chatActive, txtChatEnabled, phoneNumActive |
| `tFridgeModelLookup` | idModel, idProduct, Manufacturer, FridgeModelNumber, Category, excludeFromFeed, noindex, cpAddition, adminUser |
| `support_categories` | idCategory, categoryName, categoryImage, categoryURL, categorySortOrder, categoryActive, categoryVisible, categoryBot |
| `support_articles` | idArticle, articleTitle, articleURL, articleContent, articleKeywords |
| `support_categories_articles` | idEntry, idCategory, idArticle, sortOrder |
| `support_faqs` | idFAQ, idArticle |
| `support_bot_log` | supportGUID, idCust, idOrder, userRequest, articleScore, articleID, userResponseToBot, requestTimestamp |
| `reviews` | idReview, idProduct, revDate, revDateInt, revAuditInfo, revStatus, revRating, revName, revLocation, revEmail, revSubj, revDetail |
| `tffsearchparam` | searchdate, search, searchModified, redirectUrl, auditInfo, mobile, outcome |

## Appendix B — risks worth not carrying over
Raw SQL concatenation (reviews filters, model request, support ordering); arbitrary upload folder/filename; unauthenticated theme toggle with open redirect; state-changing GET links without CSRF; SQL echoed to the browser; permission-name inconsistencies (category FAQ writer checks `Products`; search log menu `Products = 1` but page accepts 0; redirects menu at 0 but page needs 1); root category hard-coded as id 1; support article URL regenerated on every save.
