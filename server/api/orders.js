'use strict';
/**
 * Order placement and customer-side order tracking.
 * All pricing is recomputed on the server from database values - the client
 * can never dictate a price, discount or total.
 */
const db = require('../db');
const auth = require('../lib/auth');
const { readJson, V } = require('../lib/http');
const M = require('../lib/models');

const STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Shipped', 'Delivered', 'Cancelled'];
const PAY_STATUSES = ['Pending', 'Paid', 'Failed', 'Refunded', 'COD'];

function makeOrderCode() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MKT${ymd}${rand}`;
}

function priceOf(product, weightLabel) {
  const base = product.discount_price && product.discount_price > 0 && product.discount_price < product.price
    ? product.discount_price : product.price;
  if (!weightLabel) return base;
  const opts = M.parseJson(product.weight_options, []);
  const found = opts.find((o) => String(o.label) === String(weightLabel));
  return found && Number(found.price) > 0 ? Number(found.price) : base;
}

/** Compute a full quote from raw cart items. Returns { items, totals, coupon } */
function quote(rawItems, couponCode) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw Object.assign(new Error('Your cart is empty'), { status: 400 });
  if (rawItems.length > 50) throw Object.assign(new Error('Too many items in cart'), { status: 400 });

  const items = [];
  let subtotal = 0;
  for (const it of rawItems) {
    const pid = V.int(it.product_id, 'Product', { required: true, min: 1 });
    const qty = V.int(it.qty, 'Quantity', { required: true, min: 1, max: 99 });
    const weight = V.str(it.weight, 'Weight', { max: 40 });
    const p = db.get('SELECT * FROM products WHERE id = ? AND active = 1', [pid]);
    if (!p) throw Object.assign(new Error('A product in your cart is no longer available'), { status: 400 });
    if (p.stock <= 0) throw Object.assign(new Error(`${p.name} is out of stock`), { status: 400 });
    if (qty > p.stock) throw Object.assign(new Error(`Only ${p.stock} unit(s) of ${p.name} are available`), { status: 400 });
    const unit = priceOf(p, weight);
    const line = Math.round(unit * qty * 100) / 100;
    subtotal += line;
    const img = db.get('SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1', [p.id]);
    items.push({ product_id: p.id, name: p.name, image: img ? img.url : '', weight: weight || p.weight, price: unit, qty, line_total: line });
  }
  subtotal = Math.round(subtotal * 100) / 100;

  // Coupon
  let discount = 0;
  let coupon = null;
  if (couponCode) {
    const c = db.get('SELECT * FROM coupons WHERE UPPER(code) = ? AND active = 1', [String(couponCode).toUpperCase()]);
    if (c
      && (!c.expiry || new Date(c.expiry).getTime() >= Date.now() - 86400000)
      && (c.usage_limit === 0 || c.used_count < c.usage_limit)
      && subtotal >= c.min_order) {
      discount = c.type === 'percent' ? (subtotal * c.value) / 100 : c.value;
      if (c.max_discount > 0) discount = Math.min(discount, c.max_discount);
      discount = Math.min(Math.round(discount * 100) / 100, subtotal);
      coupon = c;
    }
  }

  const gen = db.getSetting('general', {});

  // Minimum order value
  const minOrder = Number(gen.min_order || 0);
  if (minOrder > 0 && subtotal < minOrder) {
    throw Object.assign(new Error(`Minimum order value is ₹${minOrder}`), { status: 400 });
  }

  // Delivery
  const del = db.getSetting('delivery', {});
  const charge = Number(del.charge || 0);
  const freeAbove = Number(del.free_above || 0);
  let delivery = charge;
  if (freeAbove > 0 && subtotal - discount >= freeAbove) delivery = 0;

  // Tax
  const gst = Number(gen.gst_percent || 0);
  const taxable = subtotal - discount;
  const tax = gen.tax_inclusive ? 0 : Math.round(((taxable * gst) / 100) * 100) / 100;

  const total = Math.round((taxable + delivery + tax) * 100) / 100;
  return { items, coupon, totals: { subtotal, discount, delivery_charge: delivery, tax, total } };
}

function register(route) {
  /* -------- live quote (cart / checkout summary) -------- */
  route('POST', '/api/quote', async ({ req }) => {
    const b = await readJson(req);
    const q = quote(b.items, b.coupon_code);
    return { ok: true, items: q.items, totals: q.totals, coupon: q.coupon ? { code: q.coupon.code } : null };
  });

  /* -------- place order -------- */
  route('POST', '/api/orders', async ({ req }) => {
    auth.rateLimit(req, 'order', 12, 10 * 60 * 1000);
    const b = await readJson(req);
    const actor = auth.currentActor(req);
    const user = actor && actor.type === 'user' ? actor.user : null;

    const name = V.str(b.customer_name || b.name, 'Name', { required: true, max: 80 });
    const phone = V.phone(b.phone, 'Mobile number', true);
    const email = V.email(b.email, 'Email', false);
    const address = V.str(b.address, 'Address', { required: true, max: 400 });
    const city = V.str(b.city, 'City', { required: true, max: 80 });
    const state = V.str(b.state, 'State', { required: true, max: 80 });
    const pincode = V.pincode(b.pincode, true);
    const landmark = V.str(b.landmark, 'Landmark', { max: 150 });
    const notes = V.str(b.notes, 'Notes', { max: 500 });
    const method = V.oneOf(b.payment_method || 'cod', ['cod', 'online', 'whatsapp', 'upi'], 'Payment method');

    // Serviceable area check
    const del = db.getSetting('delivery', {});
    const pins = (del.serviceable_pincodes || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (pins.length && !pins.includes(pincode)) {
      throw Object.assign(new Error('Sorry, we do not deliver to this pincode yet. Please contact us on WhatsApp.'), { status: 400 });
    }

    const q = quote(b.items, b.coupon_code);
    const code = makeOrderCode();
    const paymentStatus = method === 'cod' ? 'COD' : 'Pending';

    // The order, its items, the stock decrements and the coupon counter all
    // commit together - or not at all.
    const orderId = db.tx(() => {
      const r = db.run(`INSERT INTO orders
        (order_code, user_id, customer_name, phone, email, address, city, state, pincode, landmark,
         subtotal, discount, delivery_charge, tax, total, coupon_code, payment_method, payment_status, status, notes)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [code, user ? user.id : null, name, phone, email, address, city, state, pincode, landmark,
          q.totals.subtotal, q.totals.discount, q.totals.delivery_charge, q.totals.tax, q.totals.total,
          q.coupon ? q.coupon.code : '', method, paymentStatus, 'Pending', notes]);

      for (const it of q.items) {
        db.run('INSERT INTO order_items(order_id, product_id, name, image, weight, price, qty, line_total) VALUES(?,?,?,?,?,?,?,?)',
          [r.lastId, it.product_id, it.name, it.image, it.weight, it.price, it.qty, it.line_total]);
        db.run('UPDATE products SET stock = MAX(stock - ?, 0), sold_count = sold_count + ? WHERE id = ?',
          [it.qty, it.qty, it.product_id]);
        const p = db.get('SELECT stock FROM products WHERE id = ?', [it.product_id]);
        db.run('INSERT INTO inventory_log(product_id, change, resulting_stock, reason) VALUES(?,?,?,?)',
          [it.product_id, -it.qty, p ? p.stock : 0, 'Order ' + code]);
      }
      if (q.coupon) db.run('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [q.coupon.id]);
      return r.lastId;
    });

    // Save address to profile for logged-in customers
    if (user) {
      db.run('UPDATE users SET address=?, city=?, state=?, pincode=?, landmark=? WHERE id=?',
        [address, city, state, pincode, landmark, user.id]);
    }

    const order = M.orderWithItems(db.get('SELECT * FROM orders WHERE id = ?', [orderId]));
    const contact = db.getSetting('contact', {});
    const branding = db.getSetting('branding', {});
    const waNumber = String(contact.whatsapp || '').replace(/[^\d]/g, '');
    const lines = [
      `*New Order - ${branding.site_name || 'Maai Ka Thekuaa'}*`,
      `Order ID: ${code}`,
      '',
      ...q.items.map((i) => `• ${i.name} ${i.weight ? '(' + i.weight + ')' : ''} x${i.qty} = ₹${i.line_total}`),
      '',
      `Subtotal: ₹${q.totals.subtotal}`,
      q.totals.discount ? `Discount: -₹${q.totals.discount}` : null,
      `Delivery: ₹${q.totals.delivery_charge}`,
      q.totals.tax ? `Tax: ₹${q.totals.tax}` : null,
      `*Total: ₹${q.totals.total}*`,
      '',
      `Name: ${name}`,
      `Mobile: ${phone}`,
      `Address: ${address}, ${city}, ${state} - ${pincode}${landmark ? ' (' + landmark + ')' : ''}`
    ].filter(Boolean);
    const whatsapp_url = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join('\n'))}` : '';

    return { ok: true, order, whatsapp_url, message: 'Order placed successfully!' };
  });

  /* -------- my orders (logged in) -------- */
  route('GET', '/api/my/orders', ({ req }) => {
    const user = auth.requireUser(req);
    const orders = db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [user.id]).map(M.orderWithItems);
    return { ok: true, orders };
  });

  /* -------- track order by code (guest friendly) -------- */
  route('GET', '/api/orders/track/:code', ({ params, query, req }) => {
    const order = db.get('SELECT * FROM orders WHERE order_code = ?', [String(params.code).toUpperCase()]);
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
    const actor = auth.currentActor(req);
    const isOwner = actor && actor.type === 'user' && order.user_id === actor.user.id;
    const isAdmin = actor && actor.type === 'admin';
    const phoneOk = query.phone && String(query.phone).replace(/\D/g, '').slice(-10) === String(order.phone).replace(/\D/g, '').slice(-10);
    if (!isOwner && !isAdmin && !phoneOk) {
      throw Object.assign(new Error('Please enter the mobile number used for this order'), { status: 403 });
    }
    return { ok: true, order: M.orderWithItems(order), statuses: STATUSES };
  });
}

module.exports = { register, quote, STATUSES, PAY_STATUSES, makeOrderCode };
