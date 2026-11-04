// Renders every page of the site from photos.json, categories.json and site.json:
//   index.html, <category>/index.html, <category>/<piece>/index.html, 404.html, sitemap.xml, robots.txt
// and the web copies of each photo in derived/ (small WebP sizes and a round "dot" crop).
// Links are relative, so the same files work at pranjalagg.github.io/artellum-gallery/ and artellum.github.io/.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, rmdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { orderCategories } from "./names.mjs";
import { interleave } from "../route.js";

// Top-level folders the site itself uses: a category can never be called one of these.
const RESERVED = new Set(["img", "derived", "fonts", "js", "vendor", "scripts", "tests", "docs", "qr", "node_modules", "originals"]);
const WEB_WIDTHS = [480, 960];
const WEB_QUALITY = { 480: 70, 960: 62 }; // the brocade behind the tea lights is costly to encode; 62 still reads it

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const hex = ({ r, g, b }) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const fmt = (n) => n.toLocaleString("en-GB");

async function newer(source, output) {
  if (!existsSync(output)) return true;
  return (await stat(source)).mtimeMs > (await stat(output)).mtimeMs;
}

// derived/<slug>/<name>-480.webp, -960.webp and -dot.webp for one photo, plus its dot colour.
async function derive(root, image, made) {
  const name = image.large.replace(/^img\//, "").replace(/-l\.jpg$/, "");
  const files = {
    w480: `derived/${name}-480.webp`,
    w960: `derived/${name}-960.webp`,
    avif: `derived/${name}-960.avif`, // the large photo on a piece's page: half the bytes of the WebP
    dot: `derived/${name}-dot.webp`,
  };
  const large = path.join(root, image.large);
  await mkdir(path.dirname(path.join(root, files.dot)), { recursive: true });
  for (const width of WEB_WIDTHS) {
    const out = path.join(root, files[`w${width}`]);
    made.add(files[`w${width}`]);
    if (await newer(large, out)) {
      await sharp(large).resize({ width, withoutEnlargement: true }).webp({ quality: WEB_QUALITY[width], effort: 6, smartSubsample: true }).toFile(out);
    }
  }
  const avifOut = path.join(root, files.avif);
  made.add(files.avif);
  if (await newer(large, avifOut)) {
    await sharp(large).resize({ width: 960, withoutEnlargement: true }).avif({ quality: 48, effort: 4 }).toFile(avifOut);
  }
  // The dot is the middle of the photo, where the piece sits: the colour's swatch when there is one.
  const dotOut = path.join(root, files.dot);
  made.add(files.dot);
  const source = path.join(root, image.swatch ?? image.thumb);
  if (await newer(source, dotOut)) {
    let crop = sharp(source);
    if (!image.swatch) {
      const { width, height } = await sharp(source).metadata();
      const side = Math.round(Math.min(width, height) / 1.6);
      crop = crop.extract({ left: Math.round((width - side) / 2), top: Math.round((height - side) / 2), width: side, height: side });
    }
    await crop.resize(96, 96).webp({ quality: 78 }).toFile(dotOut);
  }
  const { dominant } = await sharp(dotOut).stats();
  return { ...files, colour: hex(dominant) };
}

async function removeStaleDerived(root, made) {
  const dir = path.join(root, "derived");
  if (!existsSync(dir)) return;
  for (const slug of await readdir(dir, { withFileTypes: true })) {
    if (!slug.isDirectory()) continue;
    const sub = path.join(dir, slug.name);
    for (const file of await readdir(sub)) {
      if (!made.has(`derived/${slug.name}/${file}`)) await rm(path.join(sub, file));
    }
    if (!(await readdir(sub)).length) await rmdir(sub);
  }
}

function countLine(category) {
  const designs = category.photos.length;
  const colours = category.photos.reduce((sum, p) => sum + (p.variants?.length || 1), 0);
  return colours > designs ? `${plural(designs, "design")} in ${fmt(colours)} colours` : plural(designs, "piece");
}

// Everything the templates need, with the owner's overrides from site.json applied.
async function model(root, data, site, order) {
  const made = new Set();
  const slugs = orderCategories(data.categories.map((c) => c.slug), order);
  const categories = [];
  for (const slug of slugs) {
    const source = data.categories.find((c) => c.slug === slug);
    if (RESERVED.has(slug)) throw new Error(`A category cannot be called "${slug}": the site uses that folder name. Rename the folder in originals/.`);
    const category = { slug, name: source.name, line: site.categoryLines?.[slug] ?? "", photos: [] };
    for (const photo of source.photos) {
      const extra = site.pieces?.[`${slug}/${photo.id}`] ?? {};
      const variants = [];
      for (const v of photo.variants ?? []) {
        variants.push({ ...v, colour: extra.colours?.[v.id] ?? v.colour, web: await derive(root, v, made) });
      }
      const web = variants[0]?.web ?? (await derive(root, photo, made));
      category.photos.push({
        ...photo,
        slug,
        title: extra.title ?? photo.title,
        lettering: extra.lettering ?? null,
        variants,
        web,
        colours: variants.length || 1,
      });
    }
    category.count = countLine(category);
    categories.push(category);
  }
  await removeStaleDerived(root, made);
  return categories;
}

/* ---------- markup ---------- */

const pictureOf = (p, r, { sizes, eager = false, cls = "", ht = true }) => `<picture>
<source type="image/webp" srcset="${r}${p.web.w480} 480w, ${r}${p.web.w960} 960w" sizes="${sizes}">
<img${cls ? ` class="${cls}"` : ""} src="${r}${p.web.w480}" width="${p.w}" height="${p.h}" alt="${esc(p.alt)}" ${eager ? 'loading="eager"' : 'loading="lazy"'} decoding="async"${ht ? " data-ht" : ""}>
</picture>`;

const dotImg = (p, r, k = 0) => `<span class="pd" style="--c:${p.web.colour};--k:${k}"><img src="${r}${p.web.dot}" alt="" width="96" height="96" loading="lazy" decoding="async"></span>`;

const runOf = (p) =>
  p.variants.length > 1
    ? `<span class="run" aria-hidden="true">${p.variants.map((v, k) => `<i style="--c:${v.web.colour};--k:${k}"></i>`).join("")}</span>`
    : "";

function tile(p, r, eager = false, i = 0, uniform = 0) {
  const alt = p.colours > 1 ? `${p.title}, in ${p.colours} colours` : p.title;
  const meta = p.colours > 1 ? `<span class="tile__meta">${p.colours} colours</span>` : "";
  // Tiles crop to between 4:3 and about 3:4 around the middle, where the piece sits: less bare cloth.
  const ratio = uniform || Math.min(1.3, Math.max(0.75, p.h / p.w));
  return `<li class="tile" data-i="${i}" style="--ratio:${ratio.toFixed(4)};--c:${p.web.colour}">
<a class="tile__link" href="${r}${p.slug}/${p.id}/" data-drop="${p.web.colour}">
<span class="tile__frame">${pictureOf({ ...p, alt }, r, { sizes: "(min-width: 1180px) 22vw, (min-width: 760px) 30vw, 46vw", eager })}</span>
<span class="tile__cap"><span class="tile__title">${esc(p.title)}</span>${meta}</span>
${runOf(p)}
</a>
</li>`;
}

// The first row of a category is above the fold on a phone: those load first.
const wall = (pieces, r, { eager = 0, end = "" } = {}) => `<div class="wall${pieces.length <= 6 ? " wall--short" : ""}" data-wall${end ? ` data-end="${esc(end)}"` : ""}><ul class="wall__col">
${pieces.map((p, i) => tile(p, r, i < eager, i, pieces.length <= 4 ? 1.25 : 0)).join("\n")}
</ul></div>
<script>window.artellumWall&&artellumWall.lay(document.currentScript.previousElementSibling)</script>`;

function header(site, categories, r, current) {
  const link = (href, label, here, count = "") =>
    `<li><a class="nav__link" href="${href}"${here ? ` aria-current="${here}"` : ""}><span class="nav__dot" aria-hidden="true"></span><span class="nav__label">${esc(label)}</span>${count ? `<span class="nav__count" aria-hidden="true">${esc(count)}</span>` : ""}</a></li>`;
  return `<header class="top" data-top>
<a class="mark" href="${r || "./"}" aria-label="${esc(site.name)} ${esc(site.trade)}, home"><span class="mark__sign">${esc(site.name)}</span> <span class="mark__trade">${esc(site.trade)}</span></a>
<button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav" data-menu-btn><span class="menu-btn__dot" aria-hidden="true"></span><span class="menu-btn__label">Menu</span></button>
<nav class="nav" id="nav" aria-label="Main" data-nav>
<ul class="nav__list">
${categories.map((c) => link(`${r}${c.slug}/`, c.name, current.slug === c.slug ? (current.page === "category" ? "page" : "true") : null, c.count.replace(" in ", ", "))).join("\n")}
${link(`${r || "./"}#maker`, "The maker", null)}
</ul>
</nav>
</header>`;
}

function footer(site, r) {
  return `<footer class="foot">
<p class="foot__sign" aria-hidden="true">${esc(site.name)}</p>
<div class="foot__row">
<p class="foot__ig"><a class="ulink" href="${esc(site.instagram.url)}" rel="noopener">${esc(site.instagram.handle)} on Instagram</a></p>
<p class="foot__note">Photographs by the maker. Set in Eczar and Karla.</p>
<p class="foot__top"><a class="ulink" href="#top" data-to-top>Back to the top</a></p>
</div>
</footer>`;
}

function layout({ site, categories, r, page, title, description, canonical, image, imageAlt, jsonld, main, current = {}, assets, base = false, preload = "" }) {
  // Pages with a wall carry wall.js inline, so the wall is laid out while the page is parsed.
  const wallScript = main.includes("data-wall") ? `<script>${assets.wall}</script>\n` : "";
  const og = image.startsWith("http") ? image : new URL(image, site.url).href;
  // On the 404 page (served at any depth) these are written after its <base>, so nothing is fetched from the wrong folder.
  const assetTags = `<link rel="icon" href="${r}favicon.svg" type="image/svg+xml">
<link rel="icon" href="${r}favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${r}apple-touch-icon.png">
${preload}<link rel="preload" href="${r}fonts/web/eczar-500_700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${r}fonts/web/karla-400_700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${r}style.css?v=${assets.css}">
<script>(function(h){h.classList.add("js");if(!matchMedia("(prefers-reduced-motion: reduce)").matches)h.classList.add("motion");setTimeout(function(){if(!h.classList.contains("is-booted"))h.classList.remove("motion","js")},3500)})(document.documentElement)</script>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
${wallScript}<script src="${r}vendor/gsap.min.js" defer></script>
<script src="${r}vendor/lenis.min.js" defer></script>
<script type="module" src="${r}app.js?v=${assets.js}"></script>
`;
  return `<!doctype html>
<html lang="en" data-page="${page}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${canonical}">` : ""}
<meta name="robots" content="${page === "404" ? "noindex" : "index, follow"}">
<meta name="theme-color" content="#c7cbbf">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)} ${esc(site.trade)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${canonical}">` : ""}
<meta property="og:image" content="${og}">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${og}">
${base ? `<script>(function(){var p=location.pathname,r=p.indexOf("/artellum-gallery/")===0?"/artellum-gallery/":"/";document.write('<base href="'+r+'">'+${JSON.stringify(assetTags).replace(/<\//g, "<\\/")})})()</script>` : assetTags}
</head>
<body id="top">
<a class="skip" href="#main">Skip to content</a>
<div class="curtain" id="curtain" aria-hidden="true"><div class="curtain__drop"><p class="curtain__name"></p></div></div>
<div class="page" id="page">
${header(site, categories, r, current)}
<main id="main" tabindex="-1" data-main="${page}">
${main}
</main>
${footer(site, r)}
</div>
<p class="sr-only" aria-live="polite" data-announce></p>
</body>
</html>
`;
}

const org = (site) => ({ "@type": "Organization", name: `${site.name} ${site.trade}`, url: site.url, sameAs: [site.instagram.url] });
const crumbs = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
});

function homeMain(site, categories, plates) {
  const r = "";
  const first = plates[0];
  const all = interleave(categories);
  const rows = categories
    .map(
      (c) => `<li class="index__row">
<a class="index__link" href="${c.slug}/">
<span class="index__name">${esc(c.name)}</span>
<span class="index__dots" aria-hidden="true">${c.photos.map((p, k) => dotImg(p, r, k)).join("")}</span>
<span class="index__count">${esc(c.count)}</span>
</a>
</li>`,
    )
    .join("\n");
  const plateImg = first
    ? `<img class="plate__photo" src="${first.src}" alt="" width="${first.w}" height="${first.h}" loading="lazy" decoding="async" style="width:${(100 / (2 * first.r)).toFixed(2)}%;left:${(50 - first.cx * (100 / (2 * first.r))).toFixed(2)}%;top:${(50 - first.cy * (100 / (2 * first.r)) * (first.h / first.w)).toFixed(2)}%">`
    : "";
  return `<section class="hero" aria-labelledby="hero-title">
<div class="hero__text">
<h1 class="hero__title" id="hero-title" data-ht data-intro>${esc(site.hero.title)}</h1>
<p class="hero__line" data-ht data-intro data-delay="0.2">${esc(site.hero.line)}</p>
</div>
${
  first
    ? `<figure class="plate" data-plate>
<div class="plate__stage">${plateImg}<canvas class="plate__canvas" role="img" aria-label="${esc(first.title)}, redrawn in dots from its photo"></canvas></div>
<figcaption class="plate__cap">
<span class="plate__now"><span class="plate__label">On the plate</span> <a class="ulink plate__link" href="${first.href}" data-plate-link>${esc(first.title)}</a></span>
<span class="plate__count" data-plate-count>redrawn from its photo, in dots</span>
</figcaption>
<button class="btn plate__next" type="button" data-plate-next><span class="btn__fill" aria-hidden="true"></span><span class="btn__label">Paint the next one</span></button>
<script type="application/json" data-plates>${JSON.stringify(plates).replace(/</g, "\\u003c")}</script>
</figure>`
    : ""
}
</section>
<section class="collection" id="collection" aria-labelledby="collection-title">
<h2 class="sec-title" id="collection-title" data-ht>The collection</h2>
<ol class="index">
${rows}
</ol>
</section>
<section class="every" aria-labelledby="every-title">
<div class="every__head">
<h2 class="sec-title" id="every-title" data-ht>Every piece</h2>
<p class="every__line">All ${all.length} in one place, mixed together. Open any piece to see it larger, in every colour it comes in.</p>
</div>
${wall(all.map((i) => i.photo), r, { end: `That’s all ${all.length} pieces.` })}
</section>
<section class="maker" id="maker" aria-labelledby="maker-title">
<h2 class="maker__title" id="maker-title" data-ht>${esc(site.maker.title)}</h2>
<div class="maker__body">
${site.maker.body.map((p) => `<p>${esc(p)}</p>`).join("\n")}
<p>Follow along, or ask about a piece, on <a class="ulink" href="${esc(site.instagram.url)}" rel="noopener">Instagram ${esc(site.instagram.handle)}</a>.</p>
</div>
</section>`;
}

function categoryMain(c, next) {
  const r = "../";
  return `<section class="cat" aria-labelledby="cat-title">
<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a class="ulink" href="../#collection">Collection</a></li><li><span aria-current="page">${esc(c.name)}</span></li></ol></nav>
<h1 class="cat__title" id="cat-title" data-ht data-intro>${esc(c.name)}</h1>
<p class="cat__count">${esc(c.count)}</p>
${c.line ? `<p class="cat__line">${esc(c.line)}</p>` : ""}
<p class="cat__dots" aria-hidden="true">${c.photos.map((p, k) => dotImg(p, r, k)).join("")}</p>
</section>
${wall(c.photos, r, { eager: 2, end: `That’s all ${plural(c.photos.length, c.name.toLowerCase().replace(/s$/, ""), c.name.toLowerCase())}.` })}
${
  next
    ? `<a class="next" href="../${next.slug}/" data-drop="${next.photos[0].web.colour}">
<span class="next__label">Next</span>
<span class="next__name">${esc(next.name)}</span>
<span class="next__dots" aria-hidden="true">${next.photos.slice(0, 8).map((p, k) => dotImg(p, r, k)).join("")}</span>
</a>`
    : ""
}`;
}

function pieceMain(site, c, p, i) {
  const r = "../../";
  const n = c.photos.length;
  const prev = c.photos[(i - 1 + n) % n];
  const next = c.photos[(i + 1) % n];
  const shown = p.variants[0] ?? p;
  const alt = p.variants.length > 1 ? `${p.title}, ${p.variants[0].colour.toLowerCase()}` : p.title;
  const swatches =
    p.variants.length > 1
      ? `<div class="colours">
<p class="colours__now"><span class="colours__label">Colour</span> <strong data-colour-name>${esc(p.variants[0].colour)}</strong> <span class="colours__of" data-colour-of>1 of ${p.variants.length}</span></p>
<div class="swatches" role="group" aria-label="Colours of ${esc(p.title)}">
${p.variants
  .map(
    (v, k) => `<button class="sw" type="button" aria-pressed="${k === 0}" aria-label="${esc(v.colour)}" data-id="${esc(v.id)}" data-colour="${esc(v.colour)}" data-src="${r}${esc(v.thumb)}" data-w480="${r}${v.web.w480}" data-w960="${r}${v.web.w960}" data-avif="${r}${v.web.avif}" data-w="${v.w}" data-h="${v.h}" style="--c:${v.web.colour}"><img src="${r}${v.web.dot}" alt="" width="96" height="96" decoding="async"></button>`,
  )
  .join("\n")}
</div>
</div>`
      : "";
  const lettering = p.lettering
    ? `<p class="lettering"><span class="lettering__label">Lettered on it</span> <span class="lettering__text" lang="hi">${esc(p.lettering.text)}</span> <span class="lettering__reads"><i lang="hi-Latn">${esc(p.lettering.reads)}</i>${p.lettering.means ? `: ${esc(p.lettering.means)}` : ""}</span></p>`
    : "";
  return `<article class="piece" data-piece aria-labelledby="piece-title">
<div class="piece__media">
<figure class="piece__figure" style="--ratio:${(p.w / p.h).toFixed(4)}">
<picture>
<source type="image/avif" srcset="${r}${shown.web.avif} 960w" sizes="(min-width: 900px) 50vw, 100vw" data-piece-avif>
<source type="image/webp" srcset="${r}${shown.web.w480} 480w, ${r}${shown.web.w960} 960w" sizes="(min-width: 900px) 50vw, 100vw" data-piece-source>
<img class="piece__img" src="${r}${esc(shown.thumb)}" width="${shown.w}" height="${shown.h}" alt="${esc(alt)}" fetchpriority="high" decoding="async" data-ht data-intro data-piece-img>
</picture>
</figure>
</div>
<div class="piece__info">
<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a class="ulink" href="../../#collection">Collection</a></li><li><a class="ulink" href="../">${esc(c.name)}</a></li></ol></nav>
<p class="piece__count"><span class="tnum">${i + 1}</span> of <span class="tnum">${n}</span> ${esc(c.name.toLowerCase())}</p>
<h1 class="piece__title" id="piece-title" data-ht data-intro>${esc(p.title)}</h1>
${lettering}
${swatches}
<p class="piece__ask">${esc(site.askLines?.[c.slug] ?? site.askLines?.default ?? "")}</p>
<p class="piece__cta"><a class="btn" href="${esc(site.instagram.url)}" rel="noopener"><span class="btn__fill" aria-hidden="true"></span><span class="btn__label">Ask about it on Instagram</span></a></p>
<nav class="more" aria-label="All ${esc(c.name.toLowerCase())}">
<p class="more__label">All ${n} ${esc(c.name.toLowerCase())}</p>
<ul class="more__dots">
${c.photos.map((q, k) => (q === p
  ? `<li><span class="more__link" aria-current="page"><span class="sr-only">this one</span>${dotImg(q, r, k)}</span></li>`
  : `<li><a class="more__link" href="../${q.id}/" title="${esc(q.title)}"><span class="sr-only">${esc(q.title)}</span>${dotImg(q, r, k)}</a></li>`)).join("\n")}
</ul>
</nav>
${n === 2
  ? `<nav class="pager pager--one" aria-label="The other ${esc(c.name.toLowerCase().replace(/s$/, ""))}">
<a class="pager__link pager__link--next" href="../${next.id}/" rel="next" data-pager="next"><span class="pager__text"><span class="pager__dir">The other design</span><span class="pager__name">${esc(next.title)}</span></span><span class="arrow" aria-hidden="true"><span class="btn__fill"></span><svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></span></a>
</nav>`
  : `<nav class="pager" aria-label="Next and previous ${esc(c.name.toLowerCase())}">
<a class="pager__link pager__link--prev" href="../${prev.id}/" rel="prev" data-pager="prev"><span class="arrow" aria-hidden="true"><span class="btn__fill"></span><svg viewBox="0 0 24 24" width="20" height="20"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></span><span class="pager__text"><span class="pager__dir">Previous</span><span class="pager__name">${esc(prev.title)}</span></span></a>
<a class="pager__link pager__link--next" href="../${next.id}/" rel="next" data-pager="next"><span class="pager__text"><span class="pager__dir">Next</span><span class="pager__name">${esc(next.title)}</span></span><span class="arrow" aria-hidden="true"><span class="btn__fill"></span><svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></span></a>
</nav>`}
</div>
</article>`;
}

function notFoundMain() {
  return `<section class="lost" aria-labelledby="lost-title">
<div class="lost__plate" aria-hidden="true"><canvas data-blank></canvas></div>
<h1 class="lost__title" id="lost-title">This plate is still blank.</h1>
<p class="lost__line">Nothing has been painted at this address. The pieces are all on the collection page.</p>
<p><a class="btn" href="./"><span class="btn__fill" aria-hidden="true"></span><span class="btn__label">Go to the collection</span></a></p>
</section>`;
}

async function hashOf(file) {
  return createHash("sha1").update(await readFile(file)).digest("hex").slice(0, 8);
}

async function writeIfChanged(file, content) {
  if (existsSync(file) && (await readFile(file, "utf8")) === content) return;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

export async function writePages({ root = ".", out = root } = {}) {
  const data = JSON.parse(await readFile(path.join(out, "photos.json"), "utf8"));
  const site = JSON.parse(await readFile(path.join(root, "site.json"), "utf8"));
  const config = existsSync(path.join(root, "categories.json")) ? JSON.parse(await readFile(path.join(root, "categories.json"), "utf8")) : {};
  const categories = await model(out, data, site, config.order ?? []);
  const assets = {
    css: await hashOf(path.join(root, "style.css")),
    js: await hashOf(path.join(root, "app.js")),
    wall: existsSync(path.join(root, "wall.js")) ? (await readFile(path.join(root, "wall.js"), "utf8")).replace(/<\//g, "<\\/") : "",
  };
  const url = (p) => new URL(p, site.url).href;
  const written = [];
  const page = async (rel, html) => {
    await writeIfChanged(path.join(out, rel), html);
    written.push(rel);
  };

  const bySlug = new Map(categories.flatMap((c) => c.photos.map((p) => [`${c.slug}/${p.id}`, p])));
  const plateOf = (key, crop) => {
    const p = bySlug.get(key);
    const shown = p && (p.variants[0] ?? p);
    return p && { title: p.title, href: `${key}/`, src: shown.web.w960, w: shown.w, h: shown.h, cx: crop.cx, cy: crop.cy, r: crop.r, colour: p.web.colour };
  };
  let plates = (site.hero?.plates ?? []).map((pl) => plateOf(pl.piece, pl)).filter(Boolean);
  // None of the listed pieces exist any more: paint the first few pieces, from the middle of their photos.
  if (!plates.length) plates = [...bySlug.keys()].slice(0, 4).map((key) => plateOf(key, { cx: 0.5, cy: 0.5, r: 0.38 }));

  const homeTitle = `${site.name} ${site.trade}: wall pieces, tea lights, hangings painted by hand`;
  await page(
    "index.html",
    layout({
      site, categories, r: "", page: "home", title: homeTitle, description: site.description, canonical: url("./"),
      image: "og.png", imageAlt: `${site.name}: a round painted plate redrawn in dots on a sage wall`, assets,
      jsonld: { "@context": "https://schema.org", "@graph": [{ "@type": "WebSite", name: `${site.name} ${site.trade}`, url: site.url }, org(site)] },
      main: homeMain(site, categories, plates),
    }),
  );

  for (const [ci, c] of categories.entries()) {
    const next = categories[(ci + 1) % categories.length];
    const lead = c.photos[0];
    await page(
      `${c.slug}/index.html`,
      layout({
        site, categories, r: "../", page: "category", current: { page: "category", slug: c.slug },
        title: `${c.name} by ${site.name} ${site.trade} (${c.count})`,
        description: `${c.line || `${c.name} by ${site.name}.`} ${c.count[0].toUpperCase()}${c.count.slice(1)}, painted by hand by ${site.name}.`,
        canonical: url(`${c.slug}/`), image: lead.large, imageAlt: lead.title, assets,
        jsonld: { "@context": "https://schema.org", "@graph": [{ "@type": "CollectionPage", name: c.name, url: url(`${c.slug}/`), isPartOf: site.url }, crumbs([["Collection", site.url], [c.name, url(`${c.slug}/`)]])] },
        main: categoryMain(c, categories.length > 1 ? next : null),
      }),
    );
    for (const [i, p] of c.photos.entries()) {
      const colours = p.variants.length > 1 ? `, in ${p.variants.length} colours` : "";
      await page(
        `${c.slug}/${p.id}/index.html`,
        layout({
          site, categories, r: "../../", page: "piece", current: { page: "piece", slug: c.slug },
          title: `${p.title}, painted by hand by ${site.name}`,
          description: `${p.title}, painted by hand by ${site.name}${colours}. See it larger and browse the rest of the ${c.name.toLowerCase()} in the collection.`,
          canonical: url(`${c.slug}/${p.id}/`), image: (p.variants[0] ?? p).large, imageAlt: p.title, assets,
          jsonld: {
            "@context": "https://schema.org",
            "@graph": [
              { "@type": "CreativeWork", name: p.title, image: url((p.variants[0] ?? p).large), url: url(`${c.slug}/${p.id}/`), creator: org(site), genre: c.name },
              crumbs([["Collection", site.url], [c.name, url(`${c.slug}/`)], [p.title, url(`${c.slug}/${p.id}/`)]]),
            ],
          },
          main: pieceMain(site, c, p, i),
          // the photo is what a phone waits for on this page: ask for it before the fonts
          preload: `<link rel="preload" as="image" type="image/avif" imagesrcset="../../${(p.variants[0] ?? p).web.avif} 960w" imagesizes="(min-width: 900px) 50vw, 100vw" fetchpriority="high">\n`,
        }),
      );
    }
  }

  await page(
    "404.html",
    layout({
      site, categories, r: "", page: "404", base: true, title: `Not found: ${site.name} ${site.trade}`,
      description: "This page does not exist. Every piece is on the collection page.", canonical: null,
      image: "og.png", imageAlt: site.name, assets, jsonld: { "@context": "https://schema.org", ...org(site) }, main: notFoundMain(),
    }),
  );

  const urls = ["./", ...categories.flatMap((c) => [`${c.slug}/`, ...c.photos.map((p) => `${c.slug}/${p.id}/`)])];
  await page("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${url(u)}</loc></url>`).join("\n")}\n</urlset>\n`);
  await page("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${url("sitemap.xml")}\n`);

  // Pages from categories or pieces that no longer exist.
  const listFile = path.join(out, "derived", "pages.json");
  const before = existsSync(listFile) ? JSON.parse(await readFile(listFile, "utf8")) : [];
  for (const rel of before.filter((f) => !written.includes(f))) {
    const file = path.resolve(out, rel);
    if (existsSync(file)) await rm(file);
    for (let dir = path.dirname(file); dir !== path.resolve(out) && dir.startsWith(path.resolve(out)); dir = path.dirname(dir)) {
      if (existsSync(dir) && !(await readdir(dir)).length) await rmdir(dir);
      else break;
    }
  }
  await mkdir(path.join(out, "derived"), { recursive: true });
  await writeFile(listFile, JSON.stringify(written.sort(), null, 1) + "\n");
  return { pages: written.length, categories: categories.length };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const report = await writePages();
  console.log(`Pages: ${report.pages} files for ${report.categories} kinds of piece.`);
}
