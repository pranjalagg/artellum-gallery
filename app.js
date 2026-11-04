// Artellum gallery. Every page is real HTML (scripts/pages.mjs); this file adds the motion, the
// hero plate, the wall's columns, colour swatches, and moves between pages without a reload.
// One clock: everything that moves runs on gsap.ticker. Under reduced motion nothing animates.

const gsap = window.gsap;
const html = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const coarse = matchMedia("(hover: none), (pointer: coarse)");
const motion = () => !!gsap && !reduced.matches;
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Links from the first QR card used hash routes: #/tea-lights/lotus. Send them to the real page.
if (/^#\/./.test(location.hash)) {
  const parts = location.hash.slice(2).split("/").filter(Boolean).map(encodeURIComponent);
  location.replace(new URL(`${parts.join("/")}/`, location.href.split("#")[0]).href);
}

if (!gsap) html.classList.remove("motion");

// Pages are swapped without a reload, so links in <head> (icons) must not depend on the current folder.
document.head.querySelectorAll("link[href]").forEach((l) => l.setAttribute("href", l.href));

/* ---------- scroll ---------- */
let lenis = null;
let menuOpen = false;
function initScroll() {
  if (!gsap) return;
  if (!reduced.matches && !coarse.matches && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.11, wheelMultiplier: 1 });
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  // The header steps aside while you scroll down and comes back when you scroll up.
  let last = scrollY;
  gsap.ticker.add(() => {
    const y = scrollY;
    if (Math.abs(y - last) < 6) return;
    html.classList.toggle("top-away", y > 220 && y > last && !menuOpen);
    last = y;
  });
}
function scrollToY(y) {
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else scrollTo(0, y);
}
function scrollToEl(el, { smooth = true } = {}) {
  if (!el) return;
  if (lenis && smooth) lenis.scrollTo(el, { offset: -72, duration: 1.2 });
  else el.scrollIntoView({ behavior: smooth && motion() ? "smooth" : "auto" });
}

/* ---------- halftone: the site's one reveal ---------- */
// A screen of dots grows until the dots merge, while a disc fills from the centre.
function cellOf(el) {
  return parseFloat(getComputedStyle(el).getPropertyValue("--ht-cell")) || 12;
}
function halftoneIn(el, { delay = 0, duration = 1.1 } = {}) {
  if (!el || el.classList.contains("is-in")) return Promise.resolve();
  if (!motion()) {
    el.classList.add("is-in");
    return Promise.resolve();
  }
  const full = cellOf(el) * 0.71 + 1;
  return new Promise((resolve) => {
    gsap.timeline({
      delay,
      onComplete: () => {
        el.classList.add("is-in");
        el.style.removeProperty("--ht-dot");
        el.style.removeProperty("--ht-fill");
        resolve();
      },
    })
      .fromTo(el, { "--ht-dot": "-1px" }, { "--ht-dot": `${full}px`, duration: duration * 0.85, ease: "power2.out" }, 0)
      .fromTo(el, { "--ht-fill": "0%" }, { "--ht-fill": "112%", duration: duration * 0.75, ease: "power2.in" }, duration * 0.25);
  });
}
function halftoneOut(el, duration = 0.4) {
  if (!el || !motion()) return Promise.resolve();
  const full = cellOf(el) * 0.71 + 1;
  gsap.set(el, { "--ht-dot": `${full}px`, "--ht-fill": "0%" });
  el.classList.remove("is-in");
  return new Promise((resolve) => gsap.to(el, { "--ht-dot": "-1px", duration, ease: "power2.in", onComplete: resolve }));
}
const loaded = (img) => (img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => {}));

function initReveals(root) {
  const items = [...root.querySelectorAll("[data-ht]")];
  if (!motion()) {
    items.forEach((el) => el.classList.add("is-in"));
    return null;
  }
  const intro = items.filter((el) => el.hasAttribute("data-intro"));
  intro.forEach((el, i) => {
    const go = () => halftoneIn(el, { delay: parseFloat(el.dataset.delay || "0") + i * 0.06, duration: el.tagName === "IMG" ? 1 : 0.9 });
    if (el.tagName === "IMG") loaded(el).then(go);
    else go();
  });
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const el = e.target;
        if (el.tagName === "IMG") loaded(el).then(() => halftoneIn(el, { duration: 0.9 }));
        else halftoneIn(el);
      }
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.01 },
  );
  items.filter((el) => !el.hasAttribute("data-intro")).forEach((el) => io.observe(el));
  return () => io.disconnect();
}

/* ---------- the wall: laid out by wall.js (inline, before the first paint); here, again on resize ---------- */
const WALL_WIDTHS = [matchMedia("(min-width: 760px)"), matchMedia("(min-width: 1180px)")];
function initWall(root) {
  const walls = [...root.querySelectorAll("[data-wall]")];
  const lay = window.artellumWall?.lay;
  if (!walls.length || !lay) return null;
  const relay = () => walls.forEach((w) => lay(w));
  relay(); // pages swapped in without a reload arrive with their walls not yet laid
  WALL_WIDTHS.forEach((w) => w.addEventListener("change", relay));
  return () => WALL_WIDTHS.forEach((w) => w.removeEventListener("change", relay));
}

/* ---------- the plate: a real piece redrawn in dots, painted ring by ring from the centre ---------- */
const RINGS = 24;
const RING_T = 0.072; // seconds the brush takes to go round one ring
const GROW = 0.42; // seconds for one dot to land
const easeBack = (p) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};
function plateGeometry() {
  const dots = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k <= RINGS; k++) {
    const n = k === 0 ? 1 : Math.round(2 * Math.PI * k);
    const size = k === 0 ? 0.48 : [0.47, 0.37, 0.42][k % 3];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + k * 0.61;
      dots.push({ k, x: k * Math.cos(a), y: k * Math.sin(a), size: size * (0.93 + rand() * 0.14), delay: k * RING_T + (j / n) * RING_T });
    }
  }
  return dots;
}
// Each dot takes the colour under it in the photo: a 3 by 3 average at four times the dot grid,
// lifted a little in saturation, as paint is brighter than a photo of paint.
function sampleColours(img, plate, dots) {
  const scale = 4;
  const n = (RINGS * 2 + 1) * scale;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const cx = c.getContext("2d", { willReadFrequently: true });
  const R = plate.r * img.naturalWidth;
  cx.imageSmoothingQuality = "high";
  cx.drawImage(img, plate.cx * img.naturalWidth - R, plate.cy * img.naturalHeight - R, R * 2, R * 2, 0, 0, n, n);
  const data = cx.getImageData(0, 0, n, n).data;
  const out = new Uint8ClampedArray(dots.length * 3);
  dots.forEach((d, i) => {
    const px = Math.round((RINGS + d.x + 0.5) * scale);
    const py = Math.round((RINGS + d.y + 0.5) * scale);
    let r = 0, g = 0, b = 0, m = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const o = (clamp(py + oy, 0, n - 1) * n + clamp(px + ox, 0, n - 1)) * 4;
        r += data[o]; g += data[o + 1]; b += data[o + 2]; m++;
      }
    }
    r /= m; g /= m; b /= m;
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    const lift = (v) => clamp(l + (v - l) * 1.3, 0, 255);
    out.set([lift(r), lift(g), lift(b)], i * 3);
  });
  return out;
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// The 404's blank plate: the hero's rings of dots, drawn empty.
function initBlank(root) {
  const canvas = root.querySelector("[data-blank]");
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  const dots = plateGeometry();
  const draw = () => {
    const size = canvas.getBoundingClientRect().width;
    if (!size) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = size / (RINGS * 2 + 1);
    ctx.strokeStyle = "rgba(33,29,25,0.42)";
    ctx.lineWidth = Math.max(0.8, s * 0.09);
    for (const d of dots) {
      ctx.beginPath();
      ctx.arc(size / 2 + d.x * s, size / 2 + d.y * s, d.size * s * 0.82, 0, Math.PI * 2);
      ctx.stroke();
    }
    canvas.closest(".lost__plate")?.classList.add("is-drawn");
  };
  const ro = new ResizeObserver(draw);
  ro.observe(canvas);
  return () => ro.disconnect();
}

function initPlate(root) {
  const fig = root.querySelector("[data-plate]");
  if (!fig) return null;
  const canvas = fig.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const plates = JSON.parse(fig.querySelector("[data-plates]").textContent);
  const link = fig.querySelector("[data-plate-link]");
  const count = fig.querySelector("[data-plate-count]");
  const nextBtn = fig.querySelector("[data-plate-next]");
  const dots = plateGeometry();
  const total = dots.length.toLocaleString("en-GB");
  const animated = motion();

  let index = 0;
  let from = null; // colours before the brush passes
  let to = null; // colours after
  let start = -1; // clock time the brush set off; -1: nothing painted yet
  let size = 0;
  let dpr = 1;
  let visible = true;
  let busy = false;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, on: 0, target: 0 };
  const ripples = [];
  const now = () => (gsap ? gsap.ticker.time : performance.now() / 1000);

  const describe = (p) => {
    canvas.setAttribute("aria-label", `${p.title}, redrawn in ${total} dots from its photo`);
    link.textContent = p.title;
    link.href = p.href;
    link.dataset.drop = p.colour;
    count.textContent = `redrawn from its photo in ${total} dots`;
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    size = rect.width;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    cache = null;
    draw(now());
  }

  // Once the brush has finished, the painted plate is kept as a bitmap. A frame at rest is then that
  // bitmap plus only the dots the glint, the pointer or a ripple is touching: cheap on a slow phone.
  const done = RINGS * RING_T + GROW;
  let cache = null;
  const dotPath = (target, d, s, c, scale) => {
    target.beginPath();
    target.arc(c + d.x * s, c + d.y * s, Math.max(0, d.size * s * scale), 0, Math.PI * 2);
    target.fill();
  };
  const fill = (target, src, i, light) => {
    const o = i * 3;
    let r = src[o];
    let g = src[o + 1];
    let b = src[o + 2];
    if (light > 0.005) {
      r += (255 - r) * light;
      g += (255 - g) * light;
      b += (255 - b) * light;
    }
    target.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
  };
  function paintStill(target, s, c) {
    target.fillStyle = "#211d19";
    target.beginPath();
    target.arc(c, c, (RINGS + 0.62) * s, 0, Math.PI * 2);
    target.fill();
    for (let i = 0; i < dots.length; i++) {
      fill(target, to, i, 0);
      dotPath(target, dots[i], s, c, 1);
    }
  }
  function buildCache(s, c) {
    cache = document.createElement("canvas");
    cache.width = canvas.width;
    cache.height = canvas.height;
    const cc = cache.getContext("2d");
    cc.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintStill(cc, s, c);
  }

  function draw(t) {
    if (!size || !to) return;
    const s = size / (RINGS * 2 + 1);
    const c = size / 2;
    if (!animated) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      paintStill(ctx, s, c);
      return;
    }
    pointer.x += (pointer.tx - pointer.x) * 0.16;
    pointer.y += (pointer.ty - pointer.y) * 0.16;
    pointer.on += (pointer.target - pointer.on) * 0.08;
    for (let i = ripples.length - 1; i >= 0; i--) if (t - ripples[i].t > 2.4) ripples.splice(i, 1);
    const settled = t - start > done;
    if (settled) {
      if (!cache) buildCache(s, c);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(cache, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      cache = null;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      // the kohl base coat goes down just ahead of the brush, as on the real pieces
      const front = (t - start) / RING_T + 1.2;
      if (front > 0) {
        ctx.fillStyle = "#211d19";
        ctx.beginPath();
        ctx.arc(c, c, Math.min(RINGS + 0.62, from ? RINGS + 0.62 : front) * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // at rest: a glint travels outward through the rings every twelve seconds, like light over wet paint and mirror
    const glint = (k) => Math.max(0, Math.sin(t * 0.5 - k * 0.2)) ** 16;
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      let scale = 1;
      let src = to;
      if (!settled) {
        const p = (t - start - d.delay) / GROW;
        if (p >= 1) scale = 1;
        else if (!from) {
          if (p <= 0) continue;
          scale = easeBack(p);
        } else if (p <= 0) src = from;
        else if (p < 0.38) {
          src = from;
          scale = 1 - 0.85 * (p / 0.38) ** 2;
        } else scale = 0.15 + 0.85 * easeBack((p - 0.38) / 0.62);
      }
      const g = glint(d.k);
      let extra = 0.14 * g;
      if (pointer.on > 0.01) {
        const dx = d.x - pointer.x;
        const dy = d.y - pointer.y;
        extra += pointer.on * 0.6 * Math.exp(-(dx * dx + dy * dy) / 10);
      }
      for (const r of ripples) {
        const age = t - r.t;
        const dist = Math.hypot(d.x - r.x, d.y - r.y) - age * 16;
        extra += 0.75 * Math.exp(-(dist * dist) / 2.2) * Math.exp(-age * 1.3);
      }
      // over the cached plate, only the dots something is happening to are drawn again
      if (settled && extra < 0.015) continue;
      fill(ctx, src, i, 0.32 * g);
      dotPath(ctx, d, s, c, scale + extra);
    }
  }

  const tick = () => draw(now());
  let ticking = false;
  const run = (on) => {
    if (!animated || on === ticking) return;
    ticking = on;
    if (on) gsap.ticker.add(tick);
    else gsap.ticker.remove(tick);
  };

  let queued = false;
  async function paint(i, { first = false } = {}) {
    if (busy) {
      queued = true; // pressed while the brush is still going round: paint the next one straight after
      return;
    }
    busy = true;
    const p = plates[i];
    try {
      const img = await loadImage(p.src);
      const colours = sampleColours(img, p, dots);
      from = first ? null : to;
      to = colours;
      cache = null;
      start = now() + (first ? 0.15 : 0);
      index = i;
      describe(p);
      if (!animated) draw(now());
      // the next one is ready before anyone asks
      loadImage(plates[(i + 1) % plates.length].src).catch(() => {});
    } catch {
      /* the empty plate stays: the caption still names the piece */
    }
    await wait(animated ? RINGS * RING_T + GROW : 0);
    busy = false;
    if (queued) {
      queued = false;
      paint((index + 1) % plates.length);
    }
  }

  const onMove = (e) => {
    if (!size) return;
    const rect = canvas.getBoundingClientRect();
    const s = size / (RINGS * 2 + 1);
    pointer.tx = (e.clientX - rect.left - size / 2) / s;
    pointer.ty = (e.clientY - rect.top - size / 2) / s;
    if (e.pointerType === "mouse") pointer.target = 1;
  };
  const onLeave = () => (pointer.target = 0);
  const onDown = (e) => {
    onMove(e);
    ripples.push({ x: pointer.tx, y: pointer.ty, t: now() });
  };
  const onNext = () => paint((index + 1) % plates.length);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);
  nextBtn.addEventListener("click", onNext);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    run(visible);
  });
  io.observe(canvas);
  resize();
  paint(0, { first: true });
  return () => {
    run(false);
    ro.disconnect();
    io.disconnect();
    nextBtn.removeEventListener("click", onNext);
  };
}

/* ---------- buttons: kohl floods the circle from the side the pointer came in ---------- */
function initFills(root) {
  if (!motion() || coarse.matches) return null;
  const offs = [];
  root.querySelectorAll(".btn, .pager__link").forEach((el) => {
    const fill = el.querySelector(".btn__fill");
    if (!fill) return;
    const box = fill.parentElement;
    // The fill starts where the pointer came in, clamped to the circle it fills, and grows to its farthest corner.
    const at = (e) => {
      const r = box.getBoundingClientRect();
      const x = e ? clamp(e.clientX - r.left, 0, r.width) : r.width / 2;
      const y = e ? clamp(e.clientY - r.top, 0, r.height) : r.height / 2;
      return { p: `${x}px ${y}px`, reach: Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) + 2 };
    };
    let closed = true;
    const open = (e) => {
      const { p, reach } = at(e);
      if (closed) gsap.set(fill, { clipPath: `circle(0px at ${p})` });
      closed = false;
      el.classList.add("is-filled");
      gsap.to(fill, { clipPath: `circle(${reach}px at ${p})`, duration: 0.5, ease: "power3.out", overwrite: true });
    };
    const close = (e) => {
      el.classList.remove("is-filled");
      gsap.to(fill, { clipPath: `circle(0px at ${at(e).p})`, duration: 0.4, ease: "power3.out", overwrite: true, onComplete: () => (closed = true) });
    };
    const focus = () => el.matches(":focus-visible") && open();
    const blur = () => close();
    el.addEventListener("pointerenter", open);
    el.addEventListener("pointerleave", close);
    el.addEventListener("focus", focus);
    el.addEventListener("blur", blur);
    offs.push(() => {
      el.removeEventListener("pointerenter", open);
      el.removeEventListener("pointerleave", close);
      el.removeEventListener("focus", focus);
      el.removeEventListener("blur", blur);
    });
  });
  return () => offs.forEach((f) => f());
}

/* ---------- a piece: its colours, the pager, arrow keys and swipes ---------- */
function initPiece(root) {
  const piece = root.querySelector("[data-piece]");
  if (!piece) return null;
  const img = piece.querySelector("[data-piece-img]");
  const source = piece.querySelector("[data-piece-source]");
  const avif = piece.querySelector("[data-piece-avif]");
  const name = piece.querySelector("[data-colour-name]");
  const of = piece.querySelector("[data-colour-of]");
  const title = piece.querySelector(".piece__title").textContent;
  const swatches = [...piece.querySelectorAll(".sw")];
  const prev = piece.querySelector('[data-pager="prev"]');
  const next = piece.querySelector('[data-pager="next"]');
  let changing = Promise.resolve();

  const show = (sw) => {
    if (avif) avif.srcset = `${sw.dataset.avif} 960w`;
    source.srcset = `${sw.dataset.w480} 480w, ${sw.dataset.w960} 960w`;
    img.src = sw.dataset.src;
    img.alt = `${title}, ${sw.dataset.colour.toLowerCase()}`;
  };
  function choose(sw, { animate = true } = {}) {
    if (sw.getAttribute("aria-pressed") === "true" && animate) return;
    swatches.forEach((b) => b.setAttribute("aria-pressed", String(b === sw)));
    name.textContent = sw.dataset.colour;
    of.textContent = `${swatches.indexOf(sw) + 1} of ${swatches.length}`;
    history.replaceState(history.state, "", `#${sw.dataset.id}`);
    if (!animate || !motion()) return show(sw);
    changing = changing
      .then(() => halftoneOut(img, 0.32))
      .then(() => {
        show(sw);
        return loaded(img);
      })
      .then(() => halftoneIn(img, { duration: 0.8 }));
  }
  const offs = [];
  swatches.forEach((sw) => {
    const click = () => choose(sw);
    const warm = () => loadImage(sw.dataset.src).catch(() => {});
    sw.addEventListener("click", click);
    sw.addEventListener("pointerenter", warm, { once: true });
    offs.push(() => sw.removeEventListener("click", click));
  });
  const fromHash = swatches.find((b) => `#${b.dataset.id}` === decodeURIComponent(location.hash));
  if (fromHash) choose(fromHash, { animate: false });

  const onKey = (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || menuOpen) return;
    if (e.target.closest?.("input, textarea, select")) return;
    if (e.key === "ArrowLeft") prev?.click();
    else if (e.key === "ArrowRight") next?.click();
  };
  addEventListener("keydown", onKey);
  let start = null;
  const figure = piece.querySelector(".piece__figure");
  const down = (e) => (start = e.touches.length === 1 ? e.touches[0] : null);
  const up = (e) => {
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.clientX;
    const dy = e.changedTouches[0].clientY - start.clientY;
    start = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)?.click();
  };
  figure.addEventListener("touchstart", down, { passive: true });
  figure.addEventListener("touchend", up, { passive: true });
  return () => {
    removeEventListener("keydown", onKey);
    offs.forEach((f) => f());
  };
}

/* ---------- menu (phones) ---------- */
let menuBtn = null;
function setMenu(open) {
  if (!menuBtn) return;
  menuOpen = open;
  html.classList.toggle("menu-open", open);
  html.classList.remove("top-away");
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.querySelector(".menu-btn__label").textContent = open ? "Close" : "Menu";
  if (lenis) open ? lenis.stop() : lenis.start();
  html.style.overflow = open ? "hidden" : "";
  if (open) document.querySelector("[data-nav] a")?.focus();
}
function initMenu() {
  menuBtn = document.querySelector("[data-menu-btn]");
  const nav = document.querySelector("[data-nav]");
  if (!menuBtn || !nav) return null;
  nav.querySelectorAll("li").forEach((li, k) => li.style.setProperty("--k", String(k)));
  const toggle = () => setMenu(!menuOpen);
  const onKey = (e) => {
    if (!menuOpen) return;
    if (e.key === "Escape") {
      setMenu(false);
      menuBtn.focus();
    } else if (e.key === "Tab") {
      const stops = [menuBtn, ...nav.querySelectorAll("a")];
      const i = stops.indexOf(document.activeElement);
      const to = e.shiftKey ? (i <= 0 ? stops.length - 1 : i - 1) : i === stops.length - 1 ? 0 : i + 1;
      e.preventDefault();
      stops[to].focus();
    }
  };
  menuBtn.addEventListener("click", toggle);
  addEventListener("keydown", onKey);
  return () => {
    menuBtn.removeEventListener("click", toggle);
    removeEventListener("keydown", onKey);
    if (menuOpen) setMenu(false);
  };
}

/* ---------- page lifecycle ---------- */
let cleanups = [];
let ctx = null;
function initPage() {
  const main = document.getElementById("main");
  html.classList.add("is-booted");
  const run = () => {
    cleanups = [initReveals(main), initWall(main), initPlate(main), initBlank(main), initPiece(main), initMenu(), initFills(document)].filter(Boolean);
  };
  if (gsap) ctx = gsap.context(run);
  else run();
}
function cleanupPage() {
  cleanups.splice(0).forEach((c) => c());
  ctx?.revert();
  ctx = null;
}

/* ---------- moving between pages: a drop of the piece's colour spreads, then breaks into dots ---------- */
const curtain = document.getElementById("curtain");
const drop = curtain?.querySelector(".curtain__drop");
let point = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener("pointerdown", (e) => (point = { x: e.clientX, y: e.clientY }), { passive: true, capture: true });

// Ink or mat for the destination's name, whichever reads on the drop's colour.
function inkFor(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "var(--kohl)";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (l + 0.05) / (0.012 + 0.05) >= (0.83 + 0.05) / (l + 0.05) ? "var(--kohl)" : "var(--mat)";
}
function leave(kind, colour, label = "") {
  if (!gsap) return Promise.resolve();
  if (kind === "piece") {
    const img = document.querySelector("[data-piece-img]");
    const info = document.querySelector(".piece__info");
    return Promise.all([halftoneOut(img, 0.34), new Promise((r) => gsap.to(info, { autoAlpha: 0, duration: reduced.matches ? 0.01 : 0.25, onComplete: r }))]);
  }
  curtain.style.setProperty("--drop", colour || "var(--silk)");
  curtain.style.setProperty("--drop-ink", inkFor(colour));
  const name = curtain.querySelector(".curtain__name");
  if (name) name.textContent = label;
  gsap.set(curtain, { autoAlpha: 1 });
  if (name && !reduced.matches) gsap.fromTo(name, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, delay: 0.3, ease: "power3.out" });
  if (reduced.matches) {
    gsap.set(drop, { clipPath: "none" });
    return new Promise((r) => gsap.fromTo(drop, { opacity: 0 }, { opacity: 1, duration: 0.18, onComplete: r }));
  }
  const reach = Math.hypot(Math.max(point.x, innerWidth - point.x), Math.max(point.y, innerHeight - point.y)) + 4;
  gsap.set(drop, { opacity: 1, "--cd": "40px" });
  return new Promise((r) =>
    gsap.fromTo(drop, { clipPath: `circle(0px at ${point.x}px ${point.y}px)` }, { clipPath: `circle(${reach}px at ${point.x}px ${point.y}px)`, duration: 0.6, ease: "power3.inOut", onComplete: r }),
  );
}
function enter(kind) {
  if (!gsap) return Promise.resolve();
  if (kind === "piece") return Promise.resolve();
  if (reduced.matches) return new Promise((r) => gsap.to(drop, { opacity: 0, duration: 0.18, onComplete: () => { gsap.set(curtain, { autoAlpha: 0 }); r(); } }));
  gsap.set(drop, { clipPath: "none" });
  curtain.classList.add("is-breaking");
  return new Promise((r) =>
    gsap.fromTo(drop, { "--cd": "20px" }, {
      "--cd": "-1px", duration: 0.7, ease: "power2.in",
      onComplete: () => {
        curtain.classList.remove("is-breaking");
        gsap.set(curtain, { autoAlpha: 0 });
        gsap.set(curtain.querySelector(".curtain__name"), { autoAlpha: 0 });
        r();
      },
    }),
  );
}

const cache = new Map();
function fetchPage(href) {
  if (!cache.has(href)) {
    cache.set(
      href,
      fetch(href, { credentials: "same-origin" })
        .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
        .catch((err) => {
          cache.delete(href);
          throw err;
        }),
    );
  }
  return cache.get(href);
}

const HEAD = ['meta[name="description"]', 'link[rel="canonical"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]', 'script[type="application/ld+json"]', 'meta[name="robots"]'].join(",");
function swapHead(doc) {
  document.head.querySelectorAll(HEAD).forEach((n) => n.remove());
  const anchor = document.head.querySelector('link[rel="icon"]');
  doc.head.querySelectorAll(HEAD).forEach((n) => document.head.insertBefore(document.importNode(n, true), anchor));
}

let busy = false;
async function navigate(url, { push = true, y = null, kind = "drop", colour = null, label = "", transition = true } = {}) {
  if (busy) return;
  busy = true;
  if (menuOpen) setMenu(false);
  const loading = fetchPage(url.href.split("#")[0]);
  if (push) history.replaceState({ ...(history.state || {}), y: scrollY }, "");
  try {
    lenis?.stop();
    if (transition) await leave(kind, colour, label);
    const doc = new DOMParser().parseFromString(await loading, "text/html");
    const next = doc.getElementById("page");
    if (!next || doc.querySelector("base")) throw new Error("not a page this router can swap");
    cleanupPage();
    if (push) history.pushState({ y: 0 }, "", url.href);
    document.title = doc.title;
    swapHead(doc);
    html.dataset.page = doc.documentElement.dataset.page || "";
    html.classList.remove("top-away");
    document.getElementById("page").replaceWith(document.adoptNode(next));
    const target = url.hash && url.hash.length > 1 ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
    scrollToY(y ?? 0);
    initPage();
    if (target && y == null) scrollToEl(target, { smooth: false });
    document.getElementById("main").focus({ preventScroll: true });
    const announce = document.querySelector("[data-announce]");
    if (announce) announce.textContent = doc.title;
    lenis?.start();
    if (transition) await enter(kind);
  } catch {
    location.href = url.href;
  } finally {
    busy = false;
    lenis?.start();
  }
}

function internal(a, e) {
  if (!a || (e && (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey))) return null;
  if (a.target && a.target !== "_self") return null;
  if (a.hasAttribute("download") || a.getAttribute("rel")?.includes("external")) return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return null;
  if (!/\/$|\.html$/.test(url.pathname)) return null;
  return url;
}

// Links to a place on this page (#main, #top, #maker). Handled here so they also work on the
// 404 page, whose <base> would otherwise send them to the home page.
function initAnchors() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = decodeURIComponent(a.getAttribute("href").slice(1));
    const el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    if (menuOpen) setMenu(false);
    if (id === "top") scrollToY(0);
    else scrollToEl(el);
    if (id === "main" || id === "top") (id === "top" ? document.getElementById("main") : el).focus({ preventScroll: true });
  });
}

function initRouter() {
  history.scrollRestoration = "manual";
  // The 404 page sets a <base> so it works at any depth; it leaves with a normal page load.
  if (document.querySelector("base")) return;
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("a[href]");
    if (a?.getAttribute("href").startsWith("#")) return;
    const url = internal(a, e);
    if (!url) return;
    const samePage = url.pathname === location.pathname && url.search === location.search;
    if (samePage) {
      if (!url.hash || url.hash === "#") return;
      const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!el) return;
      e.preventDefault();
      if (menuOpen) setMenu(false);
      if (url.hash === "#top") scrollToY(0);
      else scrollToEl(el);
      if (url.hash === "#main") el.focus({ preventScroll: true });
      return;
    }
    e.preventDefault();
    const kind = a.dataset.pager && html.dataset.page === "piece" ? "piece" : "drop";
    const label = (a.querySelector(".tile__title, .index__name, .next__name, .nav__label, .pager__name") || a).textContent.trim().slice(0, 60);
    navigate(url, { kind, colour: a.dataset.drop || null, label: a.classList.contains("mark") ? "" : label });
  });
  const warm = (e) => {
    const url = internal(e.target.closest?.("a[href]"));
    if (url && url.pathname !== location.pathname) fetchPage(url.href.split("#")[0]).catch(() => {});
  };
  document.addEventListener("pointerover", warm, { passive: true });
  document.addEventListener("touchstart", warm, { passive: true });
  document.addEventListener("focusin", warm);
  addEventListener("popstate", (e) => navigate(new URL(location.href), { push: false, y: e.state?.y ?? 0, transition: false }));
}

/* ---------- boot ---------- */
initScroll();
initPage();
initAnchors();
initRouter();
if (location.hash && location.hash.length > 1 && !/^#\//.test(location.hash)) {
  const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (el && !el.classList.contains("sw")) requestAnimationFrame(() => scrollToEl(el, { smooth: false }));
}
