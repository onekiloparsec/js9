// @ts-nocheck
/* JS9 browser viewer core. Attribution is centralized in README.md. */

"use strict";

function JS9InstallNativeShapeEngine(JS9){
const SHAPE_TYPES = new Set(["box", "circle", "ellipse", "line", "text", "polygon", "polyline"]);

JS9.Fabric = JS9.Fabric || {};
JS9.Fabric.elements = ["color", "strokeWidth", "strokeDashArray", "fontSize", "fontFamily", "angle", "text", "tags"];
JS9.Fabric.opts = {
    originX: "center",
    originY: "center",
    selectable: true,
    changeable: true,
    removable: true,
    movable: true,
    resizable: true,
    rotatable: true,
    evented: true,
    hasControls: true,
    hasRotatingPoint: true,
    hasBorders: true,
    lockMovementX: false,
    lockMovementY: false,
    lockRotation: false,
    lockScalingX: false,
    lockScalingY: false,
    lockUniScaling: false,
    canvas: {
        selection: true
    },
    shape: "box",
    color: null,
    strokeWidth: 1,
    radius: 10,
    eradius: {x: 10, y: 6},
    width: 20,
    height: 20,
    angle: 0,
    fontSize: 12,
    fontFamily: "Helvetica",
    tagcolors: {
        defcolor: "#00FF00"
    },
    sortOverlapping: false
};

// deep copy of an object or array; anything else is returned as-is
// (JS9.extend would turn a number or a string into an empty object)
const clone = (obj) => {
    if( !obj || (typeof obj !== "object") ){
        return obj;
    }
    return JS9.extend(true, Array.isArray(obj) ? [] : {}, obj);
};
const nextId = (layer) => {
    layer.nshape = layer.nshape || 1;
    const id = `${layer.layerName || "shape"}${layer.nshape}`;
    layer.nshape += 1;
    return id;
};
const normalizeAngle = (value) => JS9.isNumber(value) ? value : 0;
const toNumber = (value, fallback) => JS9.isNumber(value) ? value : fallback;
const getShapeColor = (shape, layer) => {
    return shape.color || shape.stroke || layer?.opts?.color || layer?.opts?.tagcolors?.defcolor || JS9.globalOpts.defcolor;
};
const makePoints = (points) => {
    if( !Array.isArray(points) ){
        return [];
    }
    return points.map((point) => ({x: toNumber(point.x, 0), y: toNumber(point.y, 0)}));
};
const rotatePoint = (point, angle, center) => {
    if( !angle ){
        return {x: point.x, y: point.y};
    }
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
        x: center.x + (dx * cos) - (dy * sin),
        y: center.y + (dx * sin) + (dy * cos)
    };
};
const rectPoints = (shape) => {
    const width = toNumber(shape.width, 0);
    const height = toNumber(shape.height, 0);
    const cx = toNumber(shape.left, 0);
    const cy = toNumber(shape.top, 0);
    const hw = width / 2;
    const hh = height / 2;
    const center = {x: cx, y: cy};
    return [
        rotatePoint({x: cx - hw, y: cy - hh}, normalizeAngle(shape.angle), center),
        rotatePoint({x: cx + hw, y: cy - hh}, normalizeAngle(shape.angle), center),
        rotatePoint({x: cx + hw, y: cy + hh}, normalizeAngle(shape.angle), center),
        rotatePoint({x: cx - hw, y: cy + hh}, normalizeAngle(shape.angle), center)
    ];
};
const shapeCenter = (shape) => {
    if( !shape ){
        return {x: 0, y: 0};
    }
    if( Array.isArray(shape.points) && shape.points.length ){
        let x = 0;
        let y = 0;
        shape.points.forEach((point) => {
            x += point.x || 0;
            y += point.y || 0;
        });
        return {x: x / shape.points.length, y: y / shape.points.length};
    }
    return {
        x: toNumber(shape.left, toNumber(shape.x, 0)),
        y: toNumber(shape.top, toNumber(shape.y, 0))
    };
};

// ---------------------------------------------------------------------
// image <-> display geometry
//
// Shapes are drawn in display coordinates, but the public API, region
// strings and region files all speak image coordinates. So each shape on
// an image layer keeps its canonical geometry in image space (shape.img)
// and the drawn values are derived from it on every render: that way
// shapes stay pinned to the same pixels when the image is panned, zoomed,
// flipped or rotated.
//
// Layers hosted outside the display (dtype "other", e.g. the magnifier
// box) have no image transform, so they keep raw canvas coordinates.
// ---------------------------------------------------------------------

const isImageLayer = (dlayer) => !!dlayer && dlayer.dtype !== "other";

// display pixels per image pixel
const displayZoom = (im) => {
    const zoom = im?.rgb?.sect?.zoom;
    return JS9.isNumber(zoom) && zoom ? zoom : 1;
};

// the image whose geometry a shape in this layer is expressed in,
// or null when the layer is not tied to the displayed image
const layerImage = (layer) => {
    const dlayer = layer?.dlayer || layer;
    if( !isImageLayer(dlayer) ){
        return null;
    }
    return dlayer?.display?.image || null;
};

const toImagePos = (im, pos) => {
    const p = im.displayToImagePos({x: pos.x, y: pos.y});
    return {x: p.x, y: p.y};
};

const toDisplayPos = (im, pos) => {
    const p = im.imageToDisplayPos({x: pos.x, y: pos.y});
    return {x: p.x, y: p.y};
};

// derive the drawn (display) geometry from the shape's image geometry
const applyImageGeometry = (im, shape) => {
    let center;
    const img = shape?.img;
    if( !im || !img ){
        return shape;
    }
    const zoom = displayZoom(im);
    if( Array.isArray(img.points) && img.points.length ){
        shape.points = img.points.map((point) => toDisplayPos(im, point));
    }
    if( JS9.isNumber(img.x) && JS9.isNumber(img.y) ){
        center = toDisplayPos(im, img);
    } else if( shape.points && shape.points.length ){
        center = shapeCenter(shape);
    }
    if( center ){
        shape.left = center.x;
        shape.top = center.y;
    }
    if( JS9.isNumber(img.radius) ){ shape.radius = img.radius * zoom; }
    if( JS9.isNumber(img.width)  ){ shape.width  = img.width  * zoom; }
    if( JS9.isNumber(img.height) ){ shape.height = img.height * zoom; }
    if( img.eradius ){
        shape.eradius = {x: img.eradius.x * zoom, y: img.eradius.y * zoom};
    }
    return shape;
};

// the inverse: record image geometry from the drawn (display) geometry.
// Used when a shape is positioned in display coordinates, and after any
// display-space edit, so the next render is a no-op instead of a jump.
const captureImageGeometry = (im, shape) => {
    let center;
    if( !im || !shape ){
        return shape;
    }
    const zoom = displayZoom(im);
    const img = shape.img = shape.img || {};
    if( Array.isArray(shape.points) && shape.points.length ){
        img.points = shape.points.map((point) => toImagePos(im, point));
    }
    if( JS9.isNumber(shape.left) && JS9.isNumber(shape.top) ){
        center = {x: shape.left, y: shape.top};
    } else if( shape.points && shape.points.length ){
        center = shapeCenter(shape);
    }
    if( center ){
        const pos = toImagePos(im, center);
        img.x = pos.x;
        img.y = pos.y;
    }
    if( JS9.isNumber(shape.radius) ){ img.radius = shape.radius / zoom; }
    if( JS9.isNumber(shape.width)  ){ img.width  = shape.width  / zoom; }
    if( JS9.isNumber(shape.height) ){ img.height = shape.height / zoom; }
    if( shape.eradius ){
        img.eradius = {x: shape.eradius.x / zoom, y: shape.eradius.y / zoom};
    }
    return shape;
};

// read the geometry out of a set of shape options into image space.
//
// x/y, radius, width, height, r1/r2 and pts[{x,y}] are image units, which
// is what the public API, region strings and region files use. dx/dy,
// left/top and points[{x,y}] are display units, used internally and by
// callers that work directly on the canvas. Anything absent falls back to
// the layer defaults, which are display units so that a freshly created
// region has the same size on screen at any zoom.
const readGeometry = (im, shape, opts, defaults) => {
    let pos, pts;
    const zoom = displayZoom(im);
    const img = {};
    // only these are drawn from a list of vertices
    const ispoly = (shape === "line") || (shape === "polygon") ||
                   (shape === "polyline");
    const num = (value) => JS9.isNumber(value) ? value : undefined;
    const ilen = (value, dvalue) => {
        if( JS9.isNumber(value) ){ return value; }
        return JS9.isNumber(dvalue) ? dvalue / zoom : undefined;
    };
    // --- vertices, for line/polygon/polyline
    if( !ispoly ){
        pts = null;
    } else if( Array.isArray(opts.pts) && opts.pts.length ){
        // region-string vertices: image coords, or display coords as dx/dy
        pts = opts.pts.map((point) => {
            if( JS9.isNumber(point.dx) && JS9.isNumber(point.dy) ){
                return toImagePos(im, {x: point.dx, y: point.dy});
            }
            return {x: num(point.x) || 0, y: num(point.y) || 0};
        });
    } else if( Array.isArray(opts.points) && opts.points.length ){
        // display coords
        pts = opts.points.map((point) => toImagePos(im, point));
    }
    // --- center
    if( JS9.isNumber(opts.x) && JS9.isNumber(opts.y) ){
        pos = {x: opts.x, y: opts.y};
    } else if( JS9.isNumber(opts.dx) && JS9.isNumber(opts.dy) ){
        pos = toImagePos(im, {x: opts.dx, y: opts.dy});
    } else if( JS9.isNumber(opts.left) && JS9.isNumber(opts.top) ){
        pos = toImagePos(im, {x: opts.left, y: opts.top});
    } else if( pts && pts.length ){
        pos = null;
    } else {
        // nothing given: put it in the middle of the display
        pos = toImagePos(im, {x: im.display.canvas.width  / 2,
                              y: im.display.canvas.height / 2});
    }
    // --- default vertices are offsets, in display units, from the center
    if( ispoly && !pts ){
        const offsets = shape === "line" ? defaults.linepoints : defaults.polypoints;
        if( Array.isArray(offsets) && offsets.length && pos ){
            const center = toDisplayPos(im, pos);
            pts = offsets.map((offset) => toImagePos(im, {
                x: center.x + toNumber(offset.x, 0),
                y: center.y + toNumber(offset.y, 0)
            }));
        }
    }
    if( pts && pts.length ){
        img.points = pts;
        // vertices given without a center: the center is their centroid
        if( !pos ){
            pos = {
                x: pts.reduce((sum, point) => sum + point.x, 0) / pts.length,
                y: pts.reduce((sum, point) => sum + point.y, 0) / pts.length
            };
        }
    }
    if( pos ){
        img.x = pos.x;
        img.y = pos.y;
    }
    // --- sizes
    img.radius = ilen(opts.radius, defaults.radius);
    img.width  = ilen(opts.width,  defaults.width);
    img.height = ilen(opts.height, defaults.height);
    if( JS9.isNumber(opts.r1) || JS9.isNumber(opts.r2) ){
        img.eradius = {x: ilen(opts.r1, defaults.r1),
                       y: ilen(opts.r2, defaults.r2)};
    } else if( opts.eradius &&
               JS9.isNumber(opts.eradius.x) && JS9.isNumber(opts.eradius.y) ){
        // an eradius from a pub is image units, from the defaults it is not
        img.eradius = {x: opts.eradius.x, y: opts.eradius.y};
    } else {
        img.eradius = {x: ilen(undefined, defaults.r1 ?? defaults.eradius?.x),
                       y: ilen(undefined, defaults.r2 ?? defaults.eradius?.y)};
    }
    return img;
};

// region-string arguments for a shape, in whatever units geom is in
const shapeArgs = (shape, geom, fmt) => {
    const points = Array.isArray(geom.points) ? geom.points : [];
    switch(shape.shape){
    case "line":
    case "polygon":
    case "polyline":
        return points.map((point) => `${fmt(point.x)},${fmt(point.y)}`).join(",");
    case "circle":
        return `${fmt(geom.x)},${fmt(geom.y)},${fmt(geom.radius)}`;
    case "ellipse":
        return `${fmt(geom.x)},${fmt(geom.y)},${fmt(geom.eradius?.x)},${fmt(geom.eradius?.y)},${normalizeAngle(shape.angle)}`;
    case "text":
        return `${fmt(geom.x)},${fmt(geom.y)},"${shape.text || ""}"`;
    case "box":
        return `${fmt(geom.x)},${fmt(geom.y)},${fmt(geom.width)},${fmt(geom.height)},${normalizeAngle(shape.angle)}`;
    default:
        return `${fmt(geom.x)},${fmt(geom.y)}`;
    }
};

// the wcs counterpart of shapeArgs: position in the current wcs system,
// lengths in arcsec (region wcs sizes are always based on cdelt)
const wcsShapeArgs = (im, shape, geom) => {
    let arr;
    const wcsinfo = im.raw.wcsinfo || {cdelt1: 1, cdelt2: 1};
    const fmtlen = (value, which) => {
        const cdelt = which === 2 ? wcsinfo.cdelt2 : wcsinfo.cdelt1;
        if( !JS9.isNumber(value) || !cdelt ){ return "0"; }
        return `${Math.abs(value * cdelt * 3600).toFixed(4)}"`;
    };
    const wcspos = (pos) => {
        try{ arr = JS9.pix2wcs(im.raw.wcs, pos.x, pos.y).trim().split(/\s+/); }
        catch(ignore){ return null; }
        return (arr && arr.length >= 2) ? `${arr[0]},${arr[1]}` : null;
    };
    const points = Array.isArray(geom.points) ? geom.points : [];
    switch(shape.shape){
    case "line":
    case "polygon":
    case "polyline": {
        const strs = points.map(wcspos);
        return strs.every(Boolean) ? strs.join(",") : null;
    }
    default: {
        const center = wcspos(geom);
        if( !center ){ return null; }
        switch(shape.shape){
        case "circle":
            return `${center},${fmtlen(geom.radius, 1)}`;
        case "ellipse":
            return `${center},${fmtlen(geom.eradius?.x, 1)},${fmtlen(geom.eradius?.y, 2)},${normalizeAngle(shape.angle)}`;
        case "text":
            return `${center},"${shape.text || ""}"`;
        case "box":
            return `${center},${fmtlen(geom.width, 1)},${fmtlen(geom.height, 2)},${normalizeAngle(shape.angle)}`;
        default:
            return center;
        }
    }
    }
};

const syncPublicShape = (im, shape, layerName) => {
    let geom, lpos;
    const pub = shape.pub || {};
    const fmt = (value) => JS9.isNumber(value) ? value.toFixed(2) : "0";
    // image geometry for an image layer, display geometry otherwise
    if( im && shape.img ){
        geom = shape.img;
    } else {
        const center = shapeCenter(shape);
        geom = {x: center.x, y: center.y,
                radius: shape.radius, width: shape.width, height: shape.height,
                eradius: shape.eradius,
                points: Array.isArray(shape.points) ? shape.points : undefined};
    }
    pub.id = shape.id;
    pub.shape = shape.shape || shape.type;
    pub.layer = layerName;
    pub.x = geom.x;
    pub.y = geom.y;
    // display coordinates, for callers working directly on the canvas
    pub.dx = shape.left;
    pub.dy = shape.top;
    pub.left = shape.left;
    pub.top = shape.top;
    pub.width = geom.width;
    pub.height = geom.height;
    pub.radius = geom.radius;
    pub.eradius = geom.eradius ? clone(geom.eradius) : undefined;
    if( geom.eradius ){
        pub.r1 = geom.eradius.x;
        pub.r2 = geom.eradius.y;
    }
    pub.radii = shape.radii ? clone(shape.radii) : undefined;
    pub.angle = normalizeAngle(shape.angle);
    pub.color = getShapeColor(shape, null);
    pub.strokeWidth = shape.strokeWidth;
    pub.strokeDashArray = shape.strokeDashArray ? clone(shape.strokeDashArray) : undefined;
    pub.text = shape.text;
    pub.fontSize = shape.fontSize;
    pub.fontFamily = shape.fontFamily;
    pub.tags = clone(shape.tags || []);
    pub.data = clone(shape.data || {});
    pub.pts = Array.isArray(geom.points) ? makePoints(geom.points) : undefined;
    // backlink to the shape object: listRegions and friends reach through it.
    // Non-enumerable, so the cycle it creates is invisible to the deep copies
    // and JSON serialization that pubs get put through.
    if( pub.obj !== shape ){
        Object.defineProperty(pub, "obj", {
            value: shape, writable: true, configurable: true, enumerable: false
        });
    }
    // region strings, as consumed by listRegions/saveRegions
    pub.imsys = "image";
    pub.imstr = `${pub.shape}(${shapeArgs(shape, geom, fmt)})`;
    delete pub.wcsstr;
    delete pub.wcssys;
    delete pub.lcs;
    if( im ){
        // physical coordinates, for the region config dialog
        lpos = im.imageToLogicalPos({x: geom.x, y: geom.y});
        pub.lcs = {x: lpos.x, y: lpos.y, sys: "physical"};
        if( im.validWCS && im.validWCS() ){
            const wcsargs = wcsShapeArgs(im, shape, geom);
            if( wcsargs ){
                pub.wcsstr = `${pub.shape}(${wcsargs})`;
                pub.wcssys = im.params.wcssys;
            }
        }
    }
    shape.pub = pub;
    return shape;
};
const serializableShape = (shape) => {
    return {
        id: shape.id,
        type: shape.type,
        shape: shape.shape,
        img: shape.img ? clone(shape.img) : undefined,
        left: shape.left,
        top: shape.top,
        width: shape.width,
        height: shape.height,
        radius: shape.radius,
        eradius: shape.eradius ? clone(shape.eradius) : undefined,
        points: Array.isArray(shape.points) ? makePoints(shape.points) : undefined,
        angle: shape.angle,
        color: shape.color,
        strokeWidth: shape.strokeWidth,
        strokeDashArray: shape.strokeDashArray ? clone(shape.strokeDashArray) : undefined,
        text: shape.text,
        fontSize: shape.fontSize,
        fontFamily: shape.fontFamily,
        tags: clone(shape.tags || []),
        data: clone(shape.data || {}),
        hidden: !!shape.hidden,
        params: clone(shape.params || {})
    };
};
const makeSelection = (type, objects, canvas) => {
    const members = (objects || []).filter(Boolean);
    return {
        type,
        shape: type,
        canvas,
        objects: members,
        getObjects(){
            return this.objects.slice();
        },
        forEachObject(cb){
            this.objects.forEach(cb);
        },
        addWithUpdate(obj){
            if( obj && this.objects.indexOf(obj) < 0 ){
                this.objects.push(obj);
            }
            return this;
        },
        toGroup(){
            this.type = "group";
            this.shape = "group";
            return this;
        },
        toActiveSelection(){
            this.type = "activeSelection";
            this.shape = "activeSelection";
            return this;
        }
    };
};
const selectObjects = (layer, selector) => {
    const objects = layer.objects || [];
    if( selector === undefined || selector === null || selector === "all" ){
        return objects.slice();
    }
    if( selector === "selected" ){
        return layer.canvas.getActiveObjects().slice();
    }
    if( Array.isArray(selector) ){
        const wanted = new Set(selector.map((item) => typeof item === "object" ? item.id || item.pub?.id : item));
        return objects.filter((shape) => wanted.has(shape.id));
    }
    if( typeof selector === "object" ){
        if( selector.type === "activeSelection" || selector.type === "group" ){
            return selector.getObjects ? selector.getObjects() : [];
        }
        if( selector.id ){
            return objects.filter((shape) => shape.id === selector.id);
        }
        return [];
    }
    return objects.filter((shape) => shape.id === selector || (shape.tags || []).includes(selector));
};
const getDisplayTarget = (display, divjq) => {
    if( divjq ){
        return divjq;
    }
    return display.divjq;
};
const ensureLayerCanvasSize = (dlayer) => {
    const host = dlayer.host;
    const width = parseInt(host.css("width"), 10) || host[0]?.clientWidth || dlayer.display.width || JS9.WIDTH;
    const height = parseInt(host.css("height"), 10) || host[0]?.clientHeight || dlayer.display.height || JS9.HEIGHT;
    dlayer.canvas.width = width;
    dlayer.canvas.height = height;
    dlayer.canvas.element.width = width;
    dlayer.canvas.element.height = height;
    dlayer.canvasjq.attr("width", width);
    dlayer.canvasjq.attr("height", height);
};
const drawShape = (ctx, shape, layer) => {
    const color = getShapeColor(shape, layer);
    const strokeWidth = toNumber(shape.strokeWidth, layer?.opts?.strokeWidth || 1);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = shape.fill || color;
    ctx.lineWidth = strokeWidth;
    if( Array.isArray(shape.strokeDashArray) && ctx.setLineDash ){
        ctx.setLineDash(shape.strokeDashArray);
    }
    switch(shape.shape){
    case "box": {
        const points = rectPoints(shape);
        ctx.beginPath();
        points.forEach((point, index) => {
            if( index === 0 ){
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.closePath();
        ctx.stroke();
        break;
    }
    case "circle": {
        ctx.beginPath();
        ctx.arc(toNumber(shape.left, 0), toNumber(shape.top, 0), toNumber(shape.radius, 1), 0, Math.PI * 2, false);
        ctx.stroke();
        break;
    }
    case "ellipse": {
        const radiusX = toNumber(shape.eradius?.x, toNumber(shape.radius, 1));
        const radiusY = toNumber(shape.eradius?.y, toNumber(shape.radius, 1));
        ctx.beginPath();
        ctx.ellipse(toNumber(shape.left, 0), toNumber(shape.top, 0), radiusX, radiusY, normalizeAngle(shape.angle) * Math.PI / 180, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
    case "line": {
        const points = makePoints(shape.points);
        if( points.length >= 2 ){
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.stroke();
        }
        break;
    }
    case "polygon":
    case "polyline": {
        const points = makePoints(shape.points);
        if( points.length >= 2 ){
            ctx.beginPath();
            points.forEach((point, index) => {
                if( index === 0 ){
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            if( shape.shape === "polygon" ){
                ctx.closePath();
            }
            ctx.stroke();
        }
        break;
    }
    case "text": {
        ctx.font = `${toNumber(shape.fontSize, 12)}px ${shape.fontFamily || "Helvetica"}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = color;
        ctx.fillText(shape.text || "", toNumber(shape.left, 0), toNumber(shape.top, 0));
        break;
    }
    default:
        break;
    }
    ctx.restore();
};
const renderLayer = (dlayer) => {
    if( !dlayer || !dlayer.canvas || !dlayer.canvas.element ){
        return;
    }
    ensureLayerCanvasSize(dlayer);
    const ctx = dlayer.canvas.context;
    ctx.clearRect(0, 0, dlayer.canvas.width, dlayer.canvas.height);
    const image = dlayer.display.image;
    const layer = image && image.layers ? image.layers[dlayer.layerName] : null;
    const objects = layer?.objects || dlayer.canvas.objects || [];
    // shapes on an image layer are pinned to image coordinates, so recompute
    // where they land now: the display transform may have changed under them
    const im = isImageLayer(dlayer) ? image : null;
    dlayer.canvas.objects = objects;
    objects.forEach((shape) => {
        if( shape && !shape.hidden && shape.type !== "activeSelection" && shape.type !== "group" ){
            if( im ){ applyImageGeometry(im, shape); }
            drawShape(ctx, shape, layer || dlayer);
        }
    });
};
const createCanvasController = (dlayer) => {
    const element = dlayer.canvasjq[0];
    const handlers = {};
    return {
        element,
        context: element.getContext("2d"),
        objects: [],
        selection: dlayer.opts?.canvas?.selection !== false,
        _selection: true,
        activeObject: null,
        renderOnAddRemove: false,
        preserveObjectStacking: true,
        width: element.width,
        height: element.height,
        on(name, handler){
            handlers[name] = handlers[name] || [];
            handlers[name].push(handler);
            return this;
        },
        off(name){
            delete handlers[name];
            return this;
        },
        emit(name, payload){
            (handlers[name] || []).forEach((handler) => {
                try{ handler(payload || {}); }
                catch(ignore){ /* empty */ }
            });
            return this;
        },
        add(...objs){
            objs.flat().filter(Boolean).forEach((obj) => {
                if( this.objects.indexOf(obj) < 0 ){
                    this.objects.push(obj);
                }
            });
            if( this.renderOnAddRemove !== false ){
                this.renderAll();
            }
            return this;
        },
        remove(obj){
            this.objects = this.objects.filter((item) => item !== obj);
            if( this.activeObject === obj ){
                this.activeObject = null;
            }
            this.renderAll();
            return this;
        },
        clear(){
            this.objects = [];
            this.activeObject = null;
            this.renderAll();
            return this;
        },
        item(index){
            return this.objects[index] || null;
        },
        getObjects(){
            return this.objects.slice();
        },
        forEachObject(cb){
            this.objects.slice().forEach(cb);
        },
        getActiveObject(){
            return this.activeObject || null;
        },
        getActiveObjects(){
            if( !this.activeObject ){
                return [];
            }
            if( this.activeObject.type === "activeSelection" || this.activeObject.type === "group" ){
                return this.activeObject.getObjects().slice();
            }
            return [this.activeObject];
        },
        setActiveObject(obj){
            this.activeObject = obj || null;
            return this;
        },
        discardActiveObject(){
            this.activeObject = null;
            return this;
        },
        renderAll(){
            this.width = this.element.width;
            this.height = this.element.height;
            renderLayer(dlayer);
            return this;
        },
        requestRenderAll(){
            return this.renderAll();
        },
        calcOffset(){
            return this;
        },
        getElement(){
            return this.element;
        },
        toJSON(){
            return {
                objects: this.objects.map(serializableShape)
            };
        },
        loadFromJSON(json, callback){
            const data = typeof json === "string" ? JSON.parse(json) : (json || {});
            this.objects = (data.objects || []).map((shape) => createShapeObject(dlayer.display.image, dlayer.layerName, shape.shape || shape.type, shape));
            this.renderAll();
            if( typeof callback === "function" ){
                callback();
            }
            return this;
        }
    };
};
const ensureDisplayLayer = (image, layerName) => {
    if( !image || !image.display ){
        return null;
    }
    return image.display.layers[layerName] || image.display.newShapeLayer(layerName, JS9.Fabric.opts);
};
const ensureImageLayer = (image, layerName, layerOpts) => {
    let ilayer;
    const dlayer = ensureDisplayLayer(image, layerName);
    if( !dlayer ){
        return null;
    }
    image.layers = image.layers || {};
    ilayer = image.layers[layerName];
    if( !ilayer ){
        ilayer = image.layers[layerName] = {
            layerName,
            dlayer,
            canvas: dlayer.canvas,
            opts: clone(layerOpts || dlayer.opts || {}),
            objects: [],
            visible: true,
            nshape: 1,
            selection: null,
            catalog: null,
            starbase: null
        };
    }
    dlayer.canvas.objects = ilayer.objects;
    return ilayer;
};
const bindLayerToDisplay = (image, layerName) => {
    if( !image || !image.display || !image.display.layers[layerName] ){
        return null;
    }
    const ilayer = ensureImageLayer(image, layerName);
    const dlayer = image.display.layers[layerName];
    dlayer.canvas.objects = ilayer.objects;
    dlayer.canvas.activeObject = ilayer.activeObject || null;
    renderLayer(dlayer);
    return ilayer;
};
// shape properties worth writing back into a region string, when the
// caller set them. Geometry is excluded: it is emitted as the region args.
// NB: tags are emitted as the region comment, not as a property.
const EXPORT_KEYS = new Set([
    "color", "strokeWidth", "strokeDashArray",
    "fontSize", "fontFamily", "fontStyle", "fontWeight",
    "angle", "text", "textOpts", "data", "id", "wcsconfig",
    "originX", "originY",
    "changeable", "movable", "removable", "resizable", "rotatable",
    "selectable", "sticky", "ignore"
]);

const createShapeObject = (image, layerName, shapeName, opts) => {
    const layer = ensureImageLayer(image, layerName);
    const baseOpts = JS9.extend(true, {}, JS9.Fabric.opts, layer?.opts || {}, opts || {});
    // an image layer positions its shapes in image coordinates; anything
    // else (e.g. the magnifier box) works straight on its own canvas
    const im = layerImage(layer);
    const defaults = JS9.extend(true, {}, JS9.Fabric.opts, layer?.opts || {});
    // a serialized shape already carries its image geometry
    const img = !im ? null
        : (opts?.img ? clone(opts.img)
                     : readGeometry(im, shapeName, opts || {}, defaults));
    const shape = {
        id: baseOpts.id || nextId(layer),
        layer: layerName,
        type: shapeName,
        shape: shapeName,
        img,
        left: toNumber(baseOpts.left, toNumber(baseOpts.x, 0)),
        top: toNumber(baseOpts.top, toNumber(baseOpts.y, 0)),
        width: toNumber(baseOpts.width, JS9.Fabric.opts.width),
        height: toNumber(baseOpts.height, JS9.Fabric.opts.height),
        radius: toNumber(baseOpts.radius, JS9.Fabric.opts.radius),
        eradius: clone(baseOpts.eradius || JS9.Fabric.opts.eradius),
        points: makePoints(baseOpts.points),
        angle: normalizeAngle(baseOpts.angle),
        color: baseOpts.color || baseOpts.stroke || baseOpts.tagcolors?.defcolor || layer?.opts?.tagcolors?.defcolor || JS9.globalOpts.defcolor,
        stroke: baseOpts.stroke || baseOpts.color,
        strokeWidth: toNumber(baseOpts.strokeWidth, JS9.Fabric.opts.strokeWidth),
        strokeDashArray: Array.isArray(baseOpts.strokeDashArray) ? clone(baseOpts.strokeDashArray) : null,
        text: baseOpts.text || "",
        fontSize: toNumber(baseOpts.fontSize, JS9.Fabric.opts.fontSize),
        fontFamily: baseOpts.fontFamily || JS9.Fabric.opts.fontFamily,
        tags: Array.isArray(baseOpts.tags) ? clone(baseOpts.tags) : (typeof baseOpts.tags === "string" ? baseOpts.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : []),
        data: clone(baseOpts.data || {}),
        params: JS9.extend(true, clone(baseOpts), {
            layerName,
            shape: shapeName,
            // properties listRegions/saveRegions should write back out: only
            // the ones the caller actually set, so round-tripped regions do
            // not grow a copy of every layer default
            exports: Object.keys(opts || {}).filter((key) => EXPORT_KEYS.has(key)),
            // text children are not implemented by this engine
            children: []
        }),
        hidden: !!baseOpts.hidden,
        selectable: baseOpts.selectable !== false,
        removable: baseOpts.removable !== false,
        getCenterPoint(){
            return shapeCenter(this);
        },
        getObjects(){
            return [this];
        },
        forEachObject(cb){
            cb(this);
        }
    };
    if( im ){
        // derive the drawn geometry from the image geometry we just read
        applyImageGeometry(im, shape);
    } else if( !shape.points.length && shape.shape === "line" ){
        const width = toNumber(shape.width, 0);
        shape.points = [{x: shape.left - width / 2, y: shape.top}, {x: shape.left + width / 2, y: shape.top}];
    }
    return syncPublicShape(im, shape, layerName);
};
const selectorToIds = (canvas) => {
    return canvas.getActiveObjects().map((shape) => shape.id);
};

JS9.Fabric.newShapeLayer = function(layerName, layerOpts, divjq){
    let id;
    let dlayer;
    const display = this;
    if( !display || !layerName ){
        return null;
    }
    if( display.layers[layerName] ){
        return display.layers[layerName];
    }
    display.layers[layerName] = {};
    dlayer = display.layers[layerName];
    dlayer.layerName = layerName;
    dlayer.display = display;
    dlayer.params = {sel: null, sellayer: null};
    dlayer.opts = clone(layerOpts || {});
    dlayer.opts.canvas = dlayer.opts.canvas || {};
    dlayer.host = getDisplayTarget(display, divjq);
    dlayer.dtype = divjq ? "other" : "main";
    id = `${dlayer.host.attr("id") || display.id}-${layerName.replace(/\s+/g, "_")}-shapeLayer`;
    dlayer.divjq = JS9.wrapCollection(document.createElement("div"));
    dlayer.divjq.addClass("JS9Container").css("z-index", JS9.SHAPEZINDEX).appendTo(dlayer.host);
    dlayer.canvasjq = JS9.wrapCollection(document.createElement("canvas"));
    dlayer.canvasjq.addClass("JS9Layer").attr("id", id).appendTo(dlayer.divjq);
    dlayer.canvas = createCanvasController(dlayer);
    ensureLayerCanvasSize(dlayer);
    renderLayer(dlayer);
    return dlayer;
};

JS9.Fabric.showShapeLayer = function(layerName, mode){
    const layer = this.getShapeLayer(layerName);
    if( !layer ){
        return null;
    }
    layer.visible = mode !== false;
    layer.dlayer.divjq.css("display", layer.visible ? "block" : "none");
    if( layer.visible ){
        bindLayerToDisplay(this, layerName);
    }
    return layer;
};

JS9.Fabric.displayShapeLayers = function(){
    Object.keys(this.layers || {}).forEach((layerName) => {
        const layer = bindLayerToDisplay(this, layerName);
        if( layer && layer.visible === false ){
            layer.dlayer.divjq.css("display", "none");
        }
    });
    return this;
};

JS9.Fabric.toggleShapeLayers = function(){
    Object.keys(this.layers || {}).forEach((layerName) => {
        const layer = this.layers[layerName];
        this.showShapeLayer(layerName, layer ? !layer.visible : true);
    });
    return this;
};

JS9.Fabric.getShapeLayer = function(layerName){
    return ensureImageLayer(this, layerName);
};

JS9.Fabric.activeShapeLayer = function(layerName){
    if( layerName && this.layers && this.layers[layerName] ){
        this.layer = layerName;
    }
    return this.layer || layerName || "regions";
};

JS9.Fabric._parseShapeOptions = function(_layerName, opts){
    return clone(opts || {});
};

JS9.Fabric._exportShapeOptions = function(opts){
    return clone(opts || {});
};

JS9.Fabric._handleChildText = function(){ return null; };
JS9.Fabric._addPolygonPoint = function(){ return null; };
JS9.Fabric._removePolygonPoint = function(){ return null; };
JS9.Fabric._ungroupAnnulus = function(){ return null; };
JS9.Fabric._regroupAnnulus = function(){ return null; };
JS9.Fabric._updateMultiDialogs = function(){ return this; };
JS9.Fabric.updateChildren = function(){ return null; };
JS9.Fabric.addPolygonAnchors = function(){ return null; };
JS9.Fabric.removePolygonAnchors = function(){ return null; };
JS9.Fabric.saveSelection = function(layerName){
    const layer = this.getShapeLayer(layerName);
    if( layer ){
        layer.savedSelection = selectorToIds(layer.canvas);
    }
    return layer;
};
JS9.Fabric.restoreSelection = function(layerName){
    const layer = this.getShapeLayer(layerName);
    if( layer && Array.isArray(layer.savedSelection) ){
        return this.selectShapes(layerName, layer.savedSelection);
    }
    return null;
};

JS9.Fabric.addShapes = function(layerName, shape, myopts){
    const layer = ensureImageLayer(this, layerName, myopts);
    const objects = [];
    const opts = clone(myopts || {});
    const im = layerImage(layer);
    const addOne = (entry) => {
        const type = entry.shape || entry.type || opts.shape || layer.opts.shape || "box";
        if( !SHAPE_TYPES.has(type) ){
            return;
        }
        // per-shape options win over the options common to the whole call
        objects.push(createShapeObject(this, layerName, type,
                                       JS9.extend(true, {}, opts, entry)));
    };
    if( !layer ){
        return null;
    }
    if( shape === undefined || shape === null ){
        return null;
    }
    if( Array.isArray(shape) ){
        shape.forEach((entry) => {
            if( typeof entry === "object" ){
                addOne(entry);
            }
        });
    } else if( typeof shape === "object" && !Array.isArray(shape) ){
        addOne(shape);
    } else if( typeof shape === "string" ){
        if( SHAPE_TYPES.has(shape) ){
            objects.push(createShapeObject(this, layerName, shape, opts));
        } else if( shape.trim() === "" ){
            return opts.rtn === "objs" ? [] : null;
        } else if( typeof this.parseRegions === "function" ){
            // a region string, e.g. 'circle(265,380,10) # source'
            // or a whole region file: parse it into per-shape options
            this.parseRegions(shape, opts).forEach((entry) => {
                if( entry && !entry.remove ){
                    addOne(entry);
                }
            });
        }
    }
    objects.forEach((obj) => {
        layer.objects.push(obj);
        syncPublicShape(im, obj, layerName);
    });
    bindLayerToDisplay(this, layerName);
    layer.canvas.renderAll();
    if( opts.rtn === "objs" ){
        return objects;
    }
    if( objects.length === 1 ){
        return objects[0].id;
    }
    return objects.map((obj) => obj.id);
};

JS9.Fabric._parseShapes = function(layerName, selection){
    const layer = this.getShapeLayer(layerName);
    if( !layer ){
        return [];
    }
    return selectObjects(layer, selection).map((shape) => shape.id);
};

JS9.Fabric._selectShapes = function(layerName, selection, _opts, cb){
    const layer = this.getShapeLayer(layerName);
    const matches = layer ? selectObjects(layer, selection) : [];
    matches.forEach((shape) => {
        cb(shape, null);
    });
    return matches;
};

JS9.Fabric.selectShapes = function(layerName, shape, opts){
    const layer = this.getShapeLayer(layerName);
    let matches;
    if( !layer ){
        return null;
    }
    opts = opts || {};
    if( shape === "reset" ){
        layer.selection = null;
        layer.canvas.discardActiveObject();
        layer.canvas.renderAll();
        return null;
    }
    matches = selectObjects(layer, shape);
    layer.selection = shape;
    if( !matches.length ){
        layer.canvas.discardActiveObject();
        layer.canvas.renderAll();
        return null;
    }
    if( matches.length === 1 ){
        layer.canvas.setActiveObject(matches[0]);
        if( opts.activateselection !== false ){
            layer.canvas.emit("selection:created", {target: matches[0]});
        }
        layer.canvas.renderAll();
        return matches[0];
    }
    const selection = makeSelection("activeSelection", matches, layer.canvas);
    layer.canvas.setActiveObject(selection);
    if( opts.activateselection !== false ){
        layer.canvas.emit("selection:created", {selected: matches, target: selection});
    }
    layer.canvas.renderAll();
    return selection;
};

JS9.Fabric.unselectShapes = function(layerName, shape){
    const layer = this.getShapeLayer(layerName);
    if( !layer ){
        return null;
    }
    if( !shape || shape === "selected" || shape === "all" ){
        layer.canvas.discardActiveObject();
        layer.canvas.renderAll();
        return null;
    }
    return this.selectShapes(layerName, shape);
};

JS9.Fabric.updateShapes = function(layerName){
    const layer = this.getShapeLayer(layerName);
    if( layer ){
        bindLayerToDisplay(this, layerName);
        layer.canvas.renderAll();
    }
    return this;
};

JS9.Fabric.lookupGroup = function(group, layerName){
    const layer = this.getShapeLayer(layerName || "regions");
    if( !layer ){
        return null;
    }
    return (layer.objects || []).find((shape) => shape.groupid === group || shape.id === group) || null;
};

JS9.Fabric.listGroups = function(_which, _opts, layerName){
    const layer = this.getShapeLayer(layerName || "regions");
    if( !layer ){
        return [];
    }
    return (layer.objects || []).filter((shape) => !!shape.groupid).map((shape) => shape.groupid);
};

JS9.Fabric.groupShapes = function(layerName, shape){
    const layer = this.getShapeLayer(layerName);
    const matches = layer ? selectObjects(layer, shape) : [];
    if( !matches.length ){
        return null;
    }
    const selection = makeSelection("group", matches, layer.canvas);
    selection.id = `group${Date.now()}`;
    matches.forEach((item) => {
        item.groupid = selection.id;
    });
    layer.canvas.setActiveObject(selection);
    return selection;
};

JS9.Fabric.ungroupShapes = function(layerName, groupid){
    const layer = this.getShapeLayer(layerName);
    if( !layer ){
        return null;
    }
    (layer.objects || []).forEach((shape) => {
        if( !groupid || shape.groupid === groupid ){
            delete shape.groupid;
        }
    });
    layer.canvas.discardActiveObject();
    layer.canvas.renderAll();
    return this;
};

JS9.Fabric.removeShapes = function(layerName, shape, opts){
    const layer = this.getShapeLayer(layerName);
    let matches;
    if( !layer ){
        return null;
    }
    opts = opts || {};
    matches = shape === "all" || shape === null ? layer.objects.slice() : selectObjects(layer, shape || "selected");
    if( !opts.overrideRemovable ){
        matches = matches.filter((obj) => obj.removable !== false);
    }
    layer.objects = layer.objects.filter((obj) => matches.indexOf(obj) < 0);
    layer.canvas.objects = layer.objects;
    if( layer.canvas.getActiveObject() && matches.indexOf(layer.canvas.getActiveObject()) >= 0 ){
        layer.canvas.discardActiveObject();
    }
    layer.canvas.renderAll();
    if( JS9.globalOpts.resetEmptyShapeId && !layer.objects.length ){
        layer.nshape = 1;
    }
    return this;
};

JS9.Fabric.getShapes = function(layerName, shape, opts){
    const layer = this.getShapeLayer(layerName);
    const matches = layer ? selectObjects(layer, shape || "all") : [];
    const im = layerImage(layer);
    opts = opts || {};
    if( opts.format === "text" ){
        return matches
            .map((obj) => syncPublicShape(im, obj, layerName).pub.imstr)
            .join(";\n");
    }
    return matches.map((obj) => syncPublicShape(im, obj, layerName).pub);
};

// geometry keys of changeShapes(), in image units on an image layer
const IMAGE_GEOMETRY_KEYS = new Set(["x", "y", "radius", "width", "height",
                                     "r1", "r2", "eradius", "pts",
                                     "deltax", "deltay"]);

JS9.Fabric.changeShapes = function(layerName, shape, opts){
    const layer = this.getShapeLayer(layerName);
    const matches = layer ? selectObjects(layer, shape || "selected") : [];
    const im = layerImage(layer);
    opts = opts || {};
    matches.forEach((obj) => {
        let touchedDisplay = false;
        Object.keys(opts).forEach((key) => {
            if( im && IMAGE_GEOMETRY_KEYS.has(key) ){
                // image-space geometry: recorded now, drawn on the next render
                obj.img = obj.img || {};
                switch(key){
                case "deltax":
                case "deltay": {
                    // shift by whole image pixels, outline included
                    const axis = key === "deltax" ? "x" : "y";
                    const delta = toNumber(opts[key], 0);
                    if( JS9.isNumber(obj.img[axis]) ){
                        obj.img[axis] += delta;
                    }
                    if( Array.isArray(obj.img.points) ){
                        obj.img.points.forEach((point) => {
                            point[axis] += delta;
                        });
                    }
                    break;
                }
                case "r1":
                    obj.img.eradius = obj.img.eradius || {};
                    obj.img.eradius.x = toNumber(opts[key], obj.img.eradius.x);
                    break;
                case "r2":
                    obj.img.eradius = obj.img.eradius || {};
                    obj.img.eradius.y = toNumber(opts[key], obj.img.eradius.y);
                    break;
                case "eradius":
                    obj.img.eradius = clone(opts[key]);
                    break;
                case "pts": {
                    const pts = makePoints(opts[key]);
                    obj.img.points = pts;
                    // a new outline moves the center with it
                    if( pts.length ){
                        obj.img.x = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
                        obj.img.y = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
                    }
                    break;
                }
                default:
                    obj.img[key] = toNumber(opts[key], obj.img[key]);
                    break;
                }
            } else if( key === "x" ){
                obj.left = toNumber(opts[key], obj.left);
                touchedDisplay = true;
            } else if( key === "y" ){
                obj.top = toNumber(opts[key], obj.top);
                touchedDisplay = true;
            } else if( key === "tags" ){
                obj.tags = Array.isArray(opts[key]) ? clone(opts[key]) : String(opts[key]).split(",").map((tag) => tag.trim()).filter(Boolean);
            } else if( key === "points" ){
                obj.points = makePoints(opts[key]);
                touchedDisplay = true;
            } else {
                obj[key] = clone(opts[key]);
                if( key === "left" || key === "top" ){
                    touchedDisplay = true;
                }
            }
        });
        if( im ){
            if( touchedDisplay ){
                // positioned on the canvas: keep the image geometry in step
                captureImageGeometry(im, obj);
            }
            applyImageGeometry(im, obj);
        }
        syncPublicShape(im, obj, layerName);
    });
    if( layer ){
        layer.canvas.renderAll();
    }
    return matches.length === 1 ? matches[0] : matches;
};

JS9.Fabric.refreshShapes = function(layerName){
    const layer = this.getShapeLayer(layerName);
    const im = layerImage(layer);
    if( layer ){
        // the display transform may have changed: re-derive positions
        if( im ){
            (layer.objects || []).forEach((obj) => {
                applyImageGeometry(im, obj);
                syncPublicShape(im, obj, layerName);
            });
        }
        layer.canvas.renderAll();
    }
    return this;
};

JS9.Fabric.copyShapes = function(layerName, to, which){
    const shapes = this.getShapes(layerName, which || "all");
    if( !shapes || !shapes.length ){
        return null;
    }
    const tim = JS9.lookupImage(to) || JS9.getImage(to);
    if( tim ){
        return tim.addShapes(layerName, shapes.map((shape) => clone(shape)), {rtn: "objs"});
    }
    return null;
};

JS9.Fabric.print = function(){
    return this;
};

JS9.Fabric.installDisplayApi = function(){
    JS9.Display.prototype.newShapeLayer = JS9.Fabric.newShapeLayer;
    JS9.Image.prototype._selectShapes = JS9.Fabric._selectShapes;
    JS9.Image.prototype._updateShape = JS9.Fabric.changeShapes;
    JS9.Image.prototype._parseShapes = JS9.Fabric._parseShapes;
    JS9.Image.prototype._parseShapeOptions = JS9.Fabric._parseShapeOptions;
    JS9.Image.prototype._exportShapeOptions = JS9.Fabric._exportShapeOptions;
    JS9.Image.prototype._handleChildText = JS9.Fabric._handleChildText;
    JS9.Image.prototype._addPolygonPoint = JS9.Fabric._addPolygonPoint;
    JS9.Image.prototype._removePolygonPoint = JS9.Fabric._removePolygonPoint;
    JS9.Image.prototype._ungroupAnnulus = JS9.Fabric._ungroupAnnulus;
    JS9.Image.prototype._regroupAnnulus = JS9.Fabric._regroupAnnulus;
    JS9.Image.prototype._updateMultiDialogs = JS9.Fabric._updateMultiDialogs;
    JS9.Image.prototype.addShapes = JS9.Fabric.addShapes;
    JS9.Image.prototype.updateShapes = JS9.Fabric.updateShapes;
    JS9.Image.prototype.getShapes = JS9.Fabric.getShapes;
    JS9.Image.prototype.changeShapes = JS9.Fabric.changeShapes;
    JS9.Image.prototype.removeShapes = JS9.Fabric.removeShapes;
    JS9.Image.prototype.refreshShapes = JS9.Fabric.refreshShapes;
    JS9.Image.prototype.copyShapes = JS9.Fabric.copyShapes;
    JS9.Image.prototype.selectShapes = JS9.Fabric.selectShapes;
    JS9.Image.prototype.unselectShapes = JS9.Fabric.unselectShapes;
    JS9.Image.prototype.groupShapes = JS9.Fabric.groupShapes;
    JS9.Image.prototype.ungroupShapes = JS9.Fabric.ungroupShapes;
    JS9.Image.prototype.listGroups = JS9.Fabric.listGroups;
    JS9.Image.prototype.lookupGroup = JS9.Fabric.lookupGroup;
    JS9.Image.prototype.saveSelection = JS9.Fabric.saveSelection;
    JS9.Image.prototype.restoreSelection = JS9.Fabric.restoreSelection;
    JS9.Image.prototype.getShapeLayer = JS9.Fabric.getShapeLayer;
    JS9.Image.prototype.showShapeLayer = JS9.Fabric.showShapeLayer;
    JS9.Image.prototype.activeShapeLayer = JS9.Fabric.activeShapeLayer;
    JS9.Image.prototype.displayShapeLayers = JS9.Fabric.displayShapeLayers;
    JS9.Image.prototype.toggleShapeLayers = JS9.Fabric.toggleShapeLayers;
    JS9.Image.prototype.print = JS9.Fabric.print;
};

JS9.Fabric.initGraphics = function(){
    JS9.Fabric.installDisplayApi();
};

const nativeEngine = {
    init: () => {},
    installDisplayApi: () => {
        JS9.Fabric.installDisplayApi();
    },
    getDefaultOptions: () => {
        return JS9.Fabric.opts;
    },
    applyDefaults: (defaults) => {
        JS9.extend(true, JS9.Fabric.opts, defaults || {});
    },
    getDevicePixelRatio: () => {
        return window.devicePixelRatio || 1;
    },
    createActiveSelection: (objects, canvas) => {
        return makeSelection("activeSelection", objects || [], canvas || null);
    },
    buildSelection: (objects, canvas) => {
        if( !objects || !objects.length ){
            return null;
        }
        if( objects.length === 1 ){
            return objects[0];
        }
        return makeSelection("activeSelection", objects, canvas || null);
    },
    activateSelection: (canvas, selection) => {
        if( !canvas || !selection ){
            return null;
        }
        canvas.setActiveObject(selection);
        canvas.renderAll();
        return selection;
    },
    clearSelection: (canvas) => {
        if( canvas ){
            canvas.discardActiveObject();
            canvas.renderAll();
        }
        return canvas;
    },
    groupSelection: (canvas, objects) => {
        if( !objects || !objects.length ){
            return null;
        }
        const selection = objects.length === 1 ? objects[0] : makeSelection("group", objects, canvas || null);
        if( canvas ){
            canvas.setActiveObject(selection);
            canvas.renderAll();
        }
        return selection;
    },
    updateChildren: () => {}
};

if( JS9.ShapeEngine && typeof JS9.ShapeEngine.register === "function" && typeof JS9.ShapeEngine.use === "function" ){
    JS9.ShapeEngine.register("native", nativeEngine);
    JS9.ShapeEngine.register("fabric", nativeEngine);
    if( !JS9.ShapeEngine.use(JS9.globalOpts.shapeEngine || "native") ){
        JS9.ShapeEngine.use("native");
    }
} else {
    JS9.Fabric.initGraphics();
}
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallNativeShapeEngine = JS9InstallNativeShapeEngine;
    globalThis.JS9InstallFabricEngine = JS9InstallNativeShapeEngine;
}
