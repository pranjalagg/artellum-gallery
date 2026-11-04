import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoute, routeHref } from "../route.js";

const slugs = ["a"];

test("empty hash and bare slash are home", () => {
  assert.deepEqual(parseRoute("", slugs), { view: "home" });
  assert.deepEqual(parseRoute("#/", slugs), { view: "home" });
});

test("known category is a category route", () => {
  assert.deepEqual(parseRoute("#/a", slugs), { view: "category", slug: "a" });
});

test("unknown category falls back to home", () => {
  assert.deepEqual(parseRoute("#/nope", slugs), { view: "home" });
  assert.deepEqual(parseRoute("#/nope/x", slugs), { view: "home" });
});

test("category plus id is a photo route", () => {
  assert.deepEqual(parseRoute("#/a/x", slugs), { view: "photo", slug: "a", id: "x" });
});

test("routeHref is the inverse of parseRoute", () => {
  for (const hash of ["#/", "#/a", "#/a/x"]) {
    assert.equal(routeHref(parseRoute(hash, slugs)), hash);
  }
});

import { neighbours } from "../route.js";

const item = (slug, id) => ({ slug, photo: { id } });

test("neighbours finds previous and next items without wrapping", () => {
  const items = [item("a", "1"), item("a", "2"), item("b", "1")];
  assert.deepEqual(neighbours(items, "a", "2"), { index: 1, prev: items[0], next: items[2] });
  assert.deepEqual(neighbours(items, "a", "1"), { index: 0, prev: null, next: items[1] });
  assert.deepEqual(neighbours(items, "b", "1"), { index: 2, prev: items[1], next: null });
});

test("neighbours tells apart the same photo id in different categories", () => {
  const items = [item("a", "1"), item("b", "1")];
  assert.equal(neighbours(items, "b", "1").index, 1);
});

test("neighbours returns null for an unknown photo", () => {
  assert.equal(neighbours([item("a", "1")], "b", "1"), null);
  assert.equal(neighbours([item("a", "1")], "a", "zzz"), null);
});

import { interleave } from "../route.js";

test("interleave takes one photo from each category in turn", () => {
  const categories = [
    { slug: "a", photos: [{ id: "a1" }, { id: "a2" }, { id: "a3" }] },
    { slug: "b", photos: [{ id: "b1" }] },
    { slug: "c", photos: [{ id: "c1" }, { id: "c2" }] },
  ];
  assert.deepEqual(
    interleave(categories).map((item) => `${item.slug}/${item.photo.id}`),
    ["a/a1", "b/b1", "c/c1", "a/a2", "c/c2", "a/a3"],
  );
});

test("interleave of no categories is empty", () => {
  assert.deepEqual(interleave([]), []);
});

import { columns } from "../route.js";

test("columns keep the pieces in order, top to bottom then left to right", () => {
  assert.deepEqual(columns([1, 1, 1, 1, 1, 1, 1, 1], 4), [[0, 1], [2, 3], [4, 5], [6, 7]]);
});

test("columns fill from the left, leaving any short column at the end", () => {
  assert.deepEqual(columns([1, 1, 1, 1, 1], 3), [[0, 1], [2, 3], [4]]);
});

test("columns come out about equally tall", () => {
  assert.deepEqual(columns([3, 1, 1, 1], 2), [[0], [1, 2, 3]]);
  assert.deepEqual(columns([1, 10, 1], 3), [[0], [1], [2]]);
});

test("columns are always as many as asked for, even with fewer pieces", () => {
  assert.deepEqual(columns([1], 3), [[0], [], []]);
  assert.deepEqual(columns([], 2), [[], []]);
});

import { masonry } from "../route.js";

test("masonry puts each piece in the shortest column, in order", () => {
  // a tie goes to the first column
  const cols = masonry([2, 1, 1, 1], 2);
  assert.deepEqual(cols.map((c) => c.items), [[0, 3], [1, 2]]);
  assert.deepEqual(cols.map((c) => c.height), [3, 2]);
});

test("masonry columns end within one piece of each other", () => {
  const heights = [1.3, 0.6, 1.8, 1.3, 1.3, 0.56, 1.8, 1, 1.3, 0.56, 1.3, 1.8, 1.3, 0.56, 1.8, 1.8];
  const cols = masonry(heights, 4);
  const tallest = Math.max(...cols.map((c) => c.height));
  const shortest = Math.min(...cols.map((c) => c.height));
  assert.ok(tallest - shortest <= Math.max(...heights));
  assert.equal(cols.flatMap((c) => c.items).length, heights.length);
});

test("masonry with more columns than pieces leaves the extra columns empty", () => {
  assert.deepEqual(masonry([1, 1], 3).map((c) => c.items), [[0], [1], []]);
});
