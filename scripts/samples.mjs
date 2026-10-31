// Generates colour-gradient stand-in photos for testing. Writes only to .samples/originals.
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = ".samples/originals";
const CATEGORIES = {
  paintings: ["before-the-rain", "blue-window", "marigold-field", "monsoon-sky", "quiet-street", "old-balcony", "river-bend", "paper-boats"],
  "tea-lights": ["marigold", "lotus", "evening-glow", "clay-diya", "little-moon", "copper-flame"],
  "fridge-magnets": ["chai-cup", "auto-rickshaw", "tiny-mango", "bicycle", "cloud", "paper-kite"],
  crochet: ["red-doily", "sunflower", "granny-square", "mini-bag", "daisy-chain", "bunny"],
};
const SHAPES = [[1200, 1600], [1600, 1200], [1500, 1500], [1200, 1800], [1800, 1200]];
// A few designs in several colours, one folder each.
const DESIGNS = {
  "tea-lights": { "mirror-ring": ["1-red-and-gold", "2-teal", "3-marigold", "4-plum"] },
  crochet: { "granny-square-coaster": ["rose", "sage"] },
};

const count = Number(process.argv[2]) || 40;
const hue = (n) => (n * 47) % 360;

function svg(w, h, n) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hue(n)},55%,62%)"/><stop offset="1" stop-color="hsl(${hue(n + 3)},60%,82%)"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="${w * 0.5}" cy="${h * 0.45}" r="${Math.min(w, h) * 0.22}" fill="hsl(${hue(n + 5)},50%,92%)" fill-opacity="0.7"/>
    </svg>`,
  );
}

await rm(".samples", { recursive: true, force: true });
const slugs = Object.keys(CATEGORIES);
for (let n = 0; n < count; n++) {
  const slug = slugs[n % slugs.length];
  const names = CATEGORIES[slug];
  const name = names[Math.floor(n / slugs.length) % names.length];
  const suffix = Math.floor(n / (slugs.length * names.length));
  const [w, h] = SHAPES[n % SHAPES.length];
  const dir = path.join(OUT, slug);
  await mkdir(dir, { recursive: true });
  await sharp(svg(w, h, n)).jpeg({ quality: 85 }).toFile(path.join(dir, `${name}${suffix ? `-${suffix + 1}` : ""}.jpg`));
}
let n = count;
for (const [slug, designs] of Object.entries(DESIGNS)) {
  for (const [design, colours] of Object.entries(designs)) {
    const dir = path.join(OUT, slug, design);
    await mkdir(dir, { recursive: true });
    for (const colour of colours) await sharp(svg(1200, 1500, n++)).jpeg({ quality: 85 }).toFile(path.join(dir, `${colour}.jpg`));
  }
}
console.log(`Wrote ${n} sample photos to ${OUT}, ${n - count} of them as colours of a design`);
