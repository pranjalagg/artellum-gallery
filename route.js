// Hash routes: "#/" home, "#/<category>" wall, "#/<category>/<photo>" large view.
export function parseRoute(hash, slugs) {
  const [slug, id] = hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  if (!slug || !slugs.includes(slug)) return { view: "home" };
  if (!id) return { view: "category", slug };
  return { view: "photo", slug, id };
}

export function routeHref(route) {
  if (route.view === "home") return "#/";
  if (route.view === "category") return `#/${encodeURIComponent(route.slug)}`;
  return `#/${encodeURIComponent(route.slug)}/${encodeURIComponent(route.id)}`;
}

// items are { slug, photo }; the same photo id may appear in two categories, so match on both.
export function neighbours(items, slug, id) {
  const index = items.findIndex((item) => item.slug === slug && item.photo.id === id);
  if (index === -1) return null;
  return { index, prev: items[index - 1] ?? null, next: items[index + 1] ?? null };
}

// One photo from each category in turn, so a mixed wall does not start with 100 of the same thing.
export function interleave(categories) {
  const items = [];
  const longest = Math.max(0, ...categories.map((c) => c.photos.length));
  for (let i = 0; i < longest; i++) {
    for (const c of categories) {
      if (c.photos[i]) items.push({ slug: c.slug, photo: c.photos[i] });
    }
  }
  return items;
}

// Splits a wall's pieces, in order, into n columns: indexes, top to bottom then left to right.
// Like CSS columns, each column fills up to the lowest height that fits every piece in.
export function columns(heights, n) {
  const fill = (limit) => {
    const runs = [[]];
    let filled = 0;
    heights.forEach((h, i) => {
      if (runs.at(-1).length && filled + h > limit) {
        runs.push([]);
        filled = 0;
      }
      runs.at(-1).push(i);
      filled += h;
    });
    return runs;
  };
  let low = 0;
  let high = heights.reduce((sum, h) => sum + h, 0);
  for (let step = 0; step < 50; step++) {
    const mid = (low + high) / 2;
    if (fill(mid).length <= n) high = mid;
    else low = mid;
  }
  const runs = fill(high);
  while (runs.length < n) runs.push([]);
  return runs;
}

// Masonry: each piece, in order, goes to the column that is currently shortest, so the columns
// end within one piece of each other. Returns indexes per column and each column's height.
export function masonry(heights, n) {
  const cols = Array.from({ length: n }, () => ({ items: [], height: 0 }));
  heights.forEach((h, i) => {
    const shortest = cols.reduce((best, c) => (c.height < best.height - 1e-9 ? c : best), cols[0]);
    shortest.items.push(i);
    shortest.height += h;
  });
  return cols;
}
