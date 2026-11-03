import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { writePages } from "../scripts/pages.mjs";

const site = {
  name: "Artellum",
  trade: "handcraft",
  url: "https://example.github.io/",
  description: "A test collection.",
  instagram: { handle: "@x", url: "https://instagram.com/x" },
  hero: { title: "Painted by hand, dot by dot.", line: "A line.", plates: [{ piece: "plates/sun", cx: 0.5, cy: 0.5, r: 0.4 }] },
  maker: { title: "Hello.", body: ["One paragraph."] },
  askLines: { default: "Made to order." },
  categoryLines: { plates: "Round plates." },
  pieces: { "plates/sun": { lettering: { text: "शुभ", reads: "shubh" } }, "lights/ring": { colours: { "1-teal": "Sea" } } },
};

async function image(root, rel, w, h, background) {
  await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await sharp({ create: { width: w, height: h, channels: 3, background } }).jpeg().toFile(path.join(root, rel));
}

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "pages-"));
  const photo = async (slug, name, w, h, colour) => {
    await image(root, `img/${slug}/${name}-l.jpg`, w * 2, h * 2, colour);
    await image(root, `img/${slug}/${name}-t.jpg`, w, h, colour);
    return { thumb: `img/${slug}/${name}-t.jpg`, large: `img/${slug}/${name}-l.jpg`, w, h, frame: "#333333" };
  };
  const sun = await photo("plates", "sun", 300, 400, "#c0392b");
  const moon = await photo("plates", "moon", 300, 300, "#2c3e50");
  const teal = await photo("lights", "ring--1-teal", 300, 400, "#16a085");
  const red = await photo("lights", "ring--2-red", 300, 400, "#e74c3c");
  await image(root, "img/lights/ring--1-teal-s.jpg", 120, 120, "#16a085");
  await image(root, "img/lights/ring--2-red-s.jpg", 120, 120, "#e74c3c");
  const manifest = {
    categories: [
      { slug: "lights", name: "Lights", photos: [{ id: "ring", title: "Ring", ...teal, variants: [
        { id: "1-teal", colour: "Teal", ...teal, swatch: "img/lights/ring--1-teal-s.jpg" },
        { id: "2-red", colour: "Red", ...red, swatch: "img/lights/ring--2-red-s.jpg" },
      ] }] },
      { slug: "plates", name: "Plates", photos: [{ id: "sun", title: "Sun", ...sun }, { id: "moon", title: "Moon", ...moon }] },
    ],
  };
  await writeFile(path.join(root, "photos.json"), JSON.stringify(manifest));
  await writeFile(path.join(root, "site.json"), JSON.stringify(site));
  await writeFile(path.join(root, "categories.json"), JSON.stringify({ order: ["plates"] }));
  await writeFile(path.join(root, "style.css"), "body{}");
  await writeFile(path.join(root, "app.js"), "");
  return { root, manifest };
}

const read = (root, rel) => readFile(path.join(root, rel), "utf8");
const count = (html, re) => (html.match(re) || []).length;

test("writes a page for home, each category, each piece, plus 404, sitemap and robots", async () => {
  const { root } = await workspace();
  await writePages({ root });
  for (const rel of ["index.html", "plates/index.html", "plates/sun/index.html", "plates/moon/index.html", "lights/index.html", "lights/ring/index.html", "404.html", "sitemap.xml", "robots.txt"]) {
    assert.ok(existsSync(path.join(root, rel)), rel);
  }
  const sitemap = await read(root, "sitemap.xml");
  assert.equal(count(sitemap, /<loc>/g), 6);
  assert.match(sitemap, /<loc>https:\/\/example\.github\.io\/plates\/sun\/<\/loc>/);
  assert.match(await read(root, "robots.txt"), /Sitemap: https:\/\/example\.github\.io\/sitemap\.xml/);
  await rm(root, { recursive: true });
});

test("every page has one h1, a canonical, an og:image and a unique title", async () => {
  const { root } = await workspace();
  await writePages({ root });
  const titles = new Set();
  for (const rel of ["index.html", "plates/index.html", "plates/sun/index.html", "lights/ring/index.html"]) {
    const html = await read(root, rel);
    assert.equal(count(html, /<h1[\s>]/g), 1, rel);
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.github\.io\//, rel);
    assert.match(html, /<meta property="og:image" content="https:\/\//, rel);
    titles.add(html.match(/<title>([^<]+)<\/title>/)[1]);
  }
  assert.equal(titles.size, 4);
  await rm(root, { recursive: true });
});

test("links are relative, so the site works in a sub-folder and at the root", async () => {
  const { root } = await workspace();
  await writePages({ root });
  const piece = await read(root, "plates/sun/index.html");
  assert.match(piece, /href="\.\.\/\.\.\/style\.css\?v=/);
  assert.match(piece, /href="\.\.\/moon\/" rel="next"/);
  assert.doesNotMatch(piece, /(href|src)="\/(?!\/)/);
  const category = await read(root, "plates/index.html");
  assert.match(category, /src="\.\.\/vendor\/gsap\.min\.js"/);
  // The 404 is served at any depth: its assets are written after a <base> that finds the site's folder.
  const lost = await read(root, "404.html");
  assert.match(lost, /document\.write\('<base href="'\+r\+'">'/);
  assert.doesNotMatch(lost, /<link rel="stylesheet"/);
  await rm(root, { recursive: true });
});

test("categories.json sets the order; site.json overrides colour names and adds lettering", async () => {
  const { root } = await workspace();
  await writePages({ root });
  const home = await read(root, "index.html");
  assert.ok(home.indexOf('href="plates/"') < home.indexOf('href="lights/"'));
  const ring = await read(root, "lights/ring/index.html");
  assert.match(ring, /data-colour="Sea"/);
  assert.match(ring, /1 of 2/);
  const sun = await read(root, "plates/sun/index.html");
  assert.match(sun, /lang="hi">शुभ</);
  await rm(root, { recursive: true });
});

test("web copies are made for each photo and removed with it, and its pages go too", async () => {
  const { root, manifest } = await workspace();
  await writePages({ root });
  assert.ok(existsSync(path.join(root, "derived/plates/moon-480.webp")));
  assert.ok(existsSync(path.join(root, "derived/plates/moon-dot.webp")));
  assert.ok(existsSync(path.join(root, "derived/lights/ring--2-red-960.webp")));
  manifest.categories[1].photos.pop();
  await writeFile(path.join(root, "photos.json"), JSON.stringify(manifest));
  await writePages({ root });
  assert.ok(!existsSync(path.join(root, "derived/plates/moon-480.webp")));
  assert.ok(!existsSync(path.join(root, "plates/moon")));
  assert.ok(existsSync(path.join(root, "plates/sun/index.html")));
  await rm(root, { recursive: true });
});

test("a category named like one of the site's own folders is refused with a clear message", async () => {
  const { root, manifest } = await workspace();
  manifest.categories[0].slug = "fonts";
  await writeFile(path.join(root, "photos.json"), JSON.stringify(manifest));
  await assert.rejects(writePages({ root }), /cannot be called "fonts"/);
  await rm(root, { recursive: true });
});
