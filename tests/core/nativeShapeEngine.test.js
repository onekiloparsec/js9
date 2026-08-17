import { beforeAll, beforeEach, describe, expect, it } from "vitest";

let installShapeEngine;

beforeAll(async () => {
  await import("../../src/core/nativeShapeEngine.ts");
  installShapeEngine = globalThis.JS9InstallNativeShapeEngine;
});

// ---------------------------------------------------------------------
// Minimal stand-ins for the pieces of the browser and of JS9 that the
// shape engine touches: enough to exercise the geometry, not the drawing.
// ---------------------------------------------------------------------

function makeContext() {
  const noop = () => {};
  return {
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, stroke: noop,
    fillText: noop, clearRect: noop, setLineDash: noop
  };
}

function installDom() {
  globalThis.document = {
    createElement(tag) {
      const node = { tagName: String(tag).toUpperCase(), style: {} };
      if (node.tagName === "CANVAS") {
        const ctx = makeContext();
        node.width = 0;
        node.height = 0;
        node.getContext = () => ctx;
      }
      return node;
    }
  };
}

function wrapCollection(node) {
  const attrs = {};
  const styles = {};
  const wrapper = {
    0: node,
    length: 1,
    addClass: () => wrapper,
    appendTo: () => wrapper,
    append: () => wrapper,
    css(name, value) {
      if (value === undefined) return styles[name];
      styles[name] = value;
      return wrapper;
    },
    attr(name, value) {
      if (value === undefined) return attrs[name];
      attrs[name] = value;
      if (node && (name === "width" || name === "height")) node[name] = value;
      return wrapper;
    }
  };
  return wrapper;
}

function deepExtend(...args) {
  let i = 0;
  let deep = false;
  if (typeof args[0] === "boolean") {
    deep = args[0];
    i = 1;
  }
  const target = args[i] || {};
  for (i += 1; i < args.length; i++) {
    const source = args[i];
    if (!source) continue;
    Object.keys(source).forEach((key) => {
      const copy = source[key];
      if (copy === undefined || copy === target) return;
      const isPlain = copy && typeof copy === "object" &&
                      Object.getPrototypeOf(copy) === Object.prototype;
      if (deep && (Array.isArray(copy) || isPlain)) {
        const base = Array.isArray(copy)
          ? (Array.isArray(target[key]) ? target[key] : [])
          : (target[key] && typeof target[key] === "object" ? target[key] : {});
        target[key] = deepExtend(true, base, copy);
      } else {
        target[key] = copy;
      }
    });
  }
  return target;
}

function installJS9() {
  installDom();
  const JS9 = {
    WIDTH: 512,
    HEIGHT: 512,
    SHAPEZINDEX: 4,
    globalOpts: { defcolor: "#00FF00" },
    Display: function Display() {},
    Image: function Image() {},
    ShapeEngine: { register: () => {}, use: () => {} },
    wrapCollection,
    isNumber: (value) => typeof value === "number" && Number.isFinite(value),
    getImage: () => null,
    lookupImage: () => null,
    pix2wcs: () => "0 0",
    extend: deepExtend
  };
  JS9.Display.prototype = {};
  JS9.Image.prototype = {};
  installShapeEngine(JS9);
  JS9.Fabric.installDisplayApi();
  return JS9;
}

// A stand-in for the real display transform: translate to the pan centre,
// scale by the zoom, and flip y -- the same composition JS9 applies. The
// tests never assume this exact form, only that the engine composes with
// whatever imageToDisplayPos/displayToImagePos report.
function makeImage(JS9, { dwidth = 900, dheight = 560,
                          panx = 400, pany = 300 } = {}) {
  const sect = { zoom: 1, x0: 0, y0: 0, width: 800, height: 600 };
  const image = Object.create(JS9.Image.prototype);
  Object.assign(image, {
    raw: { width: 800, height: 600, wcs: 0, wcsinfo: null },
    rgb: { sect },
    params: { wcssys: "physical" },
    layers: {},
    validWCS: () => 0,
    imageToDisplayPos(pos) {
      return {
        x: ((pos.x - panx) * sect.zoom) + (dwidth / 2),
        y: (dheight / 2) - ((pos.y - pany) * sect.zoom)
      };
    },
    displayToImagePos(pos) {
      return {
        x: ((pos.x - (dwidth / 2)) / sect.zoom) + panx,
        y: pany - ((pos.y - (dheight / 2)) / sect.zoom)
      };
    },
    imageToLogicalPos(pos) {
      return { x: pos.x, y: pos.y };
    }
  });
  image.display = {
    id: "test",
    image,
    width: dwidth,
    height: dheight,
    canvas: { width: dwidth, height: dheight },
    layers: {},
    divjq: wrapCollection({ tagName: "DIV", style: {} })
  };
  Object.setPrototypeOf(image.display, JS9.Display.prototype);
  return image;
}

describe("native shape engine geometry", () => {
  let JS9;
  let image;

  beforeEach(() => {
    JS9 = installJS9();
    image = makeImage(JS9);
    image.display.newShapeLayer("regions", JS9.Fabric.opts);
  });

  const shapeObj = (index = 0) => image.layers.regions.objects[index];

  it("places a shape where imageToDisplayPos says it goes", () => {
    image.addShapes("regions", "circle", { x: 265, y: 380, radius: 10 });
    const expected = image.imageToDisplayPos({ x: 265, y: 380 });
    const obj = shapeObj();
    expect(obj.left).toBeCloseTo(expected.x, 6);
    expect(obj.top).toBeCloseTo(expected.y, 6);
    // and not at the raw image coordinates, which is the bug this guards
    expect(obj.left).not.toBeCloseTo(265, 6);
    expect(obj.top).not.toBeCloseTo(380, 6);
  });

  it("reports image coordinates back out", () => {
    image.addShapes("regions", "circle", { x: 265, y: 380, radius: 10 });
    const [pub] = image.getShapes("regions", "all");
    expect(pub.x).toBeCloseTo(265, 6);
    expect(pub.y).toBeCloseTo(380, 6);
    expect(pub.radius).toBeCloseTo(10, 6);
    expect(pub.imsys).toBe("image");
    expect(pub.imstr).toBe("circle(265.00,380.00,10.00)");
  });

  it("follows the image through a zoom, keeping image units in pub", () => {
    image.addShapes("regions", "circle", { x: 265, y: 380, radius: 10 });
    image.rgb.sect.zoom = 2;
    image.refreshShapes("regions");
    const expected = image.imageToDisplayPos({ x: 265, y: 380 });
    const obj = shapeObj();
    expect(obj.left).toBeCloseTo(expected.x, 6);
    expect(obj.top).toBeCloseTo(expected.y, 6);
    // twice as big on screen, still ten image pixels across
    expect(obj.radius).toBeCloseTo(20, 6);
    const [pub] = image.getShapes("regions", "all");
    expect(pub.x).toBeCloseTo(265, 6);
    expect(pub.y).toBeCloseTo(380, 6);
    expect(pub.radius).toBeCloseTo(10, 6);
  });

  it("defaults to the centre of the display", () => {
    image.addShapes("regions", "circle", {});
    const [pub] = image.getShapes("regions", "all");
    const centre = image.displayToImagePos({ x: 450, y: 280 });
    expect(pub.x).toBeCloseTo(centre.x, 6);
    expect(pub.y).toBeCloseTo(centre.y, 6);
  });

  it("moves a shape by image pixels via changeShapes", () => {
    const id = image.addShapes("regions", "circle",
                               { x: 100, y: 100, radius: 5 });
    image.changeShapes("regions", id, { x: 120, deltay: 10 });
    const [pub] = image.getShapes("regions", "all");
    expect(pub.x).toBeCloseTo(120, 6);
    expect(pub.y).toBeCloseTo(110, 6);
    const expected = image.imageToDisplayPos({ x: 120, y: 110 });
    expect(shapeObj().left).toBeCloseTo(expected.x, 6);
    expect(shapeObj().top).toBeCloseTo(expected.y, 6);
  });

  it("keeps polygon vertices in image coordinates", () => {
    image.addShapes("regions", "polygon",
                    { pts: [{ x: 50, y: 50 }, { x: 80, y: 50 },
                            { x: 80, y: 80 }] });
    const [pub] = image.getShapes("regions", "all");
    expect(pub.pts).toEqual([{ x: 50, y: 50 }, { x: 80, y: 50 },
                             { x: 80, y: 80 }]);
    // the centre of a vertex shape is the centroid of its vertices
    expect(pub.x).toBeCloseTo(70, 6);
    expect(pub.y).toBeCloseTo(60, 6);
    const expected = image.imageToDisplayPos({ x: 50, y: 50 });
    expect(shapeObj().points[0].x).toBeCloseTo(expected.x, 6);
    expect(shapeObj().points[0].y).toBeCloseTo(expected.y, 6);
  });

  it("builds a region string per shape type", () => {
    image.addShapes("regions", "box",
                    { x: 100, y: 150, width: 40, height: 30 });
    image.addShapes("regions", "ellipse",
                    { x: 400, y: 200, r1: 25, r2: 12 });
    const strs = image.getShapes("regions", "all").map((pub) => pub.imstr);
    expect(strs).toEqual([
      "box(100.00,150.00,40.00,30.00,0)",
      "ellipse(400.00,200.00,25.00,12.00,0)"
    ]);
  });

  it("adds shapes from a region string", () => {
    image.parseRegions = () => ([
      { shape: "circle", x: 265, y: 380, radius: 10, tags: "source" }
    ]);
    image.addShapes("regions", "circle(265,380,10) # source");
    const [pub] = image.getShapes("regions", "all");
    expect(pub.shape).toBe("circle");
    expect(pub.x).toBeCloseTo(265, 6);
    expect(pub.radius).toBeCloseTo(10, 6);
    expect(pub.tags).toEqual(["source"]);
  });

  it("leaves layers hosted outside the display in canvas coordinates", () => {
    const host = wrapCollection({ tagName: "DIV", style: {} });
    host.css("width", 200).css("height", 200);
    image.display.newShapeLayer("magnifier", {}, host);
    const id = image.addShapes("magnifier", "box", { left: 50, top: 60 });
    const obj = image.layers.magnifier.objects[0];
    expect(obj.img).toBeNull();
    expect(obj.left).toBe(50);
    expect(obj.top).toBe(60);
    // numeric properties survive changeShapes on such a layer
    image.changeShapes("magnifier", id, { left: 80, width: 24 });
    expect(obj.left).toBe(80);
    expect(obj.width).toBe(24);
  });

  it("survives a deep copy and JSON round trip of its pub", () => {
    image.addShapes("regions", "circle", { x: 10, y: 20, radius: 3 });
    const [pub] = image.getShapes("regions", "all");
    expect(pub.obj).toBeDefined();
    expect(() => JSON.stringify(pub)).not.toThrow();
    expect(() => deepExtend(true, {}, pub)).not.toThrow();
  });
});
