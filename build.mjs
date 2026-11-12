// Bangun situs statis: content/site.json + public/ → dist/ (tanpa dependensi).
//   node build.mjs            → dist/index.html, 404.html, robots.txt, sitemap.xml, + salinan public/
// Dipakai juga oleh CMS lokal (cms/server.mjs) untuk pratinjau & sebelum publikasi.
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupiah = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** 0812… / +62 812… → 62812… */
export const waNumber = s => { const d = String(s || '').replace(/\D/g, ''); return d.startsWith('0') ? '62' + d.slice(1) : d; };
const waLink = (num, text) => `https://wa.me/${waNumber(num)}${text ? '?text=' + encodeURIComponent(text) : ''}`;
const mapsLink = o => o.maps || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(['KEBABDOTCOM', o.name, o.address, o.city].filter(Boolean).join(' '));

const ICON = {
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.6 3c.4 2.3 1.9 3.9 4.1 4.1v3.2c-1.5.1-2.9-.4-4.1-1.2v6.2c0 3.6-2.6 5.9-5.8 5.9-3.1 0-5.7-2.4-5.7-5.6 0-3.6 3.2-6.1 6.8-5.5v3.3c-1.6-.4-3.4.6-3.4 2.3 0 1.3 1 2.3 2.3 2.3 1.4 0 2.4-.9 2.4-2.6V3h3.4z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.6 1.1 2.8.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.4-.3z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>'
};

export function render(c) {
    const S = c.site, year = new Date().getFullYear();
    const wa = S.whatsapp ? waNumber(S.whatsapp) : '';
    const socials = [['instagram', 'Instagram', c.social?.instagram], ['tiktok', 'TikTok', c.social?.tiktok]].filter(x => x[2]);
    const items = c.menu.items || [];
    const cats = [...new Set(items.map(m => m.category).filter(Boolean))];
    const outlets = c.outlets.items || [];
    const fr = c.franchise || {};
    const frHref = wa ? waLink(wa, fr.whatsapp_message) : (S.email ? `mailto:${S.email}` : c.social?.instagram || '#');

    const menuCards = items.map(m => `
        <article class="dish" data-cat="${esc(slug(m.category))}">
          <div class="dish-img">${m.image ? `<img src="${esc(m.image)}" alt="${esc(m.name)}" loading="lazy" decoding="async" width="300" height="300">` : ''}${m.badge ? `<span class="badge">${esc(m.badge)}</span>` : ''}</div>
          <div class="dish-body">
            <div class="dish-top"><h3>${esc(m.name)}</h3>${c.menu.show_prices && m.price ? `<span class="price">${rupiah(m.price)}</span>` : ''}</div>
            ${m.description ? `<p>${esc(m.description)}</p>` : ''}
          </div>
        </article>`).join('');

    const outletCards = outlets.map(o => `
        <a class="outlet" href="${esc(mapsLink(o))}" target="_blank" rel="noopener">
          <span class="outlet-pin">${ICON.pin}</span>
          <span class="outlet-text"><strong>${esc(o.name)}</strong><span>${esc([o.address, o.city].filter(Boolean).join(', '))}</span>${o.hours ? `<em>${esc(o.hours)}</em>` : ''}</span>
          <span class="outlet-go">${ICON.arrow}</span>
        </a>`).join('');

    const ld = { '@context': 'https://schema.org', '@type': 'Restaurant', name: S.name, slogan: S.tagline, url: S.url, logo: S.url + S.logo, image: S.url + S.og_image,
        servesCuisine: 'Kebab', sameAs: socials.map(s => s[2]), ...(wa ? { telephone: '+' + wa } : {}) };

    return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(S.seo_title || S.name)}</title>
<meta name="description" content="${esc(S.seo_description)}">
<link rel="canonical" href="${esc(S.url)}/">
<meta name="theme-color" content="#161412">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(S.seo_title || S.name)}">
<meta property="og:description" content="${esc(S.seo_description)}">
<meta property="og:url" content="${esc(S.url)}/">
<meta property="og:image" content="${esc(S.url + S.og_image)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<header class="nav" id="top">
  <div class="wrap nav-in">
    <a class="brand" href="#top"><img src="${esc(S.logo)}" alt="" width="40" height="40"><span>${esc(S.name)}</span></a>
    <nav class="links" aria-label="Navigasi">
      <a href="#menu">Menu</a><a href="#outlet">Outlet</a>${fr.enabled ? '<a href="#franchise">Franchise</a>' : ''}<a href="#sosmed">Sosmed</a>
    </nav>
    <div class="nav-social">${socials.map(([k, n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="${n}">${ICON[k]}</a>`).join('')}</div>
  </div>
</header>

<main>
<section class="hero">
  <div class="wrap hero-in">
    <div class="hero-copy">
      ${c.hero.eyebrow ? `<p class="eyebrow">${esc(c.hero.eyebrow)}</p>` : ''}
      <h1>${esc(c.hero.title)}</h1>
      <p class="lead">${esc(c.hero.subtitle)}</p>
      <div class="cta">
        <a class="btn btn-y" href="#menu">${esc(c.hero.cta_primary || 'Lihat Menu')} ${ICON.arrow}</a>
        <a class="btn btn-ghost" href="#outlet">${esc(c.hero.cta_secondary || 'Cari Outlet')}</a>
      </div>
    </div>
    <div class="hero-art" aria-hidden="true">
      ${(c.hero.images || []).slice(0, 3).map((src, i) => `<img class="p${i}" src="${esc(src)}" alt="" width="300" height="300"${i ? ' loading="lazy"' : ''}>`).join('')}
      <img class="hero-logo" src="${esc(S.logo)}" alt="" width="120" height="120">
    </div>
  </div>
  <div class="ticker" aria-hidden="true"><div>${Array(8).fill(`<span>${esc(S.tagline)}</span><b>✦</b>`).join('')}</div></div>
</section>

${(c.about?.points || []).length ? `<section class="about wrap">
  <h2>${esc(c.about.title)}</h2>
  <div class="points">${c.about.points.map((p, i) => `<div class="point"><span class="num">0${i + 1}</span><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div>`).join('')}</div>
</section>` : ''}

<section class="menu wrap" id="menu">
  <div class="sec-head"><h2>${esc(c.menu.title)}</h2>${c.menu.subtitle ? `<p>${esc(c.menu.subtitle)}</p>` : ''}</div>
  ${cats.length > 1 ? `<div class="chips" role="tablist"><button class="chip on" data-f="all">Semua</button>${cats.map(k => `<button class="chip" data-f="${esc(slug(k))}">${esc(k)}</button>`).join('')}</div>` : ''}
  <div class="dishes">${menuCards}</div>
</section>

<section class="outlets" id="outlet">
  <div class="wrap">
    <div class="sec-head"><h2>${esc(c.outlets.title)}</h2>${c.outlets.subtitle ? `<p>${esc(c.outlets.subtitle)}</p>` : ''}</div>
    <div class="outlet-grid">${outletCards}</div>
  </div>
</section>

${fr.enabled ? `<section class="franchise" id="franchise">
  <div class="wrap fr-in">
    <div>
      <h2>${esc(fr.title)}</h2>
      <p>${esc(fr.text)}</p>
      <a class="btn btn-y" href="${esc(frHref)}" target="_blank" rel="noopener">${wa ? ICON.whatsapp : ''} ${esc(fr.cta || 'Hubungi Kami')}</a>
    </div>
    <ul>${(fr.points || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
  </div>
</section>` : ''}

<section class="social wrap" id="sosmed">
  <div class="sec-head"><h2>Ikuti kami</h2><p>Promo, menu baru, dan keseruan outlet setiap hari.</p></div>
  <div class="social-grid">${socials.map(([k, n, u]) => `<a class="soc soc-${k}" href="${esc(u)}" target="_blank" rel="noopener">${ICON[k]}<span><strong>${n}</strong><em>${esc(u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</em></span>${ICON.arrow}</a>`).join('')}</div>
</section>
</main>

<footer class="foot">
  <div class="wrap foot-in">
    <div class="brand"><img src="${esc(S.logo)}" alt="" width="36" height="36"><span>${esc(S.name)}</span></div>
    <p>${esc((c.footer?.text || '').replace('{tahun}', year))}</p>
    <div class="foot-links">${S.email ? `<a href="mailto:${esc(S.email)}">${esc(S.email)}</a>` : ''}${S.pos_url ? `<a href="${esc(S.pos_url)}">Login mitra</a>` : ''}</div>
  </div>
</footer>
${wa ? `<a class="wa-float" href="${esc(waLink(wa, 'Halo KEBABDOTCOM'))}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICON.whatsapp}</a>` : ''}
<script>
document.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===b));const f=b.dataset.f;document.querySelectorAll('.dish').forEach(d=>d.hidden=f!=='all'&&d.dataset.cat!==f);}));
</script>
</body>
</html>
`;
}

export function build() {
    const c = JSON.parse(readFileSync(join(ROOT, 'content/site.json'), 'utf8'));
    for (const k of ['site', 'hero', 'menu', 'outlets']) if (!c[k]) throw new Error(`content/site.json: bagian "${k}" tidak ada`);
    for (const m of c.menu.items || []) if (m.image && !existsSync(join(ROOT, 'public', m.image))) throw new Error(`Foto tidak ditemukan: public${m.image} (menu ${m.name})`);
    rmSync(DIST, { recursive: true, force: true });
    mkdirSync(DIST, { recursive: true });
    cpSync(join(ROOT, 'public'), DIST, { recursive: true });
    writeFileSync(join(DIST, 'index.html'), render(c));
    writeFileSync(join(DIST, '404.html'), `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Halaman tidak ditemukan — ${esc(c.site.name)}</title><link rel="stylesheet" href="/style.css"><body class="notfound"><main><img src="${esc(c.site.logo)}" alt="" width="96" height="96"><h1>Halaman tidak ditemukan</h1><a class="btn btn-y" href="/">Kembali ke beranda</a></main></body></html>`);
    writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${c.site.url}/sitemap.xml\n`);
    writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(c.site.url)}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url></urlset>\n`);
    return c;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    try { const c = build(); console.log(`dist/ siap: ${c.menu.items.length} menu, ${c.outlets.items.length} outlet`); }
    catch (e) { console.error('✖ ' + e.message); process.exit(1); }
}
