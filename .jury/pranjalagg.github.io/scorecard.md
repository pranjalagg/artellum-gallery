# pranjalagg.github.io/artellum-gallery: jury score
Estimate, not affiliated with Awwwards. Independent critic, from 1 page (home; the book interior was never captured) on 2026-11-03.

**The idea, as the critic read it:** a one-person handmade-craft shop shown as a cloth-bound book on a desk; you click the cover to open it and browse the catalogue.
**Critic overall: 6.85** (0.4 x 7.0 Design + 0.3 x 6.5 Usability + 0.2 x 7.0 Creativity + 0.1 x 7.0 Content, on the critic's strict scale)
**Jury estimate: about 7.9** (critic + 1.1, an offset measured on two Sites of the Day only)
**Band, from the estimate:** Site of the Day range (7.2 and up), but treat it as an upper bound. The critic only saw the closed book, so the opened spreads, paging and product views are unscored.

| Criterion | Score | Evidence |
|---|---|---|
| Design (40%) | 7.0 | d-01-hero: terracotta cloth cover, script wordmark, letter-spaced "handcraft", corner-mounted photo, slight tilt and soft shadow. Warm earth on sage grey. Maker note is calm and consistent. Weak: note floats loosely beside the book, hint text very faint, 29 contrast items to review. h-01 pair: book lifts and tilts (a real treatment). |
| Usability (30%) | 6.5 | Instant orientation (d-01, m-01). Mobile LCP 1052 ms, CLS 0.006, 60 fps, 0 small targets. Against: no skip link, k-01..k-04 show no visible focus, heroSettledMs 4709 desktop and 5654 mobile. |
| Creativity (20%) | 7.0 | Book metaphor fits a craft brand and could not move to another category. Only the cover and the open action carry it in the captured frames. |
| Content (10%) | 7.0 | Real first-person copy, customisation note, real photo, counts in the contents list. No price, no order route beyond Instagram, generic title. |

| Developer | Score | Evidence |
|---|---|---|
| Semantics/SEO | 4 | Audit FAIL: 0 h1 (desktop.h1 empty after JS too). No canonical, generic title, no meta description. |
| Animations/Transitions | 6 | h-01 pair tilt and lift, noHoverChange 0, colorOnly 0, scrollFps 60. No transition frames, open-book motion not judged. |
| Accessibility | 5 | axe 0 serious, but skipLinkFirst false, no visible focus in k-01..k-04, reduced.hiddenText 4, 29 contrast items to review. |
| WPO | 7 | Mobile LCP 1052 ms, CLS 0.006, 60 fps, about 1.08 MB. Fonts 1067 KB across 9 TTF files, settle 4.7 to 5.7 s. |
| Responsive | 8 | m-01, m-03: purpose-built phone layout, overflowX false, 0 small targets. |
| Markup/Meta-data | 4 | Audit WARN: no og:title, og:description, og:image, twitter:card, canonical. |

## Fixes, most score gained first
1. [Accessibility, Usability] k-01..k-04: no visible keyboard focus and focus ends in body. Add a 2px high-contrast outline with offset on the book button and every link; keep hidden contents links out of the tab order.
2. [Semantics/SEO] Audit FAIL: no h1. Make the wordmark or maker heading a real h1, with h2s for sections.
3. [Markup/Meta-data] Add canonical, og:title, og:description, og:image (1200x630, the lotus cover photo), twitter:card, a descriptive title and meta description.
4. [Accessibility] Add a skip link and fix reduced.hiddenText = 4 so nothing stays hidden under reduced motion.
5. [Design, Creativity, Content] The interior was not captured. Make sure the opened spread is composed as carefully as the cover, and add an order or enquiry route.
6. [WPO, Usability] Fonts are 1067 KB in 9 TTFs. Subset to woff2, drop weights, and show the book before fonts arrive so the first screen settles under 2.6 s.
7. [Design, Accessibility] d-01: raise contrast of the "click the book to open it" hint and small grey labels to 4.5:1, and give the page an idle cue.
8. [Design] d-01: anchor the maker note to the book (align its top to the cover or the photo).
9. [Content] Add email or order-form link, price ranges and lead times.

## Measured
Mobile LCP 1052 ms, CLS 0.006, mobile and desktop FPS 60, loader none, axe serious 0, overflowX false, noHoverChange 0, colorOnly 0, idleMotion false, audit 1 FAIL and 15 WARN. Page about 1.08 MB, JS 8 KB gz.

Not scored: how motion feels, the open-book animation, sound. The 404 frames show the GitHub Pages root site (a different page), so they carry no weight.
