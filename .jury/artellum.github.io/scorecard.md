# artellum.github.io: jury score
Estimate, not affiliated with Awwwards. Independent critic, from 1 page (home) on 2026-11-03.

**The idea, as the critic read it:** a quiet online catalogue of handmade Indian craft pieces shown as tilted, stacked polaroid prints on a sage paper-grain wall, with a category index on top and a masonry "all pieces" grid below.
**Critic overall: 5.95** (0.4 x 6.5 Design + 0.3 x 5.5 Usability + 0.2 x 6.0 Creativity + 0.1 x 5.0 Content, on the critic's strict scale)
**Jury estimate: about 7.1** (critic + 1.1, an offset measured on two Sites of the Day only)
**Band, from the estimate:** Honorable Mention range (6.5 to 7.1), at the top edge. The critic's own number sits below the 6.5 bar.

| Criterion | Score | Evidence |
|---|---|---|
| Design (40%) | 6.5 | d-01-hero: coherent tactile system, script wordmark, lowercase serif index, grained sage ground, tilted shadowed prints. Orange silk against sage is recognisable (d-02, d-04). Weak: right 40% of the desktop hero is empty, no display-scale type moment, no footer or end state (d-07). |
| Usability (30%) | 5.5 | Orientation instant (d-01, m-01), mobile 2-column grid composed, focus rings clear (k-02, k-04). Against: no contact or order path anywhere, no skip link, throttled mobile LCP 6060 ms, mobile settledMs 9416. |
| Creativity (20%) | 6.0 | Polaroid and scrapbook handling suits handmade craft but is a familiar tilted-print masonry grid, not carried into layout or motion. |
| Content (10%) | 5.0 | One tagline, audit says 10 words of visible text. Photography is real and consistent. No maker story, materials, prices or process. |

| Developer | Score | Evidence |
|---|---|---|
| Semantics/SEO | 4 | Audit FAIL: 0 h1 (also empty after JS). No canonical, robots.txt or sitemap, thin content. |
| Animations/Transitions | 5.5 | h-01, h-02: rows and prints move on hover, subtly. noHoverChange 1: the logo link (h-03). idleMotion false. No transitions to judge. |
| Accessibility | 6 | axe 0 serious, focus visible on every stop, reduced.hiddenText 0, reduced.moving false. No skip link, 12 contrast items to review. |
| WPO | 5 | Desktop LCP 2232 ms, mobile LCP 6060 ms (an image), CLS 0.004. Fonts 1067 KB in 9 TTFs. |
| Responsive | 7.5 | m-01, m-03 designed, not squished. overflowX false, 0 small targets. |
| Markup/Meta-data | 3.5 | Audit WARN: no og:title, og:description, og:image, twitter:card, canonical. |

## Fixes, most score gained first
1. [Content, Usability] d-07, m-06: nothing to act on. Add a short maker note (who, materials, lead time) and an enquiry route (WhatsApp, Instagram or email) in a footer; add caption, size and price or "made to order" per piece.
2. [Semantics/SEO] Audit FAIL: no h1. Make the wordmark or tagline an h1; add canonical, robots.txt, sitemap and a meta description.
3. [Markup/Meta-data] Add og:title, og:description, og:image (1200x630), twitter:card and canonical.
4. [WPO] Mobile LCP is 6060 ms. Serve responsive AVIF or WebP with srcset, fetchpriority high on the first visible print, lazy-load the grid, and convert the 9 TTFs to subsetted woff2 with font-display swap.
5. [Design] d-01-hero: the index fills a 760 px column and the right 40% is blank. Use the space, add one large-scale type moment, and give the page an intentional ending (d-07).
6. [Animations] h-03: the logo link has no hover response. Give it a tilt or lift. Strengthen the row and print lift (h-01, h-02).
7. [Accessibility] Add a skip link as the first focus stop and review the 12 contrast items (mono counts, "N colours" tags).
8. [Usability, Creativity] Make category rows filter or anchor the grid and show state.
9. [Design] Add a custom 404 in the site's style.

## Measured
Mobile LCP 6060 ms, CLS 0.004, mobile FPS 61 and desktop 60, no loader, mobile settledMs 9416, axe serious 0, overflowX false, noHoverChange 1, colorOnly 0, idleMotion false, audit 1 FAIL and 18 WARN. Page about 1.08 MB, JS 4 KB gz.

Not scored: how motion feels, sound. The 404 is the GitHub Pages default and was not allowed to move the score.
