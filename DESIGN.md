# Artellum gallery: design

This file is the plan the redesign was built from. `docs/superpowers/specs/2026-10-28-gallery-design.md`
is the original brief; everything here keeps its goals (phone first, exhibition wifi, photos only,
no prices or cart, the owner adds photos without touching code).

## Brief

- **Subject:** Artellum, one maker who paints wall pieces, tea lights, door hangings and keychains
  by hand: dot painting, small inset mirrors, Devanagari lettering (शुभ लाभ, जय श्री राम, श्री राधा).
  Every piece is photographed on the same saffron silk (tea lights on an olive and gold brocade).
- **Audience:** people at an exhibition counter who scan the QR card on their phone, then
  Instagram followers. Cheap phones, busy wifi.
- **Job:** show the whole collection the table cannot hold, let visitors find a piece and its
  colours, and leave them with the maker's name and Instagram. Small things are made to order.
- **Assets:** the owner's own photos (real, consistent), the maker note from the `book-design`
  branch, the Artellum signature in Homemade Apple, and the printed QR card: a tea-light photo
  painted in round dots, hanging in a dark frame on a sage wall.
- **Assumptions (owner to confirm):** listed in `site.json` under `_assumptions`.

## Concepts

| | A. Dot by dot (material) | B. Diwali evening (place and culture) | C. The saffron cloth (process) |
|---|---|---|---|
| Idea | The pieces are painted one dot at a time, from the centre out; the gallery is drawn the same way | The page is an evening of Diwali: scrolling lights the tea lights one by one, dusk warms to saffron | Every piece is shot on one saffron silk; the site is that cloth laid on the stall table |
| Anchor | dot painting on nearly every piece, and the dot-painted QR card that brings visitors here | tea lights, शुभ लाभ, lotus hangings; the exhibition falls in Diwali week | the same silk behind every photo |
| Signature | a real round piece redrawn in about two thousand dots, painted ring by ring; it breathes at rest and swells under a finger; "Paint the next one" repaints it as another piece | a scrubbed sky with diyas that ignite | a cloth ripple carries you from piece to piece |
| Screenshot | the half-painted plate beside the headline | the lit row of diyas at dusk | pieces resting on the folds |
| O / F / Fe / P | 4 / 5 / 4 / 2 | 3 / 3 / 4 / 4 | 3 / 4 / 2 / 3 |

**Pick A.** It fits the actual craft, it continues the QR card visitors have just scanned, and it
is cheap to run on a phone (canvas 2D and CSS masks, no WebGL). From C: the page transition is a
drop of the piece's own colour, and the colour of the silk is the site's one accent. From B: nothing
structural; the copy says "tea lights" and never "Diwali" so the site outlives the season.

## Concept card

```
Idea:        Every Artellum piece is painted dot by dot, by hand; the gallery is drawn the same way.
Metaphor:    a dot-painting session: dots laid in rings from the centre out, on the sage wall of the QR card.
Signature:   the hero plate: a real piece redrawn in dots sampled from its photo, painted ring by ring,
             breathing at rest, swelling under the pointer or a finger; "Paint the next one" repaints it.
             (js/plate.js, a driver on the GSAP ticker; patterns.md "driver module")
Emotion:     the calm of watching someone paint: warm, unhurried, precise.
Motion verb: land like a dot of paint. Things arrive as dots that grow and merge (a halftone screen
             opening into the photo), spreading from a centre. Nothing slides in.
Screenshot:  the plate with its inner rings painted and the outer ring still landing, next to
             "Painted by hand, dot by dot."
```

## Art direction

**Palette** (named after where each colour comes from)

| Role | Name | Hex | Source |
|---|---|---|---|
| ground | Card wall | `#c7cbbf` | the sage wall the QR card hangs on; also the Artellum store |
| ink | Kohl | `#211d19` | the black base coat of the star and swirl mirrors |
| muted | Smoke | `#46433c` | secondary text, 5.9:1 on the wall |
| line | Dotted kohl | `rgb(33 29 25 / .38)` | rules are rows of dots, never solid hairlines |
| paper | Mat | `#ece8dd` | the card's mat: menus, labels |
| accent | Silk | `#d8731b` | the saffron silk behind every photo; the curtain, the active swatch ring, selection |

The photos carry all the other colour. Each piece also gets its own "dot" colour, sampled from the
middle of its photo at build time: the drop that carries you into it, and its runs of colour dots.

**Type**

- Display: **Eczar** (Rosetta, Vaibhav Singh), 500 to 700. A display face built for Latin and
  Devanagari together, so the lettering on the pieces can be set in its own script beside its name.
  Tracking -0.025em at display sizes, leading 0.92.
- Text and UI: **Karla** 400, 500, 700 (kept from the Artellum store). Body 17 to 18 px, 1.55.
- Signature: **Homemade Apple**, the Artellum wordmark and the maker's sign-off only.
- Scale: mega `clamp(3.25rem, 1rem + 9.6vw, 10rem)`, xl `clamp(2.4rem, 1.2rem + 4.4vw, 5.5rem)`,
  l `clamp(1.6rem, 1.2rem + 1.6vw, 2.6rem)`, body `clamp(1.0625rem, 1rem + .2vw, 1.125rem)`, s 14 px, xs 12.5 px.
  Counts in tabular figures.

**Grid and rhythm:** 12 columns from 900 px, 4 on phones, gutter `clamp(16px, 4vw, 40px)`, content
to 1440 px. Everything hangs from two lines: column 1 and column 7. Section spacing has four moods:
tight (the index rows), normal (wall), airy (maker), full screen (hero).

**Shape:** photographs are plain rectangles, radius 0. Everything you can press or count is a
circle: dots, swatches, arrows, buttons, the curtain. Nothing in between.

**Motion language:** one easing family: `expo.out` for arrivals, `power3.out` for feedback,
`expo.inOut` for the curtain. Halftone reveal 1.1 s (dots grow, then the centre fills); the plate
paints in about 2 s; the curtain is a drop of the piece's colour spreading from the tap point
(0.55 s) that then breaks into dots and shrinks away (0.6 s). Hover and press 0.3 to 0.45 s.
Dots in a row stagger by 25 to 40 ms. Under reduced motion: no smooth scroll, no painting, no
masks, short fades only, everything visible.

**One treatment per role**

| Role | Treatment |
|---|---|
| Category rows | the row's photo dots grow in sequence and the name steps right by one dot |
| Pieces on the wall | the photo eases up inside its frame; the caption's colour dots fill in |
| Nav links | a dotted underline draws dot by dot; the current page keeps a filled dot |
| Buttons (paint next, pager arrows) | kohl floods the circle from the pointer's side; arrows nudge |
| Inline links | dotted underline at rest, it thickens |
| Utility links (Instagram in footer, colophon) | colour and underline only |

**Idle:** the hero plate breathes: a slow glint travels outward through its rings, like light over
wet paint and mirror. The rest of the site is still at rest by decision: the photographs are the
content and should hold still.

### Composition plan

Home
```
1 HERO (split frame)                          phone
 Artellum handcraft        Wall Tea Door Key  | Artellum            Menu |
                                              | Painted by hand,        |
 Painted by hand,           .  .  .  .  .     | dot by dot.             |
 dot by dot.             .  : : : : : :  .    |     .  .  .  .  .       |
                        .  :  (plate)  :  .   |   .  : (plate)  :  .    |
 one line: what, who     .  : : : : : :  .    |     .  .  .  .  .       |
 (Paint the next one)       .  .  .  .  .     | Sunburst dot mirror  (>)|
                         Sunburst dot mirror  |                         |
2 COLLECTION (index list)
 Wall pieces    o o o o o o o o o o o o o o o o        16 pieces
 Tea lights     o o o o o                     5 designs, 61 colours
 ...  (rows separated by dotted rules)
3 THE WALL (gallery wall): every piece, columns 2 / 3 / 4, captions with colour dots
4 MAKER (statement): the maker note set large on columns 1 to 9, sign-off in the hand
5 FOOTER (finale): Artellum at full width in the hand, Instagram, colophon
```
Category: poster title with its dots and count, one honest line, the wall, then the next category
as a full-width link. Piece: asymmetric pair (photo on 7 columns, details on 5, sticky), colour
swatches as a palette of dots, the lettering in Devanagari when the piece carries it, pager with
"3 of 16". 404: an unpainted plate (a ring of empty dots) and the way back.

### Genericness test

A generic answer to "a gallery for a handmade crafts seller" lands on cream, terracotta, a serif
and tilted polaroids with shadows. Both earlier versions of this site were close to that. Changed:
the tilted frames and drop shadows are gone; counts, rules, swatches, buttons and transitions are
all dots; photos open through a halftone screen instead of fading up; the display face is a
Latin and Devanagari family chosen for the lettering on the pieces; the accent is the photographed
silk, not a brand terracotta.

## Build notes

- Static, no framework, as before: GitHub Pages serves the repo. `npm run build` resizes photos,
  writes `photos.json`, then renders every page (`scripts/pages.mjs`) from it and `site.json`.
- Real pages: `/`, `/<category>/`, `/<category>/<piece>/`, `404.html`, plus sitemap and robots.
  Links are relative, so the same files work at `pranjalagg.github.io/artellum-gallery/` and at
  `artellum.github.io/`. Old `#/…` links from the first QR card redirect to the new pages.
- JS: GSAP core and Lenis, vendored in `vendor/` (`npm run vendor`), plus `js/`. No ScrollTrigger,
  no SplitText, no WebGL: reveals use IntersectionObserver and the plate is canvas 2D.
- Fonts self-hosted as woff2 in `fonts/web/` (Homemade Apple is cut down to the letters of "Artellum": 3 KB).

## Decisions from QA

- **Idle:** only the hero plate moves at rest (its glint). Category, piece and 404 pages are still by
  decision: there the photographs are the content. Because the plate never stops, the home page's
  `settledMs` is reported as null; that is the plate breathing, not a page that fails to settle.
- **Plate cost on phones:** once painted, the plate is cached as a bitmap, and a frame at rest only
  redraws the dots the glint, pointer or a ripple is touching. Throttled-phone scroll over the hero went
  from 27 to 60 fps.
- **Wall:** each piece goes to the shortest column. Small sets use a column count that fills the last
  row, and a column that ends well short is closed by a blank dot plate with the real count. The wall
  is hidden (not shifted) until it is laid out, so it never jumps.
- **Photos:** WebP 480 and 960 for tiles and phones, plus a 960 AVIF for the main photo on a piece page
  (the tea lights' brocade is costly in WebP). The JPEGs stay as the fallback inside `<picture>`.
- **Transitions:** between pages a drop of the destination piece's colour spreads from the tap and
  breaks into dots; between neighbouring pieces the photo only dots out and in.
- **Not done, on purpose:** prices, sizes and an order form (non-goals in the original brief); retouching
  the owner's photos (the phone reflected in the mirror pieces is the owner's call).
