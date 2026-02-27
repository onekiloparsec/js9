/* JS9 core math/format helpers extracted from viewer.js. */

/*global sprintf */

"use strict";

const JS9MathUtils = {
  // ints remain ints, floats get truncated at configured significant digits
  floatToString(fval, floatPrecision) {
    if (typeof fval === "number") {
      return sprintf("%g", parseFloat(fval.toFixed(floatPrecision)));
    }
    if (typeof fval === "string") {
      return fval;
    }
    return String(fval);
  },

  // figure out precision from range of values (used by colorbar)
  floatPrecision(fval1, fval2) {
    const aa = Math.floor(Math.log10(Math.abs(fval1)));
    const bb = Math.floor(Math.log10(Math.abs(fval2)));
    return Math.max(aa, bb);
  },

  // convert float value to a string with decent precision
  floatFormattedString(fval, prec, jj) {
    let fmt;
    let s = "";
    if (fval === undefined) {
      return s;
    }
    if (prec < -2) {
      fmt = `%.${String(2 + jj)}e`;
      s = sprintf(fmt, fval);
    } else if (prec < 0) {
      s = fval.toFixed(Math.abs(prec) + 3 + jj);
    } else if (prec < 2) {
      fmt = `%.${String(prec + jj)}f`;
      s = sprintf(fmt, fval);
    } else if (prec < 5) {
      s = fval.toFixed(0 + jj);
    } else {
      fmt = `%.${String(2 + jj)}e`;
      s = sprintf(fmt, fval);
    }
    return s;
  },

  // center of bounding box surrounding a polygon
  centerPolygon(points) {
    let i;
    let minx;
    let maxx;
    let miny;
    let maxy;
    if (!points || !points.length) {
      return undefined;
    }
    for (i = 0; i < points.length; i++) {
      if (minx === undefined || points[i].x < minx) {
        minx = points[i].x;
      }
      if (maxx === undefined || points[i].x > maxx) {
        maxx = points[i].x;
      }
      if (miny === undefined || points[i].y < miny) {
        miny = points[i].y;
      }
      if (maxy === undefined || points[i].y > maxy) {
        maxy = points[i].y;
      }
    }
    return { x: (minx + maxx) / 2.0, y: (miny + maxy) / 2.0 };
  },

  // centroid for a polygon (not for self-intersecting polygons)
  centroidPolygon(points, doaverage) {
    let i;
    let factor;
    let area;
    let cx;
    let cy;
    let parta = 0;
    let partx = 0;
    let party = 0;
    let totx = 0;
    let toty = 0;
    const pts = [];

    if (!points || !points.length) {
      return undefined;
    }

    if (doaverage) {
      for (i = 0; i < points.length; i++) {
        totx += points[i].x;
        toty += points[i].y;
      }
      return { x: totx / points.length, y: toty / points.length };
    }

    for (i = 0; i < points.length; i++) {
      pts[i] = { x: points[i].x, y: points[i].y };
    }
    pts[points.length] = { x: pts[0].x, y: pts[0].y };

    for (i = 0; i < points.length; i++) {
      factor = pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y;
      parta += factor;
      partx += (pts[i].x + pts[i + 1].x) * factor;
      party += (pts[i].y + pts[i + 1].y) * factor;
    }

    area = parta / 2.0;
    cx = partx / (area * 6.0);
    cy = party / (area * 6.0);
    return { x: cx, y: cy };
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.JS9MathUtils = JS9MathUtils;
}
