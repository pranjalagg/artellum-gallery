const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const titleFromName = (name) => capitalise(name.replace(/[-_]+/g, " ").trim());

export function titleFromFilename(file) {
  return titleFromName(file.replace(/\.[^.]+$/, ""));
}

// "2-red-and-gold.jpg" is "Red and gold": a leading number only sets the order of a design's colours.
export function colourFromFilename(file) {
  return titleFromFilename(file.replace(/^\d+[-_ ]+(?=[^.])/, ""));
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function categoryLabel(slug, names) {
  return names[slug] ?? capitalise(slug.replace(/-/g, " "));
}

export function orderCategories(slugs, order) {
  const listed = order.filter((s) => slugs.includes(s));
  const rest = slugs.filter((s) => !listed.includes(s)).sort();
  return [...listed, ...rest];
}
