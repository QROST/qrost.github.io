/**
 * China small-city housing — multiple price offers per listing (一楼盘多价格挂牌).
 *
 * GENERATED FILE — do not hand-edit. Source is data/housing.db (listing_offers),
 * populated by `manage.py import-offers`; regenerate with `manage.py build`.
 *
 * Additional price points (面积/户型/单价/时间) under one listing — the listings row
 * stays the canonical/representative offer; these show in the detail modal. Every
 * offer carries sourceUrl (cite-or-omit). unitPrice is derived (priceWan*1e4/area).
 *   window.HOUSING_OFFERS = {"<listing_id>": [{area, priceWan, unitPrice, rent,
 *     layout, orientation, floorNote, updated, sourceUrl, note}, …]}  // sorted by 单价 asc
 */
window.HOUSING_OFFERS = {"252":[{"area":87.85,"floorNote":"满五唯一","layout":"2室2厅","note":"单价最低 ~2960/㎡","orientation":null,"priceWan":26.0,"rent":null,"sourceUrl":"https://mobile.anjuke.com/esf/zhan-cm1036849/","unitPrice":2960,"updated":"2026-06"},{"area":101.4,"floorNote":null,"layout":"2室2厅","note":null,"orientation":"南北朝向","priceWan":38.0,"rent":null,"sourceUrl":"https://mobile.anjuke.com/esf/zhan-cm1036849/","unitPrice":3748,"updated":"2026-06"},{"area":101.4,"floorNote":null,"layout":"3室2厅","note":"大三房低单价 ~3945/㎡","orientation":"南北通透","priceWan":40.0,"rent":null,"sourceUrl":"https://mobile.anjuke.com/esf/zhan-cm1036849/","unitPrice":3945,"updated":"2026-06"},{"area":103.0,"floorNote":"可看海景","layout":"2室2厅","note":null,"orientation":null,"priceWan":43.0,"rent":null,"sourceUrl":"https://mobile.anjuke.com/esf/zhan-cm1036849/","unitPrice":4175,"updated":"2026-06"},{"area":100.21,"floorNote":"房东直卖","layout":"3室2厅","note":null,"orientation":null,"priceWan":46.0,"rent":null,"sourceUrl":"https://mobile.anjuke.com/esf/zhan-cm1036849/","unitPrice":4590,"updated":"2026-06"}]};
