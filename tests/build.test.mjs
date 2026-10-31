import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm, readFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { build } from "../scripts/build.mjs";

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "gallery-"));
  const src = path.join(root, "originals");
  const out = path.join(root, "site");
  await mkdir(src);
  await mkdir(out);
  return { root, src, out, categoriesFile: path.join(root, "categories.json") };
}

async function photo(file, w, h, opts = {}) {
  await mkdir(path.dirname(file), { recursive: true });
  let img = sharp({ create: { width: w, height: h, channels: 3, background: "#c98a6b" } });
  if (opts.orientation) img = img.withMetadata({ orientation: opts.orientation });
  await img.jpeg().toFile(file);
}

const meta = (file) => sharp(file).metadata();
const manifest = async (out) => JSON.parse(await readFile(path.join(out, "photos.json"), "utf8"));

test("resizes large to 1600 long edge and thumb to 600 wide, never enlarging", async () => {
  const ws = await workspace();
  await photo(path.join(ws.src, "paintings", "big.jpg"), 3000, 2000);
  await photo(path.join(ws.src, "paintings", "small.jpg"), 800, 600);
  await build(ws);
  const big = path.join(ws.out, "img/paintings");
  assert.deepEqual([(await meta(`${big}/big-l.jpg`)).width, (await meta(`${big}/big-l.jpg`)).height], [1600, 1067]);
  assert.deepEqual([(await meta(`${big}/big-t.jpg`)).width, (await meta(`${big}/big-t.jpg`)).height], [600, 400]);
  assert.equal((await meta(`${big}/small-l.jpg`)).width, 800);
  assert.equal((await meta(`${big}/small-l.jpg`)).height, 600);
  await rm(ws.root, { recursive: true });
});

test("applies EXIF rotation", async () => {
  const ws = await workspace();
  await photo(path.join(ws.src, "paintings", "tall.jpg"), 400, 200, { orientation: 6 });
  await build(ws);
  const large = await meta(path.join(ws.out, "img/paintings/tall-l.jpg"));
  assert.deepEqual([large.width, large.height], [200, 400]);
  const m = await manifest(ws.out);
  assert.ok(m.categories[0].photos[0].w < m.categories[0].photos[0].h);
  await rm(ws.root, { recursive: true });
});

test("ignores junk files and empty categories", async () => {
  const ws = await workspace();
  await photo(path.join(ws.src, "paintings", "a.jpg"), 100, 100);
  await writeFile(path.join(ws.src, "paintings", ".DS_Store"), "x");
  await writeFile(path.join(ws.src, "paintings", "notes.txt"), "x");
  await mkdir(path.join(ws.src, "empty"));
  await writeFile(path.join(ws.src, ".DS_Store"), "x");
  const report = await build(ws);
  const m = await manifest(ws.out);
  assert.deepEqual(m.categories.map((c) => [c.slug, c.photos.length]), [["paintings", 1]]);
  assert.deepEqual(report.warnings, []);
  await rm(ws.root, { recursive: true });
});

test("an unreadable photo is a warning naming the file, not a crash", async () => {
  const ws = await workspace();
  await photo(path.join(ws.src, "paintings", "good.jpg"), 100, 100);
  await writeFile(path.join(ws.src, "paintings", "bad.jpg"), "not an image");
  const report = await build(ws);
  assert.equal(report.warnings.length, 1);
  assert.match(report.warnings[0], /bad\.jpg/);
  const m = await manifest(ws.out);
  assert.deepEqual(m.categories[0].photos.map((p) => p.id), ["good"]);
  await rm(ws.root, { recursive: true });
});

test("converts heic on macOS", { skip: process.platform !== "darwin" && "heic conversion uses macOS sips" }, async () => {
  const ws = await workspace();
  const jpg = path.join(ws.root, "seed.jpg");
  await photo(jpg, 300, 200);
  await mkdir(path.join(ws.src, "paintings"));
  execFileSync("sips", ["-s", "format", "heic", jpg, "--out", path.join(ws.src, "paintings", "phone.HEIC")], { stdio: "ignore" });
  const report = await build(ws);
  assert.deepEqual(report.warnings, []);
  assert.ok(existsSync(path.join(ws.out, "img/paintings/phone-l.jpg")));
  await rm(ws.root, { recursive: true });
});

test("second run skips unchanged; deleting an original removes its outputs", async () => {
  const ws = await workspace();
  await photo(path.join(ws.src, "paintings", "a.jpg"), 200, 200);
  await photo(path.join(ws.src, "paintings", "b.jpg"), 200, 200);
  const first = await build(ws);
  assert.equal(first.processed, 2);
  const second = await build(ws);
  assert.deepEqual([second.processed, second.skipped], [0, 2]);
  await rm(path.join(ws.src, "paintings", "b.jpg"));
  const third = await build(ws);
  assert.equal(third.removed, 2);
  assert.ok(!existsSync(path.join(ws.out, "img/paintings/b-t.jpg")));
  assert.ok(!existsSync(path.join(ws.out, "img/paintings/b-l.jpg")));
  assert.deepEqual((await manifest(ws.out)).categories[0].photos.map((p) => p.id), ["a"]);
  await rm(ws.root, { recursive: true });
});

test("a newer original is reprocessed", async () => {
  const ws = await workspace();
  const file = path.join(ws.src, "paintings", "a.jpg");
  await photo(file, 200, 200);
  await build(ws);
  const future = new Date(Date.now() + 60_000);
  await utimes(file, future, future);
  const again = await build(ws);
  assert.equal(again.processed, 1);
  await rm(ws.root, { recursive: true });
});

test("slug collisions get a numeric suffix", async () => {
  const ws = await workspace();
  await photo(path.join(ws.src, "paintings", "My Photo.jpg"), 100, 100);
  await sharp({ create: { width: 100, height: 100, channels: 3, background: "#fff" } }).png().toFile(path.join(ws.src, "paintings", "my-photo.png"));
  await build(ws);
  const ids = (await manifest(ws.out)).categories[0].photos.map((p) => p.id).sort();
  assert.deepEqual(ids, ["my-photo", "my-photo-2"]);
  await rm(ws.root, { recursive: true });
});

test("categories.json sets names and order; manifest carries titles and sizes", async () => {
  const ws = await workspace();
  await photo(path.join(ws.src, "crochet", "red-doily.jpg"), 600, 900);
  await photo(path.join(ws.src, "paintings", "x.jpg"), 100, 100);
  await writeFile(ws.categoriesFile, JSON.stringify({ order: ["paintings"], names: { crochet: "Crochet ✦" } }));
  await build(ws);
  const m = await manifest(ws.out);
  assert.deepEqual(m.categories.map((c) => [c.slug, c.name]), [["paintings", "Paintings"], ["crochet", "Crochet ✦"]]);
  const { frame, ...rest } = m.categories[1].photos[0];
  assert.deepEqual(rest, {
    id: "red-doily",
    title: "Red doily",
    thumb: "img/crochet/red-doily-t.jpg",
    large: "img/crochet/red-doily-l.jpg",
    w: 600,
    h: 900,
  });
  assert.match(frame, /^#[0-9a-f]{6}$/);
  await rm(ws.root, { recursive: true });
});

test("a folder inside a category is one design, with its photos as colours in filename order", async () => {
  const ws = await workspace();
  await photo(path.join(ws.src, "tea-lights", "mirror-ring", "2-teal.jpg"), 200, 300);
  await photo(path.join(ws.src, "tea-lights", "mirror-ring", "1-red-and-gold.jpg"), 300, 200);
  await writeFile(path.join(ws.src, "tea-lights", "mirror-ring", "notes.txt"), "x");
  await photo(path.join(ws.src, "tea-lights", "lotus.jpg"), 100, 100);
  await build(ws);
  const [single, design] = (await manifest(ws.out)).categories[0].photos;
  assert.equal(single.id, "lotus");
  assert.equal(single.variants, undefined);
  assert.deepEqual([design.id, design.title], ["mirror-ring", "Mirror ring"]);
  assert.deepEqual(design.variants.map((v) => [v.id, v.colour]), [["1-red-and-gold", "Red and gold"], ["2-teal", "Teal"]]);
  // The wall shows the first colour.
  assert.deepEqual([design.thumb, design.large, design.w, design.h, design.frame], [design.variants[0].thumb, design.variants[0].large, 300, 200, design.variants[0].frame]);
  assert.equal(design.variants[1].thumb, "img/tea-lights/mirror-ring--2-teal-t.jpg");
  assert.ok(existsSync(path.join(ws.out, "img/tea-lights/mirror-ring--2-teal-l.jpg")));
  // Each colour gets a small square swatch; the design itself and single photos do not.
  assert.equal(design.variants[1].swatch, "img/tea-lights/mirror-ring--2-teal-s.jpg");
  const swatch = await meta(path.join(ws.out, design.variants[1].swatch));
  assert.deepEqual([swatch.width, swatch.height], [120, 120]);
  assert.equal(design.swatch, undefined);
  assert.ok(!existsSync(path.join(ws.out, "img/tea-lights/lotus-s.jpg")));
  await rm(ws.root, { recursive: true });
});

test("a design takes the shape most of its colours share, whatever shape the first one is", async () => {
  const ws = await workspace();
  await photo(path.join(ws.src, "tea-lights", "flower", "1-teal.jpg"), 400, 300);
  await photo(path.join(ws.src, "tea-lights", "flower", "2-red.jpg"), 300, 400);
  await photo(path.join(ws.src, "tea-lights", "flower", "3-pink.jpg"), 300, 400);
  await build(ws);
  const [design] = (await manifest(ws.out)).categories[0].photos;
  assert.deepEqual([design.w, design.h], [300, 400]);
  // The wall still shows the first colour, and each colour keeps its own size.
  assert.equal(design.thumb, design.variants[0].thumb);
  assert.deepEqual([design.variants[0].w, design.variants[0].h], [400, 300]);
  await rm(ws.root, { recursive: true });
});

test("a design folder and a photo with the same name both survive", async () => {
  const ws = await workspace();
  await photo(path.join(ws.src, "tea-lights", "lotus", "pink.jpg"), 100, 100);
  await photo(path.join(ws.src, "tea-lights", "lotus.jpg"), 100, 100);
  await build(ws);
  assert.deepEqual((await manifest(ws.out)).categories[0].photos.map((p) => p.id), ["lotus", "lotus-2"]);
  await rm(ws.root, { recursive: true });
});

test("an unreadable colour is a warning; the design keeps its other colours, and an empty folder is skipped", async () => {
  const ws = await workspace();
  await photo(path.join(ws.src, "tea-lights", "lotus", "pink.jpg"), 100, 100);
  await writeFile(path.join(ws.src, "tea-lights", "lotus", "white.jpg"), "not an image");
  await mkdir(path.join(ws.src, "tea-lights", "empty"));
  const report = await build(ws);
  assert.equal(report.warnings.length, 1);
  assert.match(report.warnings[0], /tea-lights\/lotus\/white\.jpg/);
  const photos = (await manifest(ws.out)).categories[0].photos;
  assert.deepEqual(photos.map((p) => [p.id, p.variants.map((v) => v.id)]), [["lotus", ["pink"]]]);
  await rm(ws.root, { recursive: true });
});

test("removing a colour or a whole design removes its files", async () => {
  const ws = await workspace();
  await photo(path.join(ws.src, "tea-lights", "lotus", "pink.jpg"), 100, 100);
  await photo(path.join(ws.src, "tea-lights", "lotus", "white.jpg"), 100, 100);
  await photo(path.join(ws.src, "tea-lights", "single.jpg"), 100, 100);
  await build(ws);
  await rm(path.join(ws.src, "tea-lights", "lotus", "white.jpg"));
  assert.equal((await build(ws)).removed, 3);
  assert.ok(!existsSync(path.join(ws.out, "img/tea-lights/lotus--white-t.jpg")));
  assert.ok(!existsSync(path.join(ws.out, "img/tea-lights/lotus--white-s.jpg")));
  assert.ok(existsSync(path.join(ws.out, "img/tea-lights/lotus--pink-t.jpg")));
  await rm(path.join(ws.src, "tea-lights", "lotus"), { recursive: true });
  assert.equal((await build(ws)).removed, 3);
  assert.deepEqual((await manifest(ws.out)).categories[0].photos.map((p) => p.id), ["single"]);
  await rm(ws.root, { recursive: true });
});

test("frame colour follows the photo: light for a dark photo, dark for a bright one", async () => {
  const ws = await workspace();
  const solid = async (name, background) => {
    await mkdir(path.join(ws.src, "paintings"), { recursive: true });
    await sharp({ create: { width: 200, height: 200, channels: 3, background } }).jpeg().toFile(path.join(ws.src, "paintings", name));
  };
  await solid("night.jpg", "#0a2a30");
  await solid("sand.jpg", "#e8d8a0");
  await build(ws);
  const lightness = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  };
  const byId = Object.fromEntries((await manifest(ws.out)).categories[0].photos.map((p) => [p.id, p.frame]));
  assert.ok(lightness(byId.night) > 0.6, byId.night);
  assert.ok(lightness(byId.sand) < 0.3, byId.sand);
  await rm(ws.root, { recursive: true });
});
