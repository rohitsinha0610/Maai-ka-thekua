'use strict';
/** Shared data-shaping helpers used by both the public API and the admin API. */
const db = require('../db');

function parseJson(v, fallback) {
  if (v === null || v === undefined || v === '') return fallback;
  try { return JSON.parse(v); } catch (e) { return fallback; }
}

function ratingFor(productId) {
  const r = db.get(
    "SELECT ROUND(AVG(rating),1) AS avg, COUNT(*) AS count FROM reviews WHERE product_id = ? AND status = 'approved'",
    [productId]);
  return { rating: r && r.avg ? r.avg : 0, review_count: r ? r.count : 0 };
}

function imagesFor(productId) {
  return db.all('SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [productId])
    .map((r) => r.url);
}

function shapeProduct(p, { full = false } = {}) {
  if (!p) return null;
  const imgs = imagesFor(p.id);
  const rt = ratingFor(p.id);
  const effective = p.discount_price && p.discount_price > 0 && p.discount_price < p.price ? p.discount_price : p.price;
  const out = {
    id: p.id,
    name: p.name,
    slug: p.slug,
    category_id: p.category_id,
    category: p.category_name || null,
    category_slug: p.category_slug || null,
    price: p.price,
    discount_price: p.discount_price || 0,
    effective_price: effective,
    discount_percent: p.discount_price && p.discount_price > 0 && p.discount_price < p.price
      ? Math.round(((p.price - p.discount_price) / p.price) * 100) : 0,
    short_desc: p.short_desc,
    weight: p.weight,
    weight_options: parseJson(p.weight_options, []),
    stock: p.stock,
    in_stock: p.stock > 0,
    active: p.active,
    featured: p.featured,
    sold_count: p.sold_count,
    image: imgs[0] || '/uploads/placeholder.svg',
    images: imgs.length ? imgs : ['/uploads/placeholder.svg'],
    rating: rt.rating,
    review_count: rt.review_count
  };
  if (full) {
    out.description = p.description;
    out.ingredients = p.ingredients;
    out.nutrition = p.nutrition;
    out.low_stock_alert = p.low_stock_alert;
    out.sort_order = p.sort_order;
    out.created_at = p.created_at;
  }
  return out;
}

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

function getProductById(id, opts) {
  return shapeProduct(db.get(PRODUCT_SELECT + ' WHERE p.id = ?', [id]), opts);
}
function getProductBySlug(slug, opts) {
  return shapeProduct(db.get(PRODUCT_SELECT + ' WHERE p.slug = ?', [slug]), opts);
}

function uniqueSlug(table, base, ignoreId) {
  let slug = base || 'item';
  let i = 1;
  while (true) {
    const row = ignoreId
      ? db.get(`SELECT id FROM ${table} WHERE slug = ? AND id <> ?`, [slug, ignoreId])
      : db.get(`SELECT id FROM ${table} WHERE slug = ?`, [slug]);
    if (!row) return slug;
    i += 1;
    slug = `${base}-${i}`;
  }
}

function orderWithItems(order) {
  if (!order) return null;
  order.items = db.all('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [order.id]);
  return order;
}

module.exports = {
  parseJson, ratingFor, imagesFor, shapeProduct, PRODUCT_SELECT,
  getProductById, getProductBySlug, uniqueSlug, orderWithItems
};
