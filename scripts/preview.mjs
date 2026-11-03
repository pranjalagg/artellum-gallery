// Builds the sample photos into .preview/ with the page files and serves it. The committed site is untouched.
import { cp } from "node:fs/promises";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { build } from "./build.mjs";
import { writePages } from "./pages.mjs";

const DIR = path.resolve(".preview");
const PORT = Number(process.env.PORT) || 4173;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain",
};

if (!existsSync(".samples/originals")) {
  console.error("No sample photos yet. Run: npm run samples");
  process.exit(1);
}
const report = await build({ src: ".samples/originals", out: DIR, categoriesFile: "categories.json" });
for (const w of report.warnings) console.warn(`Skipped ${w}`);
for (const page of ["style.css", "app.js", "route.js", "favicon.svg", "favicon-32.png", "apple-touch-icon.png", "fonts", "vendor"]) {
  if (existsSync(page)) await cp(page, path.join(DIR, page), { recursive: true });
}
await writePages({ root: ".", out: DIR });

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let file = path.join(DIR, decodeURIComponent(url.pathname));
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!file.startsWith(DIR + path.sep) || !existsSync(file)) {
    res.writeHead(404, { "Content-Type": TYPES[".html"] });
    createReadStream(path.join(DIR, "404.html")).pipe(res);
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}`));
