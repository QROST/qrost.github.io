/**
 * Merge locale-specific copy from products.i18n.json into a product object.
 * Shape per slug/lang: { name?, description?, imageAlt?, short?, gallery?: [{alt}], variants?: [{name}] }
 */
(function () {
  'use strict';

  function mergeGallery(baseGallery, locGallery) {
    if (!Array.isArray(baseGallery) || !Array.isArray(locGallery)) return baseGallery;
    return baseGallery.map((g, i) => {
      const loc = locGallery[i];
      if (!loc || loc.alt == null || loc.alt === '') return g;
      return { ...g, alt: loc.alt };
    });
  }

  function mergeVariants(baseVariants, locVariants) {
    if (!Array.isArray(baseVariants) || !Array.isArray(locVariants)) return baseVariants;
    return baseVariants.map((v, i) => {
      const loc = locVariants[i];
      if (!loc || !loc.name) return v;
      return { ...v, name: loc.name };
    });
  }

  window.localizeProduct = function localizeProduct(product, packRow) {
    if (!product || !packRow) return product;
    const o = { ...product };
    if (packRow.name) o.name = packRow.name;
    if (packRow.description != null && packRow.description !== '') o.description = packRow.description;
    if (packRow.imageAlt) o.imageAlt = packRow.imageAlt;
    if (packRow.short != null && packRow.short !== '') o.short = packRow.short;
    if (packRow.gallery) o.gallery = mergeGallery(product.gallery, packRow.gallery);
    if (packRow.variants) o.variants = mergeVariants(product.variants, packRow.variants);
    return o;
  };

  window.localizeProductList = function localizeProductList(products, packs, lang) {
    const l = lang || (window.getLang && window.getLang()) || 'en';
    if (!packs || l === 'en') return products;
    return products.map((p) => {
      const row = packs[p.slug] && packs[p.slug][l];
      return row ? window.localizeProduct(p, row) : p;
    });
  };
})();
