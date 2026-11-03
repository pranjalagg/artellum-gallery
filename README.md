# Artellum gallery

A phone-first photo gallery for the exhibition. Visitors scan a QR code, pick a category and browse the pieces. No database: each category is a folder, and a script shrinks the photos for the web and writes every page of the site from them.

The look is planned in `DESIGN.md`: the pieces are painted dot by dot, so the site is drawn the same way (the home page redraws a real plate in dots, photos open through a screen of dots, and counts and colours are rows of dots).

## Add photos

1. Put photos in `originals/<category>/`, one folder per category (for example `originals/paintings/`, `originals/tea-lights/`). Create the `originals` folder yourself; it is never uploaded to GitHub, so the full-size files stay on this laptop.
2. The filename becomes the caption: `before-the-rain.jpg` shows as "Before the rain".
3. Run `npm run build`. It makes a small and a large copy of each new photo in `img/`, writes `photos.json`, then writes every page: the home page, a page per category and a page per piece, with web copies of the photos in `derived/`. Photos you have already built are skipped, and deleted ones are cleaned up, pages included.
4. Commit and push. This updates the test site only:
   ```sh
   git add -A && git commit -m "add photos" && git push
   ```
5. Check it on your phone at `https://pranjalagg.github.io/artellum-gallery/`, then put it live with `npm run release`.

iPhone photos (HEIC) are converted automatically on a Mac. Anything the script cannot read is listed by name when it finishes, and the rest still builds.

### One design in several colours

Give the design a folder of its own inside the category, with one photo per colour:

```
originals/door-hangings/shubh-labh-hangings/maroon-and-green.jpg
                                            orange-and-blue.jpg
                                            red-and-gold.jpg
```

The wall then shows one frame for the design, with the other colours' frames peeking out behind it and a "3 colours" tag. Opening it shows round colour swatches under the photo; the arrows and swipes still move to the next design. The folder name becomes the title ("Shubh labh hangings") and each filename the colour ("maroon and green").

The wall shows the first colour by filename. To pick a different one, put numbers in front: `1-red-and-gold.jpg`, `2-maroon-and-green.jpg`. The number only sets the order and is left out of the colour name.

The photo viewer keeps one frame size while visitors switch colours: whichever shape (portrait or landscape) most of the design's photos have. A photo of the other shape is shown whole inside that frame, smaller, with the mat around it; nothing is cropped. To have every colour fill the frame, shoot (or rotate) them all the same way.

### Words on the site

Every sentence on the site that is not a photo name lives in `site.json`: the headline, the maker note, the line under each category, the Instagram link, and per piece a better title, shorter colour names, or the lettering painted on it (shown in Devanagari on the piece's page). `hero.plates` lists the round pieces the home page redraws in dots, with where the plate sits in its photo. After editing it, run `npm run pages` (quick: it skips the photos), then commit and push.

### Category names and order

Folder names become the category names ("tea-lights" shows as "Tea lights"), in alphabetical order. To change either, edit `categories.json`:

```json
{ "order": ["paintings", "tea-lights"], "names": { "tea-lights": "Tea Lights ✦" } }
```

Categories listed in `order` come first; the rest follow alphabetically.

## Try it locally

```sh
npm install
npm run samples     # makes 40 stand-in photos in .samples/ (npm run samples -- 500 for a stress test)
npm run preview     # builds them into .preview/ and serves http://localhost:4173
```

Preview never touches your real `img/` or `photos.json`.

`npm run vendor` copies the two browser libraries the site uses (GSAP and Lenis) from `node_modules` into `vendor/`; run it only after updating them.

## QR code

```sh
npm run qr -- https://artellum.github.io/
```

Writes `qr/artellum-qr.png` (2400 × 3000, ready to print) and `qr/artellum-qr.svg`: the code painted in fine dots from the tea-light photo in `qr/photo.jpg`, hanging in a dark frame on a sage wall, with "Artellum" in its handwritten font and an italic line underneath. To paint it from another photo, add its path after the URL (`npm run qr -- https://artellum.github.io/ path/to/photo.jpg`); bright, colourful photos on a dark background scan best. The lettering is drawn from the font files in `fonts/` (Homemade Apple, Apache 2.0; Spectral, OFL), so the card prints the same anywhere. The lines under the frame live in `caption()` in `scripts/qr.mjs`.

`npm test` checks that the card still scans back to the URL, including small and slightly blurred. Still scan the printed card with a phone before the exhibition.

## Publish on GitHub Pages

Two copies of the site:

- **Test:** `pranjalagg/artellum-gallery` (the `origin` remote) at `https://pranjalagg.github.io/artellum-gallery/`, published by the "Test site" workflow (Settings -> Pages -> Source: GitHub Actions). Every push to `main` lands here. To look at another branch, such as `book-design`, push it, then open Actions -> "Test site" -> Run workflow and type the branch name. It stays up until the next push to `main`, or run the workflow again with `main`.
- **Live:** `artellum/artellum.github.io` (the `prod` remote) at `https://artellum.github.io/`, which the QR code opens, published from its `main` branch (Settings -> Pages -> Deploy from a branch -> `main` / root). Only `npm run release` updates it.

`npm run release` runs the tests, then copies exactly what is on the test site to the live one, so unpushed local changes never go live.

## Tests

`npm test`
