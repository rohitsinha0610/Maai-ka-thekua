'use strict';
/**
 * First-run seed: creates the admin account, website settings, navbar,
 * homepage sections, story, categories, demo products, coupons, banners,
 * policy pages and a few demo reviews/orders.
 *
 * Safe to run repeatedly - it only seeds when the tables are empty.
 * Force a full reseed with:  node server/seed.js --force
 */
const db = require('./db');
const config = require('./config');
const auth = require('./lib/auth');
const { ensureAssets } = require('./assets');
const M = require('./lib/models');

function count(table) {
  const r = db.get(`SELECT COUNT(*) AS n FROM ${table}`);
  return r ? r.n : 0;
}

function ensureSeed() {
  const A = ensureAssets();

  /* ---------------- admin ---------------- */
  if (count('admins') === 0) {
    const salt = auth.makeSalt();
    db.run('INSERT INTO admins(username, email, name, password_hash, salt, role) VALUES(?,?,?,?,?,?)',
      [config.ADMIN_USERNAME, config.ADMIN_EMAIL.toLowerCase(), 'Store Owner',
        auth.hashPassword(config.ADMIN_PASSWORD, salt), salt, 'owner']);
  }

  /* ---------------- settings ---------------- */
  if (!db.getSetting('branding')) {
    db.setSetting('branding', {
      site_name: 'Maai Ka Thekuaa',
      tagline: 'स्वाद जो घर की याद दिलाए',
      logo: A.logo,
      favicon: A.favicon,
      brand_description: 'Maai Ka Thekuaa brings you handmade, traditional Bihari thekua and desi sweets — made the way maa makes them, with pure ghee, gur and a lot of love.',
      footer_note: '© ' + new Date().getFullYear() + ' Maai Ka Thekuaa. Made with ❤ in India.'
    });
  }
  if (!db.getSetting('theme')) {
    db.setSetting('theme', {
      primary: '#B23A18',      // subtle red
      secondary: '#E8892B',    // saffron
      accent: '#C9772F',
      background: '#FFF8EE',   // cream
      surface: '#FFFFFF',
      text: '#3A2113',         // dark brown
      muted: '#8A6247',
      button: '#B23A18',
      button_text: '#FFF6E8',
      dark: '#4A2412',
      radius: '18'
    });
  }
  if (!db.getSetting('contact')) {
    db.setSetting('contact', {
      phone: '+91 98765 43210',
      whatsapp: '919876543210',
      email: 'hello@maaikathekuaa.com',
      address: 'Shop No. 4, Ganga Vihar, Patna, Bihar 800001, India',
      map_embed: 'https://www.google.com/maps?q=Patna,Bihar&output=embed',
      hours: 'Mon – Sun, 9:00 AM to 9:00 PM'
    });
  }
  if (!db.getSetting('social')) {
    db.setSetting('social', {
      instagram: 'https://instagram.com/',
      facebook: 'https://facebook.com/',
      youtube: 'https://youtube.com/',
      x: '',
      whatsapp_channel: ''
    });
  }
  if (!db.getSetting('delivery')) {
    db.setSetting('delivery', {
      charge: 49,
      free_above: 999,
      serviceable_pincodes: '',
      serviceable_cities: 'Patna, Muzaffarpur, Gaya, Delhi, Mumbai',
      eta: 'Delivered in 3–5 days across India'
    });
  }
  if (!db.getSetting('general')) {
    db.setSetting('general', {
      currency: '₹',
      currency_code: 'INR',
      gst_percent: 5,
      tax_inclusive: true,
      min_order: 0,
      cod_enabled: true,
      online_payment_enabled: false,
      whatsapp_order_enabled: true,
      auto_approve_reviews: false,
      order_prefix: 'MKT'
    });
  }
  if (!db.getSetting('about')) {
    db.setSetting('about', {
      heading: 'About Maai Ka Thekuaa',
      subheading: 'Parampara ke saath, maa ke haath ka swad',
      body: 'Maai Ka Thekuaa is a small family kitchen that grew into a brand. We make thekua and traditional Indian sweets in small batches using the same recipes our mothers and grandmothers used — whole wheat atta, pure desi ghee, natural gur and dry fruits. No preservatives, no shortcuts, no factory machines.\n\nEvery batch is hand-moulded on a wooden saancha, slow-fried and packed the same day so it reaches you fresh. Whether it is Chhath Puja, Diwali, a wedding or just a chai-time craving, we want one bite to take you straight back to your mother\'s kitchen.',
      mission: 'Our mission is simple — to take the taste of a mother\'s hands to every home in India, without ever compromising on purity, tradition or love.',
      image: A.story1
    });
  }
  if (!db.getSetting('story_meta')) {
    db.setSetting('story_meta', {
      title: 'Maai Ki Kahani',
      subtitle: 'हर स्वाद के पीछे एक कहानी होती है…',
      hero_image: A.founder,
      quote: 'Maai Ka Thekuaa — स्वाद जो घर की याद दिलाए। ❤️'
    });
  }
  if (!db.getSetting('seo')) {
    db.setSetting('seo', {
      title: 'Maai Ka Thekuaa — Traditional Homemade Thekua & Indian Sweets',
      description: 'Authentic handmade thekua and traditional Indian sweets made with desi ghee, gur and love. Order online, delivered fresh across India.'
    });
  }
  if (!db.getSetting('footer')) {
    db.setSetting('footer', {
      about_text: 'Handmade thekua & traditional Indian sweets, made the way maa makes them.',
      quick_links_title: 'Quick Links',
      categories_title: 'Categories',
      contact_title: 'Get in Touch'
    });
  }

  /* ---------------- navbar ---------------- */
  if (count('nav_items') === 0) {
    [
      ['Home', '/'],
      ['Our Story', '/story'],
      ['Products', '/products'],
      ['About', '/about'],
      ['Contact', '/contact']
    ].forEach(([label, link], i) => {
      db.run('INSERT INTO nav_items(label, link, sort_order, active) VALUES(?,?,?,1)', [label, link, i]);
    });
  }

  /* ---------------- homepage sections ---------------- */
  if (count('home_sections') === 0) {
    const sections = [
      {
        type: 'hero', title: 'Maai Ke Haath Ka Swad, Ab Aapke Ghar Tak',
        subtitle: 'Authentic, hand-moulded thekua and traditional Indian sweets — made in small batches with pure desi ghee, natural gur and whole wheat atta, exactly the way maa makes them at home.',
        image: A.hero, button_text: 'Shop Now', button_link: '/products',
        button2_text: 'Our Story', button2_link: '/story',
        config: { badge: 'हाथ से बना • शुद्ध देसी घी • बिना प्रिज़र्वेटिव' }
      },
      { type: 'usp', title: 'Why families choose us', subtitle: 'Parampara, shuddhta aur apnapan — har batch mein', config: {} },
      { type: 'categories', title: 'Shop by Category', subtitle: 'हर स्वाद के लिए कुछ खास', config: {} },
      { type: 'featured', title: 'Featured Delights', subtitle: 'Our most-loved handmade treats', button_text: 'View all products', button_link: '/products', config: {} },
      { type: 'offers', title: 'Festival Offers', subtitle: 'Save more on your favourite sweets', config: {} },
      { type: 'story', title: 'Maai Ki Kahani', subtitle: 'हर स्वाद के पीछे एक कहानी होती है…', image: A.founder, button_text: 'Read our story', button_link: '/story', config: {} },
      { type: 'bestsellers', title: 'Best Sellers', subtitle: 'Sabse zyada pasand kiye gaye', config: {} },
      { type: 'testimonials', title: 'Ghar Ghar Se Pyaar', subtitle: 'What our customers say', config: {} },
      { type: 'gallery', title: 'From Our Kitchen', subtitle: 'Fresh batches, made every morning', config: {} },
      { type: 'cta', title: 'Order on WhatsApp in one tap', subtitle: 'Bulk orders, festival hampers and custom gift boxes — talk to us directly.', button_text: 'Chat on WhatsApp', button_link: 'whatsapp', config: {} }
    ];
    sections.forEach((s, i) => {
      db.run(`INSERT INTO home_sections(type,title,subtitle,body,image,button_text,button_link,button2_text,button2_link,config,sort_order,active)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,1)`,
        [s.type, s.title || '', s.subtitle || '', s.body || '', s.image || '', s.button_text || '', s.button_link || '',
          s.button2_text || '', s.button2_link || '', JSON.stringify(s.config || {}), i]);
    });
  }

  /* ---------------- story sections ---------------- */
  if (count('story_sections') === 0) {
    const story = [
      { type: 'paragraph', heading: 'हर स्वाद के पीछे एक कहानी होती है…', body: 'हर स्वाद के पीछे एक कहानी होती है… और हमारी कहानी शुरू हुई माँ के हाथों से। ❤️', image: '', meta: '' },
      { type: 'image', heading: 'घर की रसोई से शुरुआत', body: 'Maai Ka Thekuaa की शुरुआत घर की रसोई से हुई, जहाँ पारंपरिक तरीके से बने स्वादिष्ट ठेकुए ने परिवार और दोस्तों का दिल जीत लिया।', image: A.story1, meta: 'हमारी पहली रसोई' },
      { type: 'paragraph', heading: 'बचपन की याद', body: 'बचपन से माँ के हाथों के बने ठेकुए का स्वाद हमारे लिए सिर्फ एक मिठाई नहीं, बल्कि घर, अपनापन और त्योहारों की याद रहा है। इसी स्वाद और प्यार को हर घर तक पहुँचाने के छोटे से सपने से ‘Maai Ka Thekuaa’ की शुरुआत हुई।', image: '', meta: '' },
      { type: 'image', heading: 'त्योहारों का स्वाद', body: 'छठ, दीवाली, होली — हर त्योहार पर घर में ठेकुए की खुशबू फैलती थी। वही खुशबू आज हम आपके घर तक पहुँचाते हैं।', image: A.story2, meta: 'त्योहार और परंपरा' },
      { type: 'paragraph', heading: 'आज भी वही अपनापन', body: 'आज भी हम कोशिश करते हैं कि हर ठेकुए में वही घर जैसा स्वाद, पारंपरिक विधि और माँ के हाथों जैसा अपनापन बना रहे।', image: '', meta: '' },
      { type: 'quote', heading: '', body: 'Maai Ka Thekuaa — स्वाद जो घर की याद दिलाए। ❤️', image: '', meta: '' },
      { type: 'founder', heading: 'माँ — हमारी पहली शेफ', body: 'हमारी हर रेसिपी माँ की डायरी से आती है। लकड़ी के साँचे से बना हर ठेकुआ, धीमी आँच पर तला जाता है — ठीक वैसे ही जैसे वो बनाती थीं।', image: A.founder, meta: 'Founder & Family' },
      { type: 'timeline', heading: 'घर की रसोई', body: 'पहला बैच सिर्फ परिवार और पड़ोसियों के लिए बना।', image: '', meta: '2019' },
      { type: 'timeline', heading: 'पहला त्योहार ऑर्डर', body: 'छठ पूजा पर 200+ परिवारों तक ठेकुआ पहुँचा।', image: '', meta: '2021' },
      { type: 'timeline', heading: 'अपनी छोटी दुकान', body: 'पटना में पहली किचन-शॉप शुरू हुई।', image: '', meta: '2023' },
      { type: 'timeline', heading: 'पूरे भारत में डिलीवरी', body: 'अब हर घर तक — ऑनलाइन ऑर्डर के साथ।', image: '', meta: '2025' }
    ];
    story.forEach((s, i) => {
      db.run('INSERT INTO story_sections(type, heading, body, image, meta, sort_order, active) VALUES(?,?,?,?,?,?,1)',
        [s.type, s.heading, s.body, s.image, s.meta, i]);
    });
  }

  /* ---------------- cards (usp / about / gallery) ---------------- */
  if (count('cards') === 0) {
    const usp = [
      ['100% Homemade', 'Hand-moulded on a wooden saancha, in small batches — never machine made.', '🪔'],
      ['Pure Desi Ghee & Gur', 'Only whole wheat atta, natural gur and pure ghee. Nothing artificial.', '🍯'],
      ['No Preservatives', 'Freshly fried and packed the same day it is made.', '🌿'],
      ['Festival Ready Packing', 'Beautiful gift boxes for Chhath, Diwali and weddings.', '🎁']
    ];
    usp.forEach((c, i) => db.run('INSERT INTO cards(section_key,title,description,icon,sort_order,active) VALUES(?,?,?,?,?,1)', ['usp', c[0], c[1], c[2], i]));

    const about = [
      ['Traditional Recipes', 'Every recipe comes straight from our mother\'s handwritten diary — unchanged for three generations.', '📖'],
      ['Quality You Can Taste', 'We source atta, gur and dry fruits from trusted local suppliers and test every batch ourselves.', '✅'],
      ['Authentic Taste', 'Slow-fried on a low flame so the thekua stays crisp outside and soft inside.', '🔥'],
      ['Homemade Feel', 'Packed by hand, with a note, exactly like a parcel from home.', '💌']
    ];
    about.forEach((c, i) => db.run('INSERT INTO cards(section_key,title,description,icon,sort_order,active) VALUES(?,?,?,?,?,1)', ['about', c[0], c[1], c[2], i]));

    A.gallery.forEach((img, i) => db.run('INSERT INTO cards(section_key,title,image,sort_order,active) VALUES(?,?,?,?,1)', ['gallery', 'Fresh batch ' + (i + 1), img, i]));
  }

  /* ---------------- categories ---------------- */
  if (count('categories') === 0) {
    const cats = [
      ['Thekua', 'The hero of our kitchen — crisp, gur-sweet and made on a wooden mould.', A.cat.thekua],
      ['Traditional Sweets', 'Classic Indian mithai made with the same old-school patience.', A.cat.sweets],
      ['Special Collection', 'Limited, small-batch treats made with premium ingredients.', A.cat.special],
      ['Gift Packs', 'Ready-to-gift boxes and hampers for every occasion.', A.cat.gift],
      ['Festival Specials', 'Chhath, Diwali and Holi favourites, made fresh for the season.', A.cat.festival]
    ];
    cats.forEach((c, i) => {
      db.run('INSERT INTO categories(name, slug, description, image, sort_order, active) VALUES(?,?,?,?,?,1)',
        [c[0], M.uniqueSlug('categories', c[0].toLowerCase().replace(/\s+/g, '-')), c[1], c[2], i]);
    });
  }

  /* ---------------- products ---------------- */
  if (config.SEED_DEMO && count('products') === 0) {
    const catId = (name) => {
      const c = db.get('SELECT id FROM categories WHERE name = ?', [name]);
      return c ? c.id : null;
    };
    const items = [
      {
        name: 'Traditional Gur Thekua', cat: 'Thekua', price: 349, discount: 299, weight: '500 g', stock: 60, featured: 1,
        image: A.products.gur,
        short: 'The classic — whole wheat, natural jaggery and pure ghee, hand-moulded and slow-fried.',
        desc: 'Our signature thekua, made exactly the way it has been made in Bihari homes for generations. Whole wheat atta is kneaded with melted gur (natural jaggery), a hint of saunf and grated coconut, moulded on a wooden saancha and fried slowly in pure ghee until it turns deep golden. Crisp on the outside, soft and crumbly inside, with a deep caramel sweetness that never feels heavy. Perfect with morning chai and essential for Chhath Puja prasad.',
        ing: 'Whole wheat flour (atta), natural jaggery (gur), pure desi ghee, dry coconut, fennel seeds (saunf), green cardamom.',
        nut: 'Per 100 g (approx.) — Energy 452 kcal | Protein 6.2 g | Carbohydrates 62 g | Total Sugars 24 g | Fat 19 g | Fibre 3.1 g',
        options: [{ label: '250 g', price: 179 }, { label: '500 g', price: 299 }, { label: '1 kg', price: 549 }]
      },
      {
        name: 'Desi Ghee Thekua', cat: 'Thekua', price: 429, discount: 379, weight: '500 g', stock: 45, featured: 1,
        image: A.products.ghee,
        short: 'Extra rich thekua fried purely in A2 desi ghee — festive, fragrant and melt-in-mouth.',
        desc: 'For those who believe ghee is not an ingredient but an emotion. This thekua uses double the ghee of our regular batch, giving it a richer aroma, a shorter bite and a beautiful golden colour. Made fresh on order in small batches and packed within hours of frying.',
        ing: 'Whole wheat flour, pure A2 desi ghee, natural jaggery, sugar, dry coconut, cardamom, fennel seeds.',
        nut: 'Per 100 g (approx.) — Energy 486 kcal | Protein 6.0 g | Carbohydrates 58 g | Total Sugars 22 g | Fat 25 g | Fibre 2.9 g',
        options: [{ label: '250 g', price: 219 }, { label: '500 g', price: 379 }, { label: '1 kg', price: 699 }]
      },
      {
        name: 'Coconut Thekua', cat: 'Thekua', price: 379, discount: 0, weight: '500 g', stock: 38, featured: 1,
        image: A.products.coconut,
        short: 'Loaded with fresh grated coconut for a tropical, chewy twist on the classic.',
        desc: 'A softer, coconut-forward thekua that our customers keep coming back for. Freshly grated coconut is folded into the atta-gur dough, which makes each piece slightly chewy in the middle with a sweet nutty finish. A favourite with kids.',
        ing: 'Whole wheat flour, fresh grated coconut, natural jaggery, pure ghee, cardamom, fennel seeds.',
        nut: 'Per 100 g (approx.) — Energy 468 kcal | Protein 5.8 g | Carbohydrates 59 g | Total Sugars 25 g | Fat 22 g | Fibre 4.0 g',
        options: [{ label: '250 g', price: 199 }, { label: '500 g', price: 379 }]
      },
      {
        name: 'Dry Fruit Thekua', cat: 'Special Collection', price: 549, discount: 499, weight: '500 g', stock: 30, featured: 1,
        image: A.products.dryfruit,
        short: 'Premium thekua studded with almonds, cashews and pistachios.',
        desc: 'Our most premium thekua. Hand-chopped almonds, cashews and pistachios are pressed into every piece before frying, so you get a crunch of dry fruit in every bite. Packed in a sturdy box — this is the one people gift.',
        ing: 'Whole wheat flour, natural jaggery, pure desi ghee, almonds, cashew nuts, pistachios, dry coconut, cardamom.',
        nut: 'Per 100 g (approx.) — Energy 512 kcal | Protein 8.4 g | Carbohydrates 54 g | Total Sugars 21 g | Fat 28 g | Fibre 4.6 g',
        options: [{ label: '250 g', price: 279 }, { label: '500 g', price: 499 }, { label: '1 kg', price: 949 }]
      },
      {
        name: 'Festival Special Thekua', cat: 'Festival Specials', price: 469, discount: 419, weight: '500 g', stock: 50, featured: 1,
        image: A.products.festival,
        short: 'Chhath & Diwali special batch — made with extra care, blessed with tradition.',
        desc: 'Prepared during the festival season following the traditional vidhi — clean kitchen, fresh ingredients, no onion-garlic contact, and packed in food-grade festive boxes suitable for prasad. Order early, this batch sells out every year.',
        ing: 'Whole wheat flour, natural jaggery, pure desi ghee, dry coconut, cardamom, fennel seeds.',
        nut: 'Per 100 g (approx.) — Energy 460 kcal | Protein 6.1 g | Carbohydrates 61 g | Total Sugars 24 g | Fat 20 g | Fibre 3.2 g',
        options: [{ label: '500 g', price: 419 }, { label: '1 kg', price: 799 }]
      },
      {
        name: 'Thekua Gift Box (Assorted)', cat: 'Gift Packs', price: 999, discount: 899, weight: '1 kg', stock: 25, featured: 1,
        image: A.products.giftbox,
        short: 'Four thekua varieties in one beautiful festive box — the perfect gift.',
        desc: 'A premium assorted hamper with 250 g each of Gur Thekua, Desi Ghee Thekua, Coconut Thekua and Dry Fruit Thekua, arranged in a hand-tied box with a personal note card. Ideal for Diwali, Chhath, housewarmings and corporate gifting.',
        ing: 'Whole wheat flour, natural jaggery, pure desi ghee, dry coconut, almonds, cashews, pistachios, cardamom, fennel.',
        nut: 'Per 100 g (approx.) — Energy 480 kcal | Protein 6.8 g | Carbohydrates 58 g | Total Sugars 23 g | Fat 23 g | Fibre 3.6 g',
        options: [{ label: '1 kg box', price: 899 }, { label: '2 kg box', price: 1699 }]
      },
      {
        name: 'Til Kut (Sesame Brittle)', cat: 'Traditional Sweets', price: 299, discount: 269, weight: '400 g', stock: 40, featured: 0,
        image: A.products.tilkut,
        short: 'Gaya-style til kut — roasted sesame pounded with gur until it flakes.',
        desc: 'A winter classic from Gaya. White sesame seeds are roasted, then pounded with jaggery on a stone until the mixture turns light and flaky. Eaten through Makar Sankranti in every Bihari home.',
        ing: 'White sesame seeds (til), natural jaggery, sugar.',
        nut: 'Per 100 g (approx.) — Energy 498 kcal | Protein 12 g | Carbohydrates 52 g | Total Sugars 34 g | Fat 26 g | Fibre 6.2 g',
        options: [{ label: '400 g', price: 269 }, { label: '800 g', price: 499 }]
      },
      {
        name: 'Besan Laddu', cat: 'Traditional Sweets', price: 399, discount: 0, weight: '500 g', stock: 35, featured: 0,
        image: A.products.laddu,
        short: 'Slow-roasted gram flour laddus, heavy on ghee and cardamom.',
        desc: 'Besan is roasted patiently on a low flame for nearly an hour until it turns nutty and deep golden, then bound with ghee, boora and cardamom and rolled by hand. Soft, grainy and deeply comforting.',
        ing: 'Gram flour (besan), pure desi ghee, powdered sugar (boora), cardamom, chopped almonds.',
        nut: 'Per 100 g (approx.) — Energy 505 kcal | Protein 9.5 g | Carbohydrates 55 g | Total Sugars 30 g | Fat 27 g | Fibre 3.8 g',
        options: [{ label: '250 g', price: 219 }, { label: '500 g', price: 399 }]
      },
      {
        name: 'Khaja (Layered Crisp)', cat: 'Traditional Sweets', price: 349, discount: 319, weight: '400 g', stock: 28, featured: 0,
        image: A.products.khaja,
        short: 'Silao-style khaja — dozens of paper-thin layers dipped in light sugar syrup.',
        desc: 'Made by folding and rolling ghee-laminated dough again and again to create dozens of flaky layers, then fried and dipped in a one-string sugar syrup. Shatters beautifully at the first bite.',
        ing: 'Refined wheat flour, pure desi ghee, sugar, cardamom.',
        nut: 'Per 100 g (approx.) — Energy 470 kcal | Protein 5.2 g | Carbohydrates 64 g | Total Sugars 32 g | Fat 21 g | Fibre 1.4 g',
        options: [{ label: '400 g', price: 319 }]
      },
      {
        name: 'Anarsa', cat: 'Special Collection', price: 379, discount: 0, weight: '400 g', stock: 22, featured: 0,
        image: A.products.anarsa,
        short: 'Rice-flour sweet coated in sesame — crisp edges, chewy centre.',
        desc: 'Soaked rice is ground and fermented with jaggery for three days, shaped into discs, coated generously with sesame and fried till the edges crisp. A Diwali speciality that very few kitchens still make by hand.',
        ing: 'Rice, natural jaggery, white sesame seeds, pure desi ghee.',
        nut: 'Per 100 g (approx.) — Energy 455 kcal | Protein 5.0 g | Carbohydrates 66 g | Total Sugars 30 g | Fat 19 g | Fibre 2.2 g',
        options: [{ label: '400 g', price: 379 }]
      }
    ];

    items.forEach((it, i) => {
      const slug = M.uniqueSlug('products', it.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
      const r = db.run(`INSERT INTO products
        (name, slug, category_id, price, discount_price, short_desc, description, ingredients, nutrition, weight, weight_options, stock, low_stock_alert, active, featured, sold_count, sort_order)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
        [it.name, slug, catId(it.cat), it.price, it.discount, it.short, it.desc, it.ing, it.nut, it.weight,
          JSON.stringify(it.options), it.stock, 5, it.featured, Math.floor(Math.random() * 60) + 8, i]);
      db.run('INSERT INTO product_images(product_id, url, sort_order) VALUES(?,?,0)', [r.lastId, it.image]);
      db.run('INSERT INTO product_images(product_id, url, sort_order) VALUES(?,?,1)', [r.lastId, A.gallery[i % A.gallery.length]]);
    });
  }

  /* ---------------- coupons ---------------- */
  if (config.SEED_DEMO && count('coupons') === 0) {
    const expiry = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    db.run('INSERT INTO coupons(code,type,value,min_order,max_discount,expiry,usage_limit,description,active) VALUES(?,?,?,?,?,?,?,?,1)',
      ['MAAI10', 'percent', 10, 499, 150, expiry, 0, '10% off on orders above ₹499']);
    db.run('INSERT INTO coupons(code,type,value,min_order,max_discount,expiry,usage_limit,description,active) VALUES(?,?,?,?,?,?,?,?,1)',
      ['CHHATH100', 'fixed', 100, 899, 0, expiry, 200, 'Flat ₹100 off on festival orders above ₹899']);
    db.run('INSERT INTO coupons(code,type,value,min_order,max_discount,expiry,usage_limit,description,active) VALUES(?,?,?,?,?,?,?,?,1)',
      ['FIRSTORDER', 'percent', 15, 299, 200, expiry, 500, '15% off on your first order']);
  }

  /* ---------------- banners ---------------- */
  if (config.SEED_DEMO && count('banners') === 0) {
    db.run('INSERT INTO banners(image, heading, description, button_text, button_link, active, sort_order) VALUES(?,?,?,?,?,1,0)',
      [A.banners[0], 'Festival Special Thekua', 'Chhath • Diwali • Holi — ghar jaisa swad, ab online', 'Order Now', '/products?category=festival-specials']);
    db.run('INSERT INTO banners(image, heading, description, button_text, button_link, active, sort_order) VALUES(?,?,?,?,?,1,1)',
      [A.banners[1], 'Free Delivery above ₹999', 'Fresh batch, packed the same day it is fried', 'Shop Now', '/products']);
  }

  /* ---------------- policy pages ---------------- */
  if (count('pages') === 0) {
    const pages = [
      ['privacy', 'Privacy Policy',
        'We collect only the information needed to deliver your order — your name, mobile number, email and delivery address.\n\nWhat we collect\n• Contact details you enter at checkout or while creating an account.\n• Order history so you can track and reorder.\n• Basic technical information such as your browser type.\n\nHow we use it\n• To prepare, pack and deliver your order.\n• To contact you about your order on call or WhatsApp.\n• To send festival offers, only if you have opted in.\n\nWhat we never do\nWe never sell or rent your personal data. Payment information is handled by the payment gateway and is never stored on our servers.\n\nYour choices\nWrite to us at hello@maaikathekuaa.com to update or delete your data at any time.'],
      ['terms', 'Terms & Conditions',
        'By placing an order on this website you agree to the terms below.\n\nOrders\n• All orders are subject to availability and confirmation of the order price.\n• We prepare items fresh, so dispatch may take 1–2 working days.\n• Prices are in Indian Rupees and inclusive of applicable taxes unless stated otherwise.\n\nProduct information\nOur sweets are handmade, so size, colour and weight may vary slightly between batches. Images are indicative.\n\nAllergens\nOur products are made in a kitchen that also handles wheat, milk products, sesame and tree nuts.\n\nShelf life\nThekua stays fresh for 15–20 days in an airtight container at room temperature. Keep away from moisture.\n\nLiability\nOur liability for any order is limited to the value of that order.'],
      ['refund', 'Refund & Cancellation Policy',
        'Cancellation\n• Orders can be cancelled free of charge before they are dispatched. Call or WhatsApp us with your Order ID.\n• Once an order is dispatched it cannot be cancelled, as the items are freshly made.\n\nRefunds\n• If your order arrives damaged, broken or incorrect, share photos with us within 24 hours of delivery.\n• Verified issues are refunded to the original payment method within 5–7 working days, or replaced in the next batch — your choice.\n• Being a perishable food product, we cannot accept returns for reasons of taste preference.\n\nDelivery delays\nIf a courier delay makes the product unfit for consumption, we will replace or refund the order in full.\n\nContact\nhello@maaikathekuaa.com • +91 98765 43210']
    ];
    pages.forEach((p) => db.run('INSERT INTO pages(slug, title, body) VALUES(?,?,?)', p));
  }

  /* ---------------- demo customer, reviews, orders ---------------- */
  if (config.SEED_DEMO && count('users') === 0) {
    const salt = auth.makeSalt();
    db.run('INSERT INTO users(name, email, phone, password_hash, salt, address, city, state, pincode) VALUES(?,?,?,?,?,?,?,?,?)',
      ['Anjali Kumari', 'anjali@example.com', '9123456780', auth.hashPassword('demo123', salt), salt,
        'B-24, Ganga Apartment, Boring Road', 'Patna', 'Bihar', '800001']);
  }

  if (config.SEED_DEMO && count('reviews') === 0) {
    const prods = db.all('SELECT id, name FROM products ORDER BY id LIMIT 6');
    const demo = [
      ['Anjali Kumari', 5, 'Bilkul maa ke haath jaisa', 'Order karte hi ghar ki yaad aa gayi. Packing bahut acchi thi aur thekua ekdum fresh tha. Chhath ke liye dobara order karungi.'],
      ['Rakesh Singh', 5, 'Best thekua I have ordered online', 'Crisp, not too sweet and the ghee aroma is real. Reached Mumbai in 3 days, nothing broken.'],
      ['Priya Sharma', 4, 'Delicious, want a bigger pack', 'Dry fruit thekua was the favourite at home. Only wish the 1kg pack was available all year.'],
      ['Manoj Verma', 5, 'Gift box was a hit', 'Gifted the assorted box to my in-laws for Diwali. Everyone asked where I bought it from.'],
      ['Sunita Devi', 5, 'Ghar jaisa swad', 'Til kut aur thekua dono ekdum authentic. Bahut dino baad aisa swad mila.'],
      ['Amit Ranjan', 4, 'Fresh and well packed', 'Timely delivery and the taste is genuinely homemade. Slightly premium pricing but worth it.']
    ];
    demo.forEach((d, i) => {
      const p = prods[i % prods.length];
      db.run("INSERT INTO reviews(product_id, name, rating, title, comment, status, featured) VALUES(?,?,?,?,?,'approved',?)",
        [p.id, d[0], d[1], d[2], d[3], i < 4 ? 1 : 0]);
    });
  }

  if (config.SEED_DEMO && count('orders') === 0) {
    const user = db.get('SELECT * FROM users LIMIT 1');
    const prods = db.all('SELECT * FROM products ORDER BY id LIMIT 3');
    if (user && prods.length) {
      const samples = [
        { status: 'Delivered', pay: 'Paid', days: 9 },
        { status: 'Out for Delivery', pay: 'COD', days: 2 },
        { status: 'Pending', pay: 'Pending', days: 0 }
      ];
      samples.forEach((s, idx) => {
        const code = 'MKT' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + (1001 + idx);
        const p = prods[idx % prods.length];
        const unit = p.discount_price > 0 ? p.discount_price : p.price;
        const qty = idx + 1;
        const subtotal = unit * qty;
        const delivery = subtotal >= 999 ? 0 : 49;
        const r = db.run(`INSERT INTO orders(order_code,user_id,customer_name,phone,email,address,city,state,pincode,subtotal,discount,delivery_charge,tax,total,payment_method,payment_status,status,created_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','-' || ? || ' day'))`,
          [code, user.id, user.name, user.phone, user.email, user.address, user.city, user.state, user.pincode,
            subtotal, 0, delivery, 0, subtotal + delivery, idx === 0 ? 'online' : 'cod', s.pay, s.status, s.days]);
        const img = db.get('SELECT url FROM product_images WHERE product_id = ? LIMIT 1', [p.id]);
        db.run('INSERT INTO order_items(order_id, product_id, name, image, weight, price, qty, line_total) VALUES(?,?,?,?,?,?,?,?)',
          [r.lastId, p.id, p.name, img ? img.url : '', p.weight, unit, qty, subtotal]);
      });
    }
  }

  db.save();
}

if (require.main === module) {
  (async () => {
    await db.init();
    if (process.argv.includes('--force')) {
      const tables = ['order_items', 'orders', 'reviews', 'product_images', 'products', 'categories', 'coupons',
        'banners', 'nav_items', 'home_sections', 'story_sections', 'cards', 'pages', 'settings',
        'inventory_log', 'contact_messages', 'sessions', 'users', 'admins'];
      tables.forEach((t) => db.run(`DELETE FROM ${t}`));
      console.log('Cleared existing data.');
    }
    ensureSeed();
    console.log('Seed complete. Admin login:', config.ADMIN_EMAIL, '/', config.ADMIN_PASSWORD);
    process.exit(0);
  })();
}

module.exports = { ensureSeed };
