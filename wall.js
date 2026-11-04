// The wall lays out its own columns (Safari loses pieces inside CSS columns that animate).
// scripts/pages.mjs writes this file inline into every page with a wall, and calls lay() right after
// the wall's markup, so the columns are in place before the first paint: nothing hides, nothing jumps.
// app.js calls lay() again when the window crosses a breakpoint.
(function () {
  // Each piece, in order, goes to the column that is currently shortest, so the columns end within one
  // piece of each other. Returns the indexes in each column and each column's height.
  function masonry(heights, n) {
    var cols = [];
    for (var c = 0; c < n; c++) cols.push({ items: [], height: 0 });
    heights.forEach(function (h, i) {
      var shortest = cols[0];
      for (var k = 1; k < n; k++) if (cols[k].height < shortest.height - 1e-9) shortest = cols[k];
      shortest.items.push(i);
      shortest.height += h;
    });
    return cols;
  }

  var END_H = 1.25; // the blank plate and its line, in column widths

  function lay(wall) {
    var most = 2 + (matchMedia("(min-width: 760px)").matches ? 1 : 0) + (matchMedia("(min-width: 1180px)").matches ? 1 : 0);
    if (wall.artellumColumns === most) return;
    wall.artellumColumns = most;
    var tiles = Array.prototype.slice.call(wall.querySelectorAll(".tile:not(.tile--end)"));
    tiles.sort(function (a, b) { return a.dataset.i - b.dataset.i; });
    // Heights in column widths: the photo, plus its caption.
    var heights = tiles.map(function (t) { return parseFloat(t.style.getPropertyValue("--ratio")) + (t.querySelector(".run") ? 0.3 : 0.2); });
    var end = wall.dataset.end;
    var small = tiles.length <= 8;
    var best = null;
    if (small) {
      // A small set: the widest layout whose last row is full, or one short so the blank plate fills it.
      var n = [4, 3, 2].filter(function (k) { return k <= most && (tiles.length % k === 0 || (end && tiles.length % k === k - 1)); })[0] || 2;
      best = { cols: masonry(heights, n) };
    } else {
      // A big wall uses every column the width allows; masonry keeps the ends within one piece,
      // and the blank plate closes a short column.
      best = { cols: masonry(heights, most) };
    }
    var heightsOf = best.cols.map(function (c) { return c.height; });
    var tallest = Math.max.apply(null, heightsOf);
    var shortest = heightsOf.indexOf(Math.min.apply(null, heightsOf));
    var uls = best.cols.map(function (col) {
      var ul = document.createElement("ul");
      ul.className = "wall__col";
      ul.setAttribute("role", "list");
      col.items.forEach(function (i) { ul.appendChild(tiles[i]); });
      return ul;
    });
    // A column that ends well short is closed by a blank plate that says how many pieces there are.
    if (end && ((small && tiles.length % best.cols.length !== 0) || tallest - heightsOf[shortest] >= END_H)) {
      var li = document.createElement("li");
      li.className = "tile tile--end";
      li.setAttribute("aria-hidden", "true");
      li.innerHTML = '<span class="tile__blank"></span><span class="tile__end"></span>';
      li.lastChild.textContent = end;
      uls[shortest].appendChild(li);
    }
    wall.replaceChildren.apply(wall, uls);
    wall.classList.add("is-laid");
  }

  globalThis.artellumWall = { masonry: masonry, lay: lay };
})();
