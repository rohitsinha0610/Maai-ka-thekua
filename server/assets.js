'use strict';
/**
 * Generates the placeholder artwork (logo, favicon, hero, product and story
 * images) as SVG files inside public/uploads on first run.
 * The shop owner can replace every one of these from the Admin Panel.
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

const DIR = config.UPLOAD_DIR;

function write(name, svg) {
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, svg.trim());
  return '/uploads/' + name;
}

/* ---------------- shared decorative pieces ---------------- */

function rangoli(cx, cy, r, color, opacity = 0.18) {
  let petals = '';
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI * 2) / 16;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    petals += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(r * 0.22).toFixed(1)}" ry="${(r * 0.1).toFixed(1)}" transform="rotate(${(a * 180) / Math.PI} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${color}" opacity="${opacity}"/>`;
  }
  return petals;
}

/** A traditional thekua cookie: fluted disc with a moulded pattern. */
function thekua(cx, cy, r, base, dark, light, seed = 1) {
  let flutes = '';
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    flutes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.11).toFixed(1)}" fill="${base}"/>`;
  }
  let grid = '';
  for (let i = -3; i <= 3; i++) {
    grid += `<line x1="${cx - r * 0.72}" y1="${cy + i * r * 0.2}" x2="${cx + r * 0.72}" y2="${cy + i * r * 0.2}" stroke="${dark}" stroke-width="${r * 0.045}" opacity="0.55" stroke-linecap="round"/>`;
    grid += `<line x1="${cx + i * r * 0.2}" y1="${cy - r * 0.72}" x2="${cx + i * r * 0.2}" y2="${cy + r * 0.72}" stroke="${dark}" stroke-width="${r * 0.045}" opacity="0.35" stroke-linecap="round"/>`;
  }
  let specks = '';
  let s = seed * 9301;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * r * 0.8;
    specks += `<circle cx="${(cx + Math.cos(a) * rr).toFixed(1)}" cy="${(cy + Math.sin(a) * rr).toFixed(1)}" r="${(r * (0.02 + rnd() * 0.035)).toFixed(1)}" fill="${dark}" opacity="0.5"/>`;
  }
  return `
    <g>
      ${flutes}
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${base}"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.86}" fill="${light}" opacity="0.35"/>
      <clipPath id="clip${Math.round(cx)}${Math.round(cy)}"><circle cx="${cx}" cy="${cy}" r="${r * 0.8}"/></clipPath>
      <g clip-path="url(#clip${Math.round(cx)}${Math.round(cy)})">${grid}</g>
      ${specks}
      <circle cx="${cx - r * 0.28}" cy="${cy - r * 0.3}" r="${r * 0.2}" fill="#ffffff" opacity="0.14"/>
    </g>`;
}

/* ---------------- generators ---------------- */

function logoSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 130" width="520" height="130">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#E8892B"/><stop offset="100%" stop-color="#B23A18"/>
    </linearGradient>
  </defs>
  <g transform="translate(8,10)">
    <circle cx="55" cy="55" r="53" fill="none" stroke="url(#g)" stroke-width="3"/>
    <circle cx="55" cy="55" r="47" fill="none" stroke="#7B3F00" stroke-width="1.5" stroke-dasharray="4 5"/>
    ${thekua(55, 55, 34, '#C9772F', '#7B3F00', '#F0B268', 3)}
  </g>
  <g font-family="Georgia, 'Times New Roman', serif">
    <text x="132" y="58" font-size="40" font-weight="700" fill="#4A2412" letter-spacing="0.5">Maai Ka</text>
    <text x="132" y="100" font-size="40" font-weight="700" fill="#C9531B" letter-spacing="0.5">Thekuaa</text>
  </g>
  <text x="134" y="120" font-family="Georgia, serif" font-size="13" fill="#8A6247" letter-spacing="3">पारंपरिक • शुद्ध • घर जैसा</text>
</svg>`;
}

function faviconSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="14" fill="#FFF7EA"/>
  ${thekua(32, 32, 22, '#C9772F', '#7B3F00', '#F0B268', 5)}
</svg>`;
}

function heroSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 760" width="900" height="760">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="72%">
      <stop offset="0%" stop-color="#FFF3DF"/><stop offset="100%" stop-color="#F3DFC0"/>
    </radialGradient>
  </defs>
  <rect width="900" height="760" fill="url(#bg)"/>
  ${rangoli(450, 360, 300, '#C9531B', 0.10)}
  ${rangoli(450, 360, 235, '#7B3F00', 0.09)}
  <ellipse cx="450" cy="595" rx="290" ry="42" fill="#C9772F" opacity="0.16"/>
  <!-- brass plate -->
  <ellipse cx="450" cy="430" rx="290" ry="205" fill="#E7A64B" opacity="0.35"/>
  <ellipse cx="450" cy="424" rx="268" ry="188" fill="#F6D9A8"/>
  <ellipse cx="450" cy="424" rx="238" ry="164" fill="none" stroke="#C9772F" stroke-width="3" stroke-dasharray="7 8" opacity="0.6"/>
  ${thekua(450, 385, 108, '#C0692A', '#6E3805', '#EFB268', 1)}
  ${thekua(300, 470, 86, '#CB7C34', '#7B3F00', '#F2BC79', 2)}
  ${thekua(602, 470, 86, '#B5601F', '#63340A', '#E7A960', 4)}
  ${thekua(378, 300, 62, '#D08A46', '#8A4A11', '#F6C98A', 6)}
  ${thekua(528, 300, 62, '#C67A34', '#7B3F00', '#F0BC7C', 7)}
  <g opacity="0.9">
    <circle cx="180" cy="180" r="7" fill="#C9531B" opacity="0.5"/>
    <circle cx="720" cy="210" r="9" fill="#E8892B" opacity="0.45"/>
    <circle cx="762" cy="600" r="6" fill="#7B3F00" opacity="0.4"/>
    <circle cx="150" cy="620" r="8" fill="#C9531B" opacity="0.35"/>
  </g>
</svg>`;
}

function productSvg(opts) {
  const { base = '#C0692A', dark = '#6E3805', light = '#EFB268', bg1 = '#FFF6E8', bg2 = '#F6E4C8', label = '', accent = '#C9531B', extras = '' } = opts;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs><linearGradient id="pb" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="600" height="600" fill="url(#pb)"/>
  ${rangoli(300, 300, 215, accent, 0.10)}
  <circle cx="300" cy="300" r="196" fill="#ffffff" opacity="0.45"/>
  <circle cx="300" cy="300" r="196" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="6 7" opacity="0.45"/>
  <ellipse cx="300" cy="440" rx="180" ry="30" fill="${dark}" opacity="0.10"/>
  ${thekua(232, 330, 84, base, dark, light, 11)}
  ${thekua(372, 330, 84, base, dark, light, 12)}
  ${thekua(300, 232, 96, base, dark, light, 13)}
  ${extras}
  ${label ? `<text x="300" y="545" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#6E3805" opacity="0.85">${label}</text>` : ''}
</svg>`;
}

function storySvg(title, tint) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" width="800" height="560">
  <rect width="800" height="560" fill="${tint}"/>
  ${rangoli(400, 280, 230, '#7B3F00', 0.09)}
  <rect x="40" y="40" width="720" height="480" rx="18" fill="none" stroke="#C9772F" stroke-width="3" stroke-dasharray="10 8" opacity="0.5"/>
  <!-- chulha / kadhai scene -->
  <path d="M250 380 h300 a20 20 0 0 1 -20 60 h-260 a20 20 0 0 1 -20 -60 z" fill="#8A5A2B"/>
  <ellipse cx="400" cy="378" rx="152" ry="34" fill="#A9713A"/>
  <ellipse cx="400" cy="372" rx="140" ry="28" fill="#E7A64B" opacity="0.75"/>
  ${thekua(345, 366, 34, '#C0692A', '#6E3805', '#EFB268', 21)}
  ${thekua(415, 372, 34, '#CB7C34', '#7B3F00', '#F2BC79', 22)}
  ${thekua(468, 362, 28, '#B5601F', '#63340A', '#E7A960', 23)}
  <g opacity="0.55" stroke="#C9531B" stroke-width="5" fill="none" stroke-linecap="round">
    <path d="M340 320 c-16 -26 12 -40 -4 -66"/>
    <path d="M400 312 c-16 -26 12 -40 -4 -66"/>
    <path d="M460 322 c-16 -26 12 -40 -4 -66"/>
  </g>
  <text x="400" y="500" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#5A3218">${title}</text>
</svg>`;
}

function founderSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 700" width="700" height="700">
  <rect width="700" height="700" fill="#FBEBD3"/>
  ${rangoli(350, 350, 300, '#C9531B', 0.08)}
  <circle cx="350" cy="350" r="250" fill="#FFF6E8"/>
  <circle cx="350" cy="350" r="250" fill="none" stroke="#C9772F" stroke-width="4" stroke-dasharray="9 9" opacity="0.6"/>
  <!-- silhouette of maa with a plate -->
  <path d="M350 195 a58 58 0 1 1 -0.1 0z" fill="#8A5A2B"/>
  <path d="M350 190 a62 62 0 0 1 62 62 v6 a62 62 0 0 1 -124 0 v-6 a62 62 0 0 1 62 -62z" fill="#C9531B" opacity="0.25"/>
  <path d="M232 500 c0 -76 53 -132 118 -132 s118 56 118 132 z" fill="#B23A18" opacity="0.85"/>
  <path d="M258 500 c0 -62 41 -108 92 -108 s92 46 92 108 z" fill="#E8892B" opacity="0.55"/>
  <ellipse cx="350" cy="495" rx="118" ry="20" fill="#E7A64B"/>
  ${thekua(312, 488, 26, '#C0692A', '#6E3805', '#EFB268', 31)}
  ${thekua(368, 492, 26, '#CB7C34', '#7B3F00', '#F2BC79', 32)}
  <text x="350" y="620" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#5A3218">माँ के हाथों का स्वाद</text>
</svg>`;
}

function categorySvg(label, base, dark, light, bg) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 380" width="500" height="380">
  <rect width="500" height="380" fill="${bg}"/>
  ${rangoli(250, 190, 165, dark, 0.09)}
  ${thekua(250, 168, 84, base, dark, light, 41)}
  ${thekua(160, 220, 52, base, dark, light, 42)}
  ${thekua(340, 220, 52, base, dark, light, 43)}
  <text x="250" y="330" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="${dark}">${label}</text>
</svg>`;
}

function bannerSvg(text, sub, c1, c2) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 420" width="1400" height="420">
  <defs><linearGradient id="bn" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
  <rect width="1400" height="420" fill="url(#bn)"/>
  ${rangoli(1180, 210, 190, '#FFFFFF', 0.14)}
  ${thekua(1180, 210, 96, '#E9A75A', '#8A4A11', '#F7D3A0', 51)}
  ${thekua(1040, 300, 56, '#DE9848', '#7B3F00', '#F5C88F', 52)}
  <text x="90" y="190" font-family="Georgia, serif" font-size="60" font-weight="700" fill="#FFF6E8">${text}</text>
  <text x="92" y="248" font-family="Georgia, serif" font-size="27" fill="#FFE8C8">${sub}</text>
  <rect x="90" y="290" width="230" height="58" rx="29" fill="#FFF6E8"/>
  <text x="205" y="327" text-anchor="middle" font-family="Georgia, serif" font-size="23" fill="#B23A18">Order Now</text>
</svg>`;
}

function placeholderSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="#F6E4C8"/>
  ${thekua(300, 280, 120, '#C9772F', '#7B3F00', '#F0B268', 61)}
  <text x="300" y="470" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#7B3F00">Maai Ka Thekuaa</text>
</svg>`;
}

function galleryTile(i, base, dark, light, bg) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" width="420" height="420">
  <rect width="420" height="420" fill="${bg}"/>
  ${rangoli(210, 210, 150, dark, 0.10)}
  ${thekua(210, 200, 96, base, dark, light, 70 + i)}
</svg>`;
}

/** Creates every asset file and returns a map of paths. */
function ensureAssets() {
  const A = {};
  A.logo = write('logo.svg', logoSvg());
  A.favicon = write('favicon.svg', faviconSvg());
  A.hero = write('hero-thekua.svg', heroSvg());
  A.placeholder = write('placeholder.svg', placeholderSvg());
  A.founder = write('story-founder.svg', founderSvg());
  A.story1 = write('story-kitchen.svg', storySvg('घर की रसोई से', '#FDF1DD'));
  A.story2 = write('story-festival.svg', storySvg('त्योहारों का स्वाद', '#FBE7CE'));
  A.story3 = write('story-today.svg', storySvg('आज हर घर तक', '#FCEEDA'));

  A.cat = {
    thekua: write('cat-thekua.svg', categorySvg('Thekua', '#C0692A', '#6E3805', '#EFB268', '#FFF3DF')),
    sweets: write('cat-sweets.svg', categorySvg('Traditional Sweets', '#D4913F', '#8A4A11', '#F7D3A0', '#FDF0DB')),
    special: write('cat-special.svg', categorySvg('Special Collection', '#B5601F', '#63340A', '#E7A960', '#FBE9D0')),
    gift: write('cat-gift.svg', categorySvg('Gift Packs', '#C9531B', '#6E2B08', '#F0A570', '#FCEEDD')),
    festival: write('cat-festival.svg', categorySvg('Festival Specials', '#DFA24C', '#8A5A2B', '#F8DCAE', '#FFF5E4'))
  };

  A.products = {
    gur: write('p-gur-thekua.svg', productSvg({ base: '#9E5518', dark: '#5A2E05', light: '#D9924A', bg1: '#FFF3DF', bg2: '#F1DCB8', label: 'Gur Thekua', accent: '#8A4A11' })),
    ghee: write('p-ghee-thekua.svg', productSvg({ base: '#D69A4C', dark: '#8A5A2B', light: '#F8DCAE', bg1: '#FFF8EC', bg2: '#F7E6C8', label: 'Desi Ghee Thekua', accent: '#C9772F' })),
    coconut: write('p-coconut-thekua.svg', productSvg({ base: '#C98F49', dark: '#7B4E19', light: '#F6DCA9', bg1: '#FFFAF0', bg2: '#F3E7D0', label: 'Coconut Thekua', accent: '#B98A3F' })),
    dryfruit: write('p-dryfruit-thekua.svg', productSvg({ base: '#B4702C', dark: '#6A3B08', light: '#EBB878', bg1: '#FFF4E2', bg2: '#F2DEBB', label: 'Dry Fruit Thekua', accent: '#8A4A11' })),
    festival: write('p-festival-thekua.svg', productSvg({ base: '#C0692A', dark: '#6E3805', light: '#EFB268', bg1: '#FFF0D8', bg2: '#F6DCB4', label: 'Festival Special', accent: '#C9531B' })),
    giftbox: write('p-gift-box.svg', productSvg({
      base: '#C97F35', dark: '#7B3F00', light: '#F2C68A', bg1: '#FFF2DC', bg2: '#F3DDB6', label: 'Thekua Gift Box', accent: '#B23A18',
      extras: `<rect x="150" y="196" width="300" height="212" rx="16" fill="none" stroke="#B23A18" stroke-width="7" opacity="0.75"/>
               <line x1="300" y1="196" x2="300" y2="408" stroke="#B23A18" stroke-width="7" opacity="0.55"/>
               <path d="M300 196 c-40 -46 -96 -20 -60 14 M300 196 c40 -46 96 -20 60 14" fill="none" stroke="#B23A18" stroke-width="7" opacity="0.75"/>`
    })),
    tilkut: write('p-tilkut.svg', productSvg({ base: '#D9B276', dark: '#8A6B34', light: '#F6E3BC', bg1: '#FFFBF1', bg2: '#F3EAD5', label: 'Til Kut', accent: '#A98A45' })),
    laddu: write('p-laddu.svg', productSvg({
      base: '#D98A2B', dark: '#8A4A11', light: '#F7C878', bg1: '#FFF6E4', bg2: '#F6E2BC', label: 'Besan Laddu', accent: '#C9772F',
      extras: '<circle cx="300" cy="300" r="6" fill="#B23A18" opacity="0.4"/>'
    })),
    khaja: write('p-khaja.svg', productSvg({ base: '#DCA45E', dark: '#8A5A2B', light: '#F8DFB4', bg1: '#FFF7E9', bg2: '#F5E5C6', label: 'Khaja', accent: '#C08A45' })),
    anarsa: write('p-anarsa.svg', productSvg({ base: '#B9793A', dark: '#6E4210', light: '#EEC58C', bg1: '#FFF4E4', bg2: '#F2E0BE', label: 'Anarsa', accent: '#A8661F' }))
  };

  A.banners = [
    write('banner-festival.svg', bannerSvg('Festival Special Thekua', 'Chhath • Diwali • Holi — ghar jaisa swad', '#B23A18', '#E8892B')),
    write('banner-freeship.svg', bannerSvg('Free Delivery above ₹999', 'Fresh batch, packed the same day', '#7B3F00', '#C9772F'))
  ];

  A.gallery = [
    write('g1.svg', galleryTile(1, '#C0692A', '#6E3805', '#EFB268', '#FFF3DF')),
    write('g2.svg', galleryTile(2, '#D4913F', '#8A4A11', '#F7D3A0', '#FBE9D0')),
    write('g3.svg', galleryTile(3, '#B5601F', '#63340A', '#E7A960', '#FDF1DD')),
    write('g4.svg', galleryTile(4, '#DFA24C', '#8A5A2B', '#F8DCAE', '#FFF6E8')),
    write('g5.svg', galleryTile(5, '#C9531B', '#6E2B08', '#F0A570', '#FCEEDD')),
    write('g6.svg', galleryTile(6, '#C98F49', '#7B4E19', '#F6DCA9', '#F9EAD3'))
  ];

  return A;
}

module.exports = { ensureAssets };
