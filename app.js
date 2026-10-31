import { bookPages, pageIndex, parseRoute, routeHref } from "./route.js";

const app = document.getElementById("app");
const SITE = "Artellum handcraft";
const TILTS = [-1.4, 1.1, -0.8, 1.5, -1.1];
// Used for photos built before frame colours existed; `npm run build` picks one per photo.
const FALLBACK_FRAMES = ["#3a2f28", "#3a2f28", "#c9c3b2", "#3a2f28", "#c9c3b2", "#3a2f28", "#3a2f28"];
const frameOf = (photo, i) => photo.frame ?? FALLBACK_FRAMES[i % FALLBACK_FRAMES.length];
const KIND = { contents: "contents", category: "chapter", photo: "plate", end: "end" };
const MAX_LEAVES = 4; // a long jump riffles a few leaves instead of turning every page
const COVER_Z = [3, 1]; // above the pages while closed, beneath the left-hand page once open
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const spreadMedia = matchMedia("(min-width: 700px) and (min-height: 500px) and (min-aspect-ratio: 5/4)");

let categories = [];
let slugs = [];
let pages = [];
let ui = null;
let shown = -1; // the page on the right-hand side, or -1 while the book is closed
let busy = false;
let blockAt = null;
let leftAt = null;
let coverP = 0;
let coverRun = 0;
let dragEndedAt = -Infinity; // the click that follows a drag is part of the drag, not a tap
const chosen = new Map(); // plate page index → the colour picked there, kept while the pages turn

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const message = (text) => el("p", { className: "message" }, text);
// Not draggable: a mouse drag that starts on a link would pick the link up instead of turning the page.
const link = (route, ...children) => el("a", { href: routeHref(route), draggable: false }, ...children);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (v) => Math.min(1, Math.max(0, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;

function roman(n) {
  let out = "";
  for (const [value, mark] of [[50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]]) {
    for (; n >= value; n -= value) out += mark;
  }
  return out;
}

// Keeps the first and last of a list and spreads the rest evenly, at most `max` in all.
const sample = (list, max) => (list.length <= max ? list : Array.from({ length: max }, (_, k) => list[Math.round((k * (list.length - 1)) / (max - 1))]));

function tween(from, to, ms, frame, ease = easeInOut, live = () => true) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      if (!live()) return resolve();
      const t = ms > 0 ? Math.min(1, (now - t0) / ms) : 1;
      frame(from + (to - from) * ease(t));
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

// p runs from 0, lying on the right, to 1, turned over onto the left. z is the stacking order on each side.
function pose(node, p, z) {
  node.style.transform = `perspective(calc(var(--pw) * 4)) rotateY(${-180 * p}deg)`;
  node.style.setProperty("--lift", Math.sin(Math.PI * p).toFixed(3));
  node.style.zIndex = String(p < 0.5 ? z[0] : z[1]);
}

// The page beneath a turning leaf darkens as the leaf lifts off it.
const shadow = (p) => ui.root.style.setProperty("--shadow", (Math.sin(Math.PI * p) * 0.3).toFixed(3));

function setCover(p) {
  coverRun++;
  coverP = p;
  pose(ui.cover, p, COVER_Z);
}

function animateCover(to, ms, ease) {
  const run = ++coverRun;
  return tween(coverP, to, ms, (p) => { coverP = p; pose(ui.cover, p, COVER_Z); }, ease, () => run === coverRun);
}

// Gives freshly drawn photos a moment to decode, so a turning leaf never reveals an empty print.
function decoded(nodes) {
  const imgs = nodes.flatMap((node) => [...node.querySelectorAll("img")]);
  return Promise.race([wait(250), Promise.all(imgs.map((img) => img.decode().catch(() => {})))]);
}

function contentsPage() {
  const toc = el(
    "ol",
    { className: "toc" },
    ...categories.map((c, i) =>
      el(
        "li",
        {},
        link(
          { view: "category", slug: c.slug },
          el("span", { className: "toc-num" }, roman(i + 1)),
          el("span", { className: "toc-name" }, c.name),
          el("span", { className: "leader" }),
          el("span", { className: "toc-page" }, String(pageIndex(pages, { view: "category", slug: c.slug }) + 1)),
        ),
      ),
    ),
  );
  toc.style.setProperty("--rows", String(Math.max(4, categories.length)));
  return [
    el("p", { className: "sign" }, "Artellum"),
    el("p", { className: "intro" }, "a small collection of handmade things."),
    el("h2", { className: "toc-title" }, "contents"),
    toc,
    el("p", { className: "turn-hint" }, "swipe, or tap the edge of the page, to turn it"),
  ];
}

function chapterPage(page) {
  const category = categories[page.chapter];
  const count = category.photos.length;
  return [
    el("p", { className: "ch-num" }, `chapter ${roman(page.chapter + 1)}`),
    el("h2", { className: "ch-title" }, category.name),
    el("p", { className: "ch-count" }, `${count} ${count === 1 ? "piece" : "pieces"}`),
    el(
      "ul",
      { className: "contact" },
      ...category.photos.slice(0, 6).map((photo) =>
        el("li", {}, link({ view: "photo", slug: category.slug, id: photo.id }, el("img", { src: photo.thumb, alt: photo.title, draggable: false, decoding: "async" }))),
      ),
    ),
  ];
}

// Shows one photo in a plate's print: a single photo, or one colour of a design.
function print(img, image, alt) {
  img.src = image.large;
  img.alt = alt;
  // The small file arrives first and fills the print until the large one loads.
  img.style.backgroundImage = `url("${image.thumb}")`;
}

function platePage(page, i) {
  const { photo } = page;
  const variants = photo.variants ?? [];
  const img = el("img", { width: photo.w, height: photo.h, draggable: false, decoding: "async" });
  const mount = el("figure", { className: "mount" }, img);
  // A design keeps one shape while its colours change; a colour shot the other way fits inside it whole.
  mount.style.setProperty("--r", String(photo.w / photo.h));
  mount.style.setProperty("--tilt", `${TILTS[page.plate % TILTS.length]}deg`);
  mount.style.setProperty("--frame", frameOf(photo, page.plate));
  const parts = [
    el("p", { className: "running" }, el("span", {}, categories[page.chapter].name), el("span", {}, `plate ${page.plate}`)),
    mount,
    el("p", { className: "caption" }, photo.title),
  ];
  if (variants.length < 2) {
    print(img, photo, photo.title);
    return parts;
  }
  const colour = el("p", { className: "plate-colour" });
  const swatches = el("div", { className: "swatches" });
  swatches.setAttribute("role", "group");
  swatches.setAttribute("aria-label", "Colours");
  const pick = (variant) => {
    chosen.set(i, variant);
    print(img, variant, `${photo.title}, ${variant.colour.toLowerCase()}`);
    colour.textContent = variant.colour;
    for (const b of swatches.children) b.setAttribute("aria-pressed", String(b.dataset.id === variant.id));
  };
  for (const variant of variants) {
    const b = el("button", { className: "swatch", type: "button", title: variant.colour }, el("span", {}, el("img", { src: variant.swatch, alt: "", draggable: false, decoding: "async" })));
    b.dataset.id = variant.id;
    b.setAttribute("aria-label", variant.colour);
    b.addEventListener("click", (e) => {
      // A swatch is not a tap on the page edge, so the page stays put.
      e.stopPropagation();
      if (performance.now() - dragEndedAt < 400 || chosen.get(i) === variant) return;
      pick(variant);
      if (!reducedMotion.matches) img.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 280, easing: "ease-out" });
    });
    swatches.append(b);
  }
  pick(chosen.get(i) ?? variants[0]);
  mount.classList.add("has-colours");
  // Room under the print for the swatches; the page fits 11 to a row.
  mount.style.setProperty("--swatch-rows", String(Math.ceil(variants.length / 11)));
  return [...parts, colour, swatches];
}

function endPage() {
  return [
    el("p", { className: "end-line" }, "thank you for looking."),
    el("p", { className: "sign" }, "Artellum"),
    el("p", { className: "end-links" }, link({ view: "contents" }, "back to contents"), link({ view: "cover" }, "close the book")),
  ];
}

function pageNode(i) {
  const page = pages[i];
  const parts = page.view === "contents" ? contentsPage() : page.view === "category" ? chapterPage(page) : page.view === "photo" ? platePage(page, i) : endPage();
  return el("article", { className: `page ${KIND[page.view]}` }, ...parts, el("span", { className: "folio" }, String(i + 1)));
}

// The back of page i, which faces page i + 1 across the spread.
function versoNode(i) {
  const next = pages[i + 1];
  const verso = (...children) => el("article", { className: "page verso" }, ...children);
  if (next?.view === "photo") {
    const colours = next.photo.variants?.length ?? 1;
    return verso(
      el("p", { className: "v-chapter" }, categories[next.chapter].name),
      el("p", { className: "v-title" }, next.photo.title),
      el("p", { className: "v-plate" }, colours > 1 ? `plate ${next.plate} · ${colours} colours` : `plate ${next.plate}`),
    );
  }
  if (next?.view === "category") return verso(el("p", { className: "v-numeral" }, roman(next.chapter + 1)));
  return verso(el("p", { className: "v-mark" }, "✦"));
}

function coverFront() {
  const photo = categories[0].photos[0];
  const open = el("button", { className: "cover-open", type: "button" });
  open.setAttribute("aria-label", "Open the book");
  return el(
    "div",
    { className: "cover-art" },
    el("p", { className: "cover-sign" }, "Artellum"),
    el("p", { className: "cover-trade" }, "handcraft"),
    el("figure", { className: "cover-photo" }, el("img", { src: photo.large, alt: "", draggable: false, decoding: "async" })),
    el("p", { className: "cover-line" }, "a small collection of handmade things"),
    open,
  );
}

function endpaper() {
  return el("div", { className: "endpaper" }, el("div", { className: "ex-libris" }, el("span", {}, "ex libris"), el("span", { className: "sign" }, "Artellum")));
}

const leafNode = (front, back, className = "leaf") =>
  el("div", { className }, el("div", { className: "face front" }, front), el("div", { className: "face back" }, back));

function buildBook() {
  const button = (className, label, text) => {
    const b = el("button", { className, type: "button" }, text);
    b.setAttribute("aria-label", label);
    return b;
  };
  const block = el("div", { className: "block" });
  const left = el("div", { className: "left" });
  left.setAttribute("aria-hidden", "true");
  const cover = leafNode(coverFront(), endpaper(), "leaf cover");
  const root = el("div", { className: "book still", tabIndex: -1 }, block, left, cover);
  root.dataset.state = "closed";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "Artellum handcraft, a book of pieces");
  const controls = {
    contents: button("ctl-contents", "Contents", "contents"),
    prev: button("ctl-prev", "Previous page", "‹"),
    counter: el("span", { className: "counter" }),
    next: button("ctl-next", "Next page", "›"),
    close: button("ctl-close", "Close the book", "×"),
  };
  const bar = el("nav", { className: "controls" }, controls.contents, controls.prev, controls.counter, controls.next, controls.close);
  bar.setAttribute("aria-label", "Pages");
  // The about label lives in index.html so its words are easy to edit; beside the book on a wide screen, below it on a phone.
  const about = document.getElementById("about");
  const toAbout = el("button", { className: "to-about", type: "button" }, "about the maker ↓");
  toAbout.addEventListener("click", () => about.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" }));
  const hint = el("div", { className: "hint" }, el("p", {}, `${matchMedia("(hover: hover)").matches ? "click" : "tap"} the book to open it`), toAbout);
  const status = el("p", { className: "sr-only" });
  status.setAttribute("aria-live", "polite");
  const scene = el("div", { className: "scene" }, el("div", { className: "stage" }, root), el("div", { className: "foot" }, hint, bar), about, status);
  return { scene, root, block, left, cover, bar, hint, about, status, ...controls };
}

function setBlock(i, node) {
  if (blockAt === i && !node) return;
  ui.block.replaceChildren(node ?? pageNode(i));
  blockAt = i;
}

// The left-hand page while page i is on the right: the back of the leaf before it, or the inside of the cover.
function setLeft(i, node) {
  ui.left.hidden = i <= 0;
  if (i <= 0 || (leftAt === i && !node)) return;
  ui.left.replaceChildren(node ?? versoNode(i - 1));
  leftAt = i;
}

function titleOf(page) {
  if (!page || page.view === "end") return SITE;
  if (page.view === "contents") return `contents · ${SITE}`;
  const name = categories[page.chapter].name.toLowerCase();
  return page.view === "photo" ? `${page.photo.title} · ${name} · ${SITE}` : `${name} · ${SITE}`;
}

function updateUi() {
  const open = shown !== -1;
  ui.scene.classList.toggle("is-open", open);
  ui.bar.inert = !open;
  ui.hint.inert = open;
  ui.about.inert = open;
  ui.contents.disabled = shown <= 0;
  // Going back from the first page closes the book.
  ui.prev.disabled = !open;
  ui.prev.setAttribute("aria-label", shown === 0 ? "Close the book" : "Previous page");
  ui.next.disabled = !open || shown >= pages.length - 1;
  ui.counter.textContent = open ? `${shown + 1} / ${pages.length}` : "";
  ui.status.textContent = open ? `page ${shown + 1} of ${pages.length}` : "";
  document.title = titleOf(pages[shown]);
}

function land(i) {
  setBlock(i);
  setLeft(i);
  shown = i;
  updateUi();
  for (const next of pages.slice(i + 1, i + 3)) if (next.photo) new Image().src = next.photo.large;
}

// Lays out the leaves that move between page `from` and page `target`, in the order they move.
function beginTurn(from, target) {
  const dir = Math.sign(target - from);
  const order = [];
  if (dir > 0) for (let i = from; i < target; i++) order.push(i);
  else for (let i = from - 1; i >= target; i--) order.push(i);
  const leaves = sample(order, MAX_LEAVES).map((i, k) => {
    // The leaf already on show is moved rather than redrawn, so its photo does not flash.
    const front = dir > 0 && k === 0 ? ui.block.firstChild : pageNode(i);
    const back = dir < 0 && k === 0 ? ui.left.firstChild ?? versoNode(i) : versoNode(i);
    const node = leafNode(front, back);
    node.inert = true;
    ui.root.append(node);
    // The first leaf to move starts on top; the last to land ends on top.
    return { node, z: dir > 0 ? [100 - k, 100 + k] : [100 + k, 100 - k] };
  });
  const start = dir > 0 ? 0 : 1;
  for (const { node, z } of leaves) pose(node, start, z);
  // The page that moved onto the leaf has left its old place empty, so that place is drawn afresh next time.
  if (dir > 0) blockAt = null;
  else leftAt = null;
  if (dir > 0) setBlock(target);
  else setLeft(target);
  return { from, target, dir, leaves, start, end: 1 - start };
}

function endTurn(turn, done) {
  const { leaves, dir } = turn;
  const face = (k, side) => leaves[k].node.querySelector(`:scope > .${side}`).firstChild;
  if (done && dir > 0) setLeft(turn.target, face(leaves.length - 1, "back"));
  else if (done) setBlock(turn.target, face(leaves.length - 1, "front"));
  else if (dir > 0) setBlock(turn.from, face(0, "front"));
  else setLeft(turn.from, face(0, "back"));
  for (const { node } of leaves) node.remove();
  shadow(0);
  if (done) land(turn.target);
}

async function turnTo(target, instant) {
  if (instant) return land(target);
  const turn = beginTurn(shown, target);
  await decoded([ui.block, ...turn.leaves.map((l) => l.node)]);
  const ms = turn.leaves.length > 1 ? 620 : 760;
  await Promise.all(
    turn.leaves.map(({ node, z }, k) =>
      wait(k * 110).then(() => tween(turn.start, turn.end, ms, (p) => { pose(node, p, z); if (k === 0) shadow(p); })),
    ),
  );
  endTurn(turn, true);
}

async function openBook(target, instant) {
  ui.root.dataset.state = "opening";
  ui.cover.inert = true;
  land(target);
  // On a phone the about label may have been scrolled into view; the open book fills the screen.
  ui.scene.scrollTo({ top: 0, behavior: instant ? "auto" : "smooth" });
  if (instant) setCover(1);
  else await animateCover(1, 1150);
  ui.root.dataset.state = "open";
  if (!instant) ui.root.focus({ preventScroll: true });
}

async function closeBook(instant) {
  const hadFocus = ui.scene.contains(document.activeElement);
  ui.root.dataset.state = "closing";
  ui.cover.inert = false;
  setLeft(0); // the inside of the cover shows as it lifts
  shown = -1;
  updateUi();
  // The hint takes the arrows' place, so it waits for the cover to settle; a quick second tap on ‹ should not land on it.
  ui.hint.inert = true;
  if (instant) setCover(0);
  else await animateCover(0, 1050);
  ui.hint.inert = false;
  ui.root.dataset.state = "closed";
  setBlock(0);
  if (hadFocus) ui.cover.querySelector(".cover-open").focus({ preventScroll: true });
}

let first = true;
async function sync() {
  if (busy) return;
  let route = parseRoute(location.hash, slugs);
  let target = route.view === "cover" ? -1 : pageIndex(pages, route);
  if (route.view !== "cover" && target === -1) {
    // A photo that is no longer in the book: open its chapter instead.
    route = { view: "category", slug: route.slug };
    target = pageIndex(pages, route);
    history.replaceState(history.state, "", routeHref(route));
  }
  const instant = first || reducedMotion.matches;
  first = false;
  if (target === shown) return;
  busy = true;
  try {
    if (target === -1) await closeBook(instant);
    else if (shown === -1) await openBook(target, instant);
    else await turnTo(target, instant);
  } finally {
    busy = false;
  }
  // Catch up with any taps or history moves made while the page was turning.
  sync();
}

// Turning pages replaces the history entry, so the back button always closes the book.
function go(route) {
  if (route.view === "cover") return close();
  history.replaceState(history.state, "", routeHref(route));
  sync();
}

function openFromCover() {
  history.pushState({ opened: true }, "", routeHref({ view: "contents" }));
  sync();
}

let leaving = false; // a history.back() is on its way; a second one would leave the site
function close() {
  if (leaving) return;
  if (history.state?.opened) {
    leaving = true;
    history.back();
  } else {
    history.replaceState(null, "", routeHref({ view: "cover" }));
    sync();
  }
}

// Steps from the page being turned to, so quick taps add up. Stepping back from the first page closes the book.
function step(d) {
  const route = parseRoute(location.hash, slugs);
  if (shown === -1 || route.view === "cover") return;
  const at = pageIndex(pages, route);
  const next = (at === -1 ? shown : at) + d;
  if (next < 0) close();
  else if (next < pages.length) go(pages[next]);
}

async function peek(to, ms) {
  if (busy || shown !== -1 || reducedMotion.matches) return;
  await animateCover(to, ms, easeOut);
}

function onBookClick(e) {
  if (performance.now() - dragEndedAt < 400) {
    e.preventDefault();
    return;
  }
  const a = e.target.closest("a[href]");
  if (a) {
    e.preventDefault();
    go(parseRoute(a.getAttribute("href"), slugs));
    return;
  }
  if (shown === -1) return openFromCover();
  // Taps near the outer edges turn the page; the right-hand page spans 0..1, the left-hand page sits below 0.
  const box = ui.root.getBoundingClientRect();
  const x = (e.clientX - box.left) / box.width;
  if (x < 0.3) step(-1);
  else if (x > 0.6) step(1);
}

function onKey(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === "ArrowRight") shown === -1 ? openFromCover() : step(1);
  else if (e.key === "ArrowLeft") step(-1);
  else if (e.key === "Escape" && shown !== -1) close();
  else return;
  e.preventDefault();
}

// Dragging sideways lifts the page under the finger; letting go finishes the turn or lays it back down.
function wireDrag() {
  let drag = null;
  const span = () => ui.root.offsetWidth * (ui.scene.classList.contains("spread") ? 1.5 : 1);
  ui.root.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: e.timeStamp, v: 0, p: 0, turn: null, swipe: false };
  });
  ui.root.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (e.timeStamp > drag.lastT) {
      drag.v = (e.clientX - drag.lastX) / (e.timeStamp - drag.lastT);
      drag.lastX = e.clientX;
      drag.lastT = e.timeStamp;
    }
    if (!drag.turn && !drag.swipe) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      const target = shown + (dx < 0 ? 1 : -1);
      // Mid-turn, closed, at either end or with reduced motion, the gesture counts as a plain swipe on release.
      if (busy || shown === -1 || reducedMotion.matches || target < 0 || target >= pages.length) {
        drag.swipe = true;
        return;
      }
      busy = true;
      drag.turn = beginTurn(shown, target);
      // Touch is captured already; a mouse needs it to keep turning once it leaves the book.
      try { ui.root.setPointerCapture(e.pointerId); } catch {}
    }
    if (!drag.turn) return;
    const { dir, leaves } = drag.turn;
    drag.p = clamp(dir > 0 ? -dx / span() : 1 - dx / span());
    pose(leaves[0].node, drag.p, leaves[0].z);
    shadow(drag.p);
  });
  const release = async (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { turn, p, v, swipe, x } = drag;
    const dx = e.clientX - x;
    drag = null;
    if (!turn) {
      if (swipe && Math.abs(dx) > 40 && e.type === "pointerup") {
        dragEndedAt = performance.now();
        if (shown === -1) openFromCover();
        else step(dx < 0 ? 1 : -1);
      }
      return;
    }
    dragEndedAt = performance.now();
    const done = e.type === "pointerup" && (turn.dir > 0 ? p > 0.3 || v < -0.35 : p < 0.7 || v > 0.35);
    const to = done ? turn.end : turn.start;
    const { node, z } = turn.leaves[0];
    // Set the address before the page settles, so a tap on an arrow meanwhile steps from the new page.
    if (done) history.replaceState(history.state, "", routeHref(pages[turn.target]));
    await tween(p, to, 140 + 380 * Math.abs(to - p), (q) => { pose(node, q, z); shadow(q); }, easeOut);
    endTurn(turn, done);
    busy = false;
    sync();
  };
  ui.root.addEventListener("pointerup", release);
  ui.root.addEventListener("pointercancel", release);
}

function wire() {
  ui.contents.addEventListener("click", () => go({ view: "contents" }));
  ui.prev.addEventListener("click", () => step(-1));
  ui.next.addEventListener("click", () => step(1));
  ui.close.addEventListener("click", close);
  ui.root.addEventListener("click", onBookClick);
  // A mouse resting on the closed book lifts the cover a touch.
  ui.root.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") peek(0.05, 320); });
  ui.root.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") peek(0, 320); });
  addEventListener("keydown", onKey);
  addEventListener("hashchange", () => {
    leaving = false;
    sync();
  });
  spreadMedia.addEventListener("change", layout);
  wireDrag();
}

function layout() {
  ui.scene.classList.toggle("spread", spreadMedia.matches);
  // A phone scrolled down to the about label, then turned sideways, would otherwise keep that offset.
  ui.scene.scrollTop = 0;
}

async function start() {
  try {
    const res = await fetch("photos.json");
    if (!res.ok) throw new Error(res.statusText);
    categories = (await res.json()).categories;
  } catch {
    app.replaceChildren(message("couldn't load the gallery. please refresh."));
    return;
  }
  if (!categories.length) {
    app.replaceChildren(message("pieces are on their way."));
    return;
  }
  slugs = categories.map((c) => c.slug);
  pages = bookPages(categories);
  ui = buildBook();
  app.replaceChildren(ui.scene);
  layout();
  setBlock(0);
  setCover(0);
  updateUi();
  wire();
  await sync();
  requestAnimationFrame(() => requestAnimationFrame(() => ui.root.classList.remove("still")));
  // Lift the cover a little once, so it reads as something to open.
  if (shown === -1) {
    await wait(1400);
    await peek(0.1, 460);
    await peek(0, 700);
  }
}

start();
