# Artellum gallery

A phone-first photo gallery for the exhibition. Visitors scan a QR code and find a closed album on the wall. Tapping it opens the cover onto a contents page, and from there they turn pages by swiping, tapping the page edge or using the arrows, or jump to any chapter with the tabs standing out from the edge of the pages. Each category is a chapter, and each photo gets a page of its own. On a wide screen the album lies open as a two-page spread, with each photo's caption on the facing page. No database: each category is a folder, and a script shrinks the photos for the web.

While the album is closed, an "about the maker" label sits beside it on a wide screen, and below it on a phone. Its words are in the `<aside id="about">` in `index.html`; edit them there.

The cover shows the first photo of the first category. Photos sort by filename, so to change the cover, reorder the categories (see below) or rename a photo so it sorts first.

## Add photos

1. Put photos in `originals/<category>/`, one folder per category (for example `originals/paintings/`, `originals/tea-lights/`). Create the `originals` folder yourself; it is never uploaded to GitHub, so the full-size files stay on this laptop.
2. The filename becomes the caption: `before-the-rain.jpg` shows as "Before the rain".
3. Run `npm run build`. It makes a small and a large copy of each new photo in `img/` and writes `photos.json`. Photos you have already built are skipped, and deleted ones are cleaned up.
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

The design then gets one page in the album, with round colour swatches under its photo; tapping one shows that colour, and turning the page moves on to the next design. The folder name becomes the title ("Shubh labh hangings") and each filename the colour ("maroon and green").

The first colour by filename is the one shown first. To pick a different one, put numbers in front: `1-red-and-gold.jpg`, `2-maroon-and-green.jpg`. The number only sets the order and is left out of the colour name.

The photo keeps one frame size while visitors switch colours: whichever shape (portrait or landscape) most of the design's photos have. A photo of the other shape is shown whole inside that frame, smaller; nothing is cropped. To have every colour fill the frame, shoot (or rotate) them all the same way.

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

## QR code

```sh
npm run qr -- https://artellum.github.io/
```

Writes `qr/artellum-qr.png` (2400 × 3000, ready to print) and `qr/artellum-qr.svg`: the code painted in fine dots from the tea-light photo in `qr/photo.jpg`, hanging in a dark frame on a sage wall, with "Artellum" in its handwritten font and an italic line underneath. To paint it from another photo, add its path after the URL (`npm run qr -- https://artellum.github.io/ path/to/photo.jpg`); bright, colourful photos on a dark background scan best. The lettering is drawn from the font files in `fonts/` (Homemade Apple, Apache 2.0; Spectral, OFL), so the card prints the same anywhere. The lines under the frame live in `caption()` in `scripts/qr.mjs`.

`npm test` checks that the card still scans back to the URL, including small and slightly blurred. Still scan the printed card with a phone before the exhibition.

## Publish on GitHub Pages

Two copies of the site, each published from its repo's `main` branch (Settings -> Pages -> Deploy from a branch -> `main` / root):

- **Test:** `pranjalagg/artellum-gallery` (the `origin` remote) at `https://pranjalagg.github.io/artellum-gallery/`. Every `git push` lands here.
- **Live:** `artellum/artellum.github.io` (the `prod` remote) at `https://artellum.github.io/`, which the QR code opens. Only `npm run release` updates it.

`npm run release` runs the tests, then copies exactly what is on the test site to the live one, so unpushed local changes never go live.

## Tests

`npm test`
