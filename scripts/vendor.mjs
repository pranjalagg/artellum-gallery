// Copies the two browser libraries the site uses into vendor/, because GitHub Pages serves the
// repo as it is (there is no install step there). Run after updating gsap or lenis.
import { copyFile, mkdir } from "node:fs/promises";

const files = {
  "node_modules/gsap/dist/gsap.min.js": "vendor/gsap.min.js",
  "node_modules/lenis/dist/lenis.min.js": "vendor/lenis.min.js",
};
await mkdir("vendor", { recursive: true });
for (const [from, to] of Object.entries(files)) {
  await copyFile(from, to);
  console.log(`${from} -> ${to}`);
}
