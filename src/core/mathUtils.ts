/* JS9 core math/format helpers extracted from viewer.js. */
import { sprintf } from './sprintf';

"use strict";

const JS9MathUtils = {
  // ints remain ints, floats get truncated at configured significant digits
  floatToString(fval: unknown, floatPrecision: number): string {
    if (typeof fval === "number") {
      return sprintf("%g", parseFloat(fval.toFixed(floatPrecision)));
    }
    if (typeof fval === "string") {
      return fval;
    }
    return String(fval);
  },

  // figure out precision from range of values (used by colorbar)
  floatPrecision(fval1: number, fval2: number): number {
    const aa = Math.floor(Math.log10(Math.abs(fval1)));
    const bb = Math.floor(Math.log10(Math.abs(fval2)));
    return Math.max(aa, bb);
  },

  // convert float value to a string with decent precision
  floatFormattedString(fval: number | undefined, prec: number, jj: number): string {
    let fmt: string;
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
  centerPolygon(points: Array<{x: number; y: number}>): {x: number; y: number} | undefined {
    let i: number;
    let minx: number | undefined;
    let maxx: number | undefined;
    let miny: number | undefined;
    let maxy: number | undefined;
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
    return { x: (minx! + maxx!) / 2.0, y: (miny! + maxy!) / 2.0 };
  },

  // centroid for a polygon (not for self-intersecting polygons)
  centroidPolygon(points: Array<{x: number; y: number}>, doaverage: boolean): {x: number; y: number} | undefined {
    let i: number;
    let factor = 0;
    let area = 0;
    let cx = 0;
    let cy = 0;
    let parta = 0;
    let partx = 0;
    let party = 0;
    let totx = 0;
    let toty = 0;
    const pts: Array<{x: number; y: number}> = [];

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

export { JS9MathUtils };
