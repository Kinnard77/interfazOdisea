/* ============================================================================
   Trazo Studio — editor de trazos vectoriales
   ----------------------------------------------------------------------------
   Modelo de datos (todo en milímetros, origen arriba-izquierda de la página):

     doc    = { name, page:{w,h,label}, layers:[capa], active }
     capa   = { id, name, visible, locked, items:[objeto] }
     objeto = { id, type:'path', subs:[subtrazo], stroke, width, fill, ... }
            | { id, type:'text', x, y, text, size, fill, align }
     subtrazo = { closed, nodes:[nodo] }
     nodo   = { x, y, hi:{x,y}|null, ho:{x,y}|null }   // manijas absolutas

   Un "trazo" es un objeto de tipo path: puede contener varios subtrazos
   (trazo compuesto), lo que permite agujeros y resultados de operaciones
   booleanas dentro de un mismo objeto.
   ========================================================================== */

'use strict';

/* ========================================================================== */
/*  1. Utilidades                                                             */
/* ========================================================================== */

var uidCounter = 0;
function uid(p) { return (p || 'o') + (Date.now().toString(36)) + (uidCounter++).toString(36); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function fmt(n, d) { return (Math.round(n * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).toFixed(d == null ? 1 : d); }
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

var PAGE_PRESETS = {
    A4: [210, 297], A3: [297, 420], A5: [148, 210],
    Carta: [215.9, 279.4], Oficio: [215.9, 355.6], Tabloide: [279.4, 431.8]
};

/* ========================================================================== */
/*  2. Estado                                                                 */
/* ========================================================================== */

function newLayer(name) {
    return { id: uid('l'), name: name, visible: true, locked: false, items: [] };
}

function newDoc() {
    return {
        name: 'trazo',
        page: { w: 210, h: 297, label: 'A4' },
        layers: [newLayer('Capa 1')],
        active: 0
    };
}

var doc = newDoc();

var view = { x: -12, y: -12, z: 3 };          // x,y = mm del documento en pantalla (0,0); z = px/mm
var tool = 'select';
var sel = [];                                  // ids de objetos seleccionados
var nodeSel = [];                              // [{id, si, ni}] nodos seleccionados
var clipboard = null;
var undoStack = [], redoStack = [];
var toastTimer = null;

var style = {
    stroke: '#111827', width: 0.35, fill: null, fillRule: 'nonzero',
    dash: '', cap: 'round', join: 'round', opacity: 1,
    textSize: 6, textAlign: 'left'
};

var opts = { grid: true, gridStep: 10, snapGrid: true, snapNode: true, outline: false, tol: 0.6 };

/* Estado transitorio de interacción */
var drag = null;      // {mode, ...}
var pen = null;       // trazo en construcción
var hover = null;     // {id} objeto bajo el cursor
var cursorMm = { x: 0, y: 0 };
var spaceDown = false;
var measureLine = null;

/* ========================================================================== */
/*  3. Acceso al modelo                                                       */
/* ========================================================================== */

function activeLayer() { return doc.layers[clamp(doc.active, 0, doc.layers.length - 1)]; }

function eachItem(fn) {
    doc.layers.forEach(function (layer, li) {
        layer.items.forEach(function (it, ii) { fn(it, layer, li, ii); });
    });
}

function findItem(id) {
    var found = null;
    eachItem(function (it, layer, li, ii) { if (it.id === id) found = { item: it, layer: layer, li: li, ii: ii }; });
    return found;
}

function selItems() {
    var out = [];
    sel.forEach(function (id) { var f = findItem(id); if (f) out.push(f.item); });
    return out;
}

function addItem(item, layer) {
    (layer || activeLayer()).items.push(item);
    return item;
}

function removeItem(id) {
    doc.layers.forEach(function (layer) {
        var i = layer.items.findIndex(function (it) { return it.id === id; });
        if (i >= 0) layer.items.splice(i, 1);
    });
}

function newPath(subs, override) {
    var it = {
        id: uid('p'), type: 'path', subs: subs || [],
        stroke: style.stroke, width: style.width,
        fill: style.fill, fillRule: style.fillRule,
        dash: style.dash || null, cap: style.cap, join: style.join,
        opacity: style.opacity
    };
    if (override) Object.assign(it, override);
    return it;
}

function node(x, y, hi, ho) { return { x: x, y: y, hi: hi || null, ho: ho || null }; }

/* ========================================================================== */
/*  4. Historial                                                              */
/* ========================================================================== */

function snapshot() {
    return JSON.stringify({ doc: doc, sel: sel });
}

function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > 120) undoStack.shift();
    redoStack.length = 0;
    updateUndoButtons();
}

function restore(str) {
    var s = JSON.parse(str);
    doc = s.doc;
    sel = s.sel || [];
    nodeSel = [];
    pen = null;
    syncPanels();
    renderLayers();
    draw();
}

function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    updateUndoButtons();
    toast('Deshecho');
}

function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    updateUndoButtons();
    toast('Rehecho');
}

function updateUndoButtons() {
    var u = $('#btnUndo'), r = $('#btnRedo');
    if (u) u.disabled = !undoStack.length;
    if (r) r.disabled = !redoStack.length;
}

/* ========================================================================== */
/*  5. Geometría                                                              */
/* ========================================================================== */

function segOf(sub, i) {
    var n = sub.nodes;
    var a = n[i], b = n[(i + 1) % n.length];
    return {
        p0: { x: a.x, y: a.y },
        c1: a.ho ? { x: a.ho.x, y: a.ho.y } : null,
        c2: b.hi ? { x: b.hi.x, y: b.hi.y } : null,
        p1: { x: b.x, y: b.y }
    };
}

function segCount(sub) {
    return sub.closed ? sub.nodes.length : Math.max(0, sub.nodes.length - 1);
}

function isCurve(s) { return !!(s.c1 || s.c2); }

function ctrl(s) {
    return { c1: s.c1 || s.p0, c2: s.c2 || s.p1 };
}

function bezAt(s, t) {
    if (!isCurve(s)) {
        return { x: s.p0.x + (s.p1.x - s.p0.x) * t, y: s.p0.y + (s.p1.y - s.p0.y) * t };
    }
    var c = ctrl(s), u = 1 - t;
    var a = u * u * u, b = 3 * u * u * t, cc = 3 * u * t * t, d = t * t * t;
    return {
        x: a * s.p0.x + b * c.c1.x + cc * c.c2.x + d * s.p1.x,
        y: a * s.p0.y + b * c.c1.y + cc * c.c2.y + d * s.p1.y
    };
}

/* Divide un segmento en t devolviendo los dos tramos (de Casteljau) */
function bezSplit(s, t) {
    if (!isCurve(s)) {
        var m = bezAt(s, t);
        return [
            { p0: s.p0, c1: null, c2: null, p1: m },
            { p0: m, c1: null, c2: null, p1: s.p1 }
        ];
    }
    var c = ctrl(s);
    var lerp = function (a, b) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
    var p01 = lerp(s.p0, c.c1), p12 = lerp(c.c1, c.c2), p23 = lerp(c.c2, s.p1);
    var p012 = lerp(p01, p12), p123 = lerp(p12, p23);
    var mid = lerp(p012, p123);
    return [
        { p0: s.p0, c1: p01, c2: p012, p1: mid },
        { p0: mid, c1: p123, c2: p23, p1: s.p1 }
    ];
}

function segSteps(s, tol) {
    if (!isCurve(s)) return 1;
    var c = ctrl(s);
    var len = dist(s.p0, c.c1) + dist(c.c1, c.c2) + dist(c.c2, s.p1);
    return clamp(Math.ceil(len / Math.max(tol || 0.25, 0.05) / 3), 6, 96);
}

/* Aplana un subtrazo a una polilínea de puntos (mm) */
function flattenSub(sub, tol) {
    var pts = [], i, k, s, steps;
    if (!sub.nodes.length) return pts;
    pts.push({ x: sub.nodes[0].x, y: sub.nodes[0].y });
    for (i = 0; i < segCount(sub); i++) {
        s = segOf(sub, i);
        steps = segSteps(s, tol);
        for (k = 1; k <= steps; k++) pts.push(bezAt(s, k / steps));
    }
    if (sub.closed && pts.length > 1) pts.pop();
    return pts;
}

function polyToSub(pts, closed) {
    return { closed: !!closed, nodes: pts.map(function (p) { return node(p.x, p.y); }) };
}

/* Recorrido por todos los puntos de un objeto (nodos + manijas) */
function eachPoint(item, fn) {
    if (item.type === 'text') { fn(item); return; }
    item.subs.forEach(function (sub) {
        sub.nodes.forEach(function (n) {
            fn(n);
            if (n.hi) fn(n.hi);
            if (n.ho) fn(n.ho);
        });
    });
}

function bboxOfItems(items) {
    var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    items.forEach(function (item) {
        var ib = itemBBox(item);
        if (!ib) return;
        b.x0 = Math.min(b.x0, ib.x0); b.y0 = Math.min(b.y0, ib.y0);
        b.x1 = Math.max(b.x1, ib.x1); b.y1 = Math.max(b.y1, ib.y1);
    });
    return isFinite(b.x0) ? b : null;
}

function itemBBox(item) {
    if (item.type === 'text') {
        var w = TrazoExport.measureHelvetica(item.text || '', item.size);
        var x0 = item.align === 'center' ? item.x - w / 2 : item.align === 'right' ? item.x - w : item.x;
        return { x0: x0, y0: item.y - item.size * 0.718, x1: x0 + w, y1: item.y + item.size * 0.207 };
    }
    var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    item.subs.forEach(function (sub) {
        flattenSub(sub, 0.4).forEach(function (p) {
            b.x0 = Math.min(b.x0, p.x); b.y0 = Math.min(b.y0, p.y);
            b.x1 = Math.max(b.x1, p.x); b.y1 = Math.max(b.y1, p.y);
        });
    });
    return isFinite(b.x0) ? b : null;
}

function transformItem(item, fn) {
    if (item.type === 'text') {
        var p = fn({ x: item.x, y: item.y });
        item.x = p.x; item.y = p.y;
        if (p.scale) item.size = Math.max(0.2, item.size * p.scale);
        return;
    }
    item.subs.forEach(function (sub) {
        sub.nodes.forEach(function (n) {
            var p = fn(n); n.x = p.x; n.y = p.y;
            if (n.hi) { var a = fn(n.hi); n.hi = { x: a.x, y: a.y }; }
            if (n.ho) { var b = fn(n.ho); n.ho = { x: b.x, y: b.y }; }
        });
    });
}

function moveItem(item, dx, dy) {
    transformItem(item, function (p) { return { x: p.x + dx, y: p.y + dy }; });
}

function scaleItems(items, ox, oy, sx, sy) {
    var s = (Math.abs(sx) + Math.abs(sy)) / 2;
    items.forEach(function (item) {
        transformItem(item, function (p) {
            return { x: ox + (p.x - ox) * sx, y: oy + (p.y - oy) * sy, scale: s };
        });
    });
}

function rotateItems(items, ox, oy, deg) {
    var a = deg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    items.forEach(function (item) {
        transformItem(item, function (p) {
            var dx = p.x - ox, dy = p.y - oy;
            return { x: ox + dx * cos - dy * sin, y: oy + dx * sin + dy * cos };
        });
    });
}

/* Distancia punto-segmento y proyección */
function projectOnSegment(p, a, b) {
    var vx = b.x - a.x, vy = b.y - a.y;
    var len2 = vx * vx + vy * vy;
    var t = len2 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2 : 0;
    t = clamp(t, 0, 1);
    var q = { x: a.x + vx * t, y: a.y + vy * t };
    return { t: t, point: q, dist: dist(p, q) };
}

function pointInPoly(p, poly) {
    var inside = false, i, j, xi, yi, xj, yj;
    for (i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        xi = poly[i].x; yi = poly[i].y; xj = poly[j].x; yj = poly[j].y;
        if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

function pointInRings(p, rings) {
    var inside = false;
    rings.forEach(function (r) { if (pointInPoly(p, r)) inside = !inside; });
    return inside;
}

/* Punto más cercano de un objeto: {dist, si, i, t, point} */
function closestOnItem(item, p) {
    var best = null;
    if (item.type === 'text') {
        var b = itemBBox(item);
        var inside = p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
        return { dist: inside ? 0 : Infinity, si: -1, i: -1, t: 0, point: p };
    }
    item.subs.forEach(function (sub, si) {
        for (var i = 0; i < segCount(sub); i++) {
            var s = segOf(sub, i), steps = segSteps(s, 0.3), prev = s.p0, k, cur, pr;
            for (k = 1; k <= steps; k++) {
                cur = bezAt(s, k / steps);
                pr = projectOnSegment(p, prev, cur);
                if (!best || pr.dist < best.dist) {
                    best = { dist: pr.dist, si: si, i: i, t: (k - 1 + pr.t) / steps, point: pr.point };
                }
                prev = cur;
            }
        }
    });
    return best || { dist: Infinity };
}

function itemFilled(item, p) {
    if (!item.fill) return false;
    var rings = item.subs.filter(function (s) { return s.closed; })
        .map(function (s) { return flattenSub(s, 0.4); });
    return pointInRings(p, rings);
}

/* ========================================================================== */
/*  6. Vista y conversión de coordenadas                                      */
/* ========================================================================== */

var cv = $('#cv');
var ctx = cv.getContext('2d');

function toScreen(p) { return { x: (p.x - view.x) * view.z, y: (p.y - view.y) * view.z }; }
function toDoc(p) { return { x: p.x / view.z + view.x, y: p.y / view.z + view.y }; }

function canvasPoint(ev) {
    var r = cv.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function eventDoc(ev) { return toDoc(canvasPoint(ev)); }

function resizeCanvas() {
    var r = cv.parentElement.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
}

function fitPage() {
    var r = cv.parentElement.getBoundingClientRect();
    var z = Math.min(r.width / (doc.page.w + 24), r.height / (doc.page.h + 24));
    view.z = z;
    view.x = doc.page.w / 2 - r.width / 2 / z;
    view.y = doc.page.h / 2 - r.height / 2 / z;
    draw();
}

function zoomAt(factor, sp) {
    var before = toDoc(sp);
    view.z = clamp(view.z * factor, 0.15, 80);
    var after = toDoc(sp);
    view.x += before.x - after.x;
    view.y += before.y - after.y;
    draw();
}

function zoomButton(factor) {
    var r = cv.getBoundingClientRect();
    zoomAt(factor, { x: r.width / 2, y: r.height / 2 });
}

/* ========================================================================== */
/*  7. Ajuste (snap) y detección                                              */
/* ========================================================================== */

var lastSnap = null;

function snapPoint(p, exclude) {
    var tol = 9 / view.z, best = null, res = { x: p.x, y: p.y }, i;
    lastSnap = null;

    if (opts.snapNode) {
        eachItem(function (item, layer) {
            if (!layer.visible || layer.locked) return;
            if (exclude && exclude.indexOf(item.id) >= 0) return;
            if (item.type === 'text') return;
            item.subs.forEach(function (sub) {
                sub.nodes.forEach(function (n) {
                    var d = dist(p, n);
                    if (d < tol && (!best || d < best.d)) best = { d: d, x: n.x, y: n.y };
                });
            });
        });
        if (best) { lastSnap = { x: best.x, y: best.y, kind: 'nodo' }; return { x: best.x, y: best.y }; }
    }

    if (opts.snapGrid && opts.gridStep > 0) {
        var g = opts.gridStep;
        var gx = Math.round(p.x / g) * g, gy = Math.round(p.y / g) * g;
        if (Math.abs(gx - p.x) < tol && Math.abs(gy - p.y) < tol) {
            lastSnap = { x: gx, y: gy, kind: 'rejilla' };
            return { x: gx, y: gy };
        }
        if (Math.abs(gx - p.x) < tol) res.x = gx;
        if (Math.abs(gy - p.y) < tol) res.y = gy;
    }
    return res;
}

function constrainAngle(from, to, stepDeg) {
    var step = (stepDeg || 15) * Math.PI / 180;
    var a = Math.atan2(to.y - from.y, to.x - from.x);
    var r = Math.hypot(to.x - from.x, to.y - from.y);
    a = Math.round(a / step) * step;
    return { x: from.x + Math.cos(a) * r, y: from.y + Math.sin(a) * r };
}

function hitTest(p, tolPx) {
    var tol = (tolPx || 6) / view.z, hitItem = null;
    for (var li = doc.layers.length - 1; li >= 0; li--) {
        var layer = doc.layers[li];
        if (!layer.visible || layer.locked) continue;
        for (var ii = layer.items.length - 1; ii >= 0; ii--) {
            var item = layer.items[ii];
            if (item.type === 'text') {
                var b = itemBBox(item);
                if (p.x >= b.x0 - tol && p.x <= b.x1 + tol && p.y >= b.y0 - tol && p.y <= b.y1 + tol) return item;
                continue;
            }
            if (itemFilled(item, p)) return item;
            var c = closestOnItem(item, p);
            if (c.dist <= tol + (item.width || 0) / 2) { hitItem = item; return hitItem; }
        }
    }
    return null;
}

function hitNode(p, tolPx) {
    var tol = (tolPx || 8) / view.z, best = null;
    var pool = sel.length ? selItems() : [];
    if (!pool.length) { eachItem(function (it, l) { if (l.visible && !l.locked) pool.push(it); }); }
    pool.forEach(function (item) {
        if (item.type !== 'path') return;
        item.subs.forEach(function (sub, si) {
            sub.nodes.forEach(function (n, ni) {
                // manijas primero (están por encima)
                ['hi', 'ho'].forEach(function (h) {
                    if (!n[h]) return;
                    var d = dist(p, n[h]);
                    if (d < tol && (!best || d < best.d)) best = { d: d, id: item.id, si: si, ni: ni, handle: h };
                });
                var d = dist(p, n);
                if (d < tol && (!best || d <= best.d)) best = { d: d, id: item.id, si: si, ni: ni, handle: null };
            });
        });
    });
    return best;
}

function nodeSelected(id, si, ni) {
    return nodeSel.some(function (s) { return s.id === id && s.si === si && s.ni === ni; });
}

/* ========================================================================== */
/*  8. Dibujo del lienzo                                                      */
/* ========================================================================== */

function tracePath(item) {
    ctx.beginPath();
    item.subs.forEach(function (sub) {
        var n = sub.nodes, i, s, p;
        if (!n.length) return;
        p = toScreen(n[0]);
        ctx.moveTo(p.x, p.y);
        for (i = 0; i < segCount(sub); i++) {
            s = segOf(sub, i);
            if (!isCurve(s)) {
                p = toScreen(s.p1);
                ctx.lineTo(p.x, p.y);
            } else {
                var c = ctrl(s), a = toScreen(c.c1), b = toScreen(c.c2), e = toScreen(s.p1);
                ctx.bezierCurveTo(a.x, a.y, b.x, b.y, e.x, e.y);
            }
        }
        if (sub.closed) ctx.closePath();
    });
}

function drawItem(item) {
    ctx.save();
    ctx.globalAlpha = item.opacity == null ? 1 : item.opacity;

    if (item.type === 'text') {
        var px = item.size * view.z;
        ctx.font = px + 'px Helvetica, Arial, sans-serif';
        ctx.textAlign = item.align === 'center' ? 'center' : item.align === 'right' ? 'right' : 'left';
        ctx.textBaseline = 'alphabetic';
        var p = toScreen(item);
        if (opts.outline) {
            ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1;
            ctx.strokeText(item.text, p.x, p.y);
        } else {
            ctx.fillStyle = item.fill || '#111827';
            ctx.fillText(item.text, p.x, p.y);
        }
        ctx.restore();
        return;
    }

    tracePath(item);

    if (opts.outline) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();
        return;
    }

    if (item.fill) {
        ctx.fillStyle = item.fill;
        ctx.fill(item.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
    }
    if (item.stroke && item.width > 0) {
        ctx.strokeStyle = item.stroke;
        ctx.lineWidth = Math.max(item.width * view.z, 0.7);
        ctx.lineCap = item.cap || 'round';
        ctx.lineJoin = item.join || 'round';
        ctx.setLineDash(item.dash ? String(item.dash).split(',').map(function (v) {
            return Math.max(parseFloat(v) * view.z, 0.5);
        }) : []);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    ctx.restore();
}

function drawGrid() {
    var stepPx = opts.gridStep * view.z;
    if (!opts.grid || stepPx < 4) return;
    var o = toScreen({ x: 0, y: 0 });
    var e = toScreen({ x: doc.page.w, y: doc.page.h });
    ctx.save();
    ctx.beginPath();
    ctx.rect(o.x, o.y, e.x - o.x, e.y - o.y);
    ctx.clip();
    var i, p;
    ctx.lineWidth = 1;
    for (i = 0; i * opts.gridStep <= doc.page.w + 0.001; i++) {
        p = toScreen({ x: i * opts.gridStep, y: 0 });
        ctx.strokeStyle = (i % 5 === 0) ? 'rgba(148,163,184,.30)' : 'rgba(148,163,184,.14)';
        ctx.beginPath(); ctx.moveTo(p.x, o.y); ctx.lineTo(p.x, e.y); ctx.stroke();
    }
    for (i = 0; i * opts.gridStep <= doc.page.h + 0.001; i++) {
        p = toScreen({ x: 0, y: i * opts.gridStep });
        ctx.strokeStyle = (i % 5 === 0) ? 'rgba(148,163,184,.30)' : 'rgba(148,163,184,.14)';
        ctx.beginPath(); ctx.moveTo(o.x, p.y); ctx.lineTo(e.x, p.y); ctx.stroke();
    }
    ctx.restore();
}

function drawPage() {
    var o = toScreen({ x: 0, y: 0 });
    var e = toScreen({ x: doc.page.w, y: doc.page.h });
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = opts.outline ? '#0b1220' : '#ffffff';
    ctx.fillRect(o.x, o.y, e.x - o.x, e.y - o.y);
    ctx.restore();
    ctx.strokeStyle = 'rgba(245,158,11,.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x + .5, o.y + .5, e.x - o.x - 1, e.y - o.y - 1);
}

function drawHandleBox(b) {
    var a = toScreen({ x: b.x0, y: b.y0 }), c = toScreen({ x: b.x1, y: b.y1 });
    ctx.save();
    ctx.strokeStyle = 'rgba(245,158,11,.9)';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.strokeRect(a.x, a.y, c.x - a.x, c.y - a.y);
    ctx.setLineDash([]);
    handlePositions(b).forEach(function (h) {
        var p = toScreen(h);
        ctx.fillStyle = '#0b0f17';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.rect(p.x - 4, p.y - 4, 8, 8);
        ctx.fill(); ctx.stroke();
    });
    ctx.restore();
}

function handlePositions(b) {
    var mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    return [
        { x: b.x0, y: b.y0, k: 'nw' }, { x: mx, y: b.y0, k: 'n' }, { x: b.x1, y: b.y0, k: 'ne' },
        { x: b.x1, y: my, k: 'e' }, { x: b.x1, y: b.y1, k: 'se' }, { x: mx, y: b.y1, k: 's' },
        { x: b.x0, y: b.y1, k: 'sw' }, { x: b.x0, y: my, k: 'w' }
    ];
}

function drawNodes(item) {
    ctx.save();
    item.subs.forEach(function (sub, si) {
        sub.nodes.forEach(function (n, ni) {
            var p = toScreen(n);
            var on = nodeSelected(item.id, si, ni);
            if (on) {
                ['hi', 'ho'].forEach(function (h) {
                    if (!n[h]) return;
                    var q = toScreen(n[h]);
                    ctx.strokeStyle = 'rgba(96,165,250,.8)';
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
                    ctx.fillStyle = '#60a5fa';
                    ctx.beginPath(); ctx.arc(q.x, q.y, 3.2, 0, 6.2832); ctx.fill();
                });
            }
            ctx.fillStyle = on ? '#f59e0b' : '#0b0f17';
            ctx.strokeStyle = on ? '#fff7ed' : '#f59e0b';
            ctx.lineWidth = 1.4;
            var r = 3.6;
            ctx.beginPath();
            ctx.rect(p.x - r, p.y - r, r * 2, r * 2);
            ctx.fill(); ctx.stroke();
        });
    });
    ctx.restore();
}

function drawSelectionOutline(item) {
    ctx.save();
    if (item.type === 'text') {
        var b = itemBBox(item);
        var a = toScreen({ x: b.x0, y: b.y0 }), c = toScreen({ x: b.x1, y: b.y1 });
        ctx.strokeStyle = 'rgba(96,165,250,.85)';
        ctx.lineWidth = 1;
        ctx.strokeRect(a.x, a.y, c.x - a.x, c.y - a.y);
    } else {
        tracePath(item);
        ctx.strokeStyle = 'rgba(96,165,250,.9)';
        ctx.lineWidth = Math.max(item.width * view.z, 1) + 2;
        ctx.globalAlpha = .35;
        ctx.stroke();
    }
    ctx.restore();
}

function drawPenPreview() {
    if (!pen || !pen.item) return;
    var sub = pen.item.subs[pen.si];
    if (!sub || !sub.nodes.length) return;
    var lastNode = sub.nodes[sub.nodes.length - 1];
    ctx.save();
    ctx.strokeStyle = 'rgba(245,158,11,.75)';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    var a = toScreen(lastNode), b = toScreen(cursorMm);
    ctx.beginPath();
    if (lastNode.ho) {
        var h = toScreen(lastNode.ho);
        ctx.moveTo(a.x, a.y);
        ctx.bezierCurveTo(h.x, h.y, b.x, b.y, b.x, b.y);
    } else {
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function drawOverlay() {
    /* marco de selección */
    if (drag && drag.mode === 'marquee') {
        var a = toScreen(drag.start), b = toScreen(drag.current);
        ctx.save();
        ctx.fillStyle = 'rgba(245,158,11,.10)';
        ctx.strokeStyle = 'rgba(245,158,11,.8)';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
        ctx.restore();
    }

    /* cuchilla */
    if (drag && drag.mode === 'knife') {
        var k0 = toScreen(drag.start), k1 = toScreen(drag.current);
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(k0.x, k0.y); ctx.lineTo(k1.x, k1.y); ctx.stroke();
        ctx.restore();
    }

    /* regla de medición */
    if (measureLine) {
        var m0 = toScreen(measureLine.a), m1 = toScreen(measureLine.b);
        var d = dist(measureLine.a, measureLine.b);
        var ang = Math.atan2(measureLine.b.y - measureLine.a.y, measureLine.b.x - measureLine.a.x) * 180 / Math.PI;
        ctx.save();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.stroke();
        ctx.fillStyle = 'rgba(2,6,23,.9)';
        var label = fmt(d, 2) + ' mm · ' + fmt(ang, 1) + '°';
        ctx.font = '12px Inter, sans-serif';
        var w = ctx.measureText(label).width + 12;
        ctx.fillRect((m0.x + m1.x) / 2 - w / 2, (m0.y + m1.y) / 2 - 22, w, 20);
        ctx.fillStyle = '#34d399';
        ctx.textAlign = 'center';
        ctx.fillText(label, (m0.x + m1.x) / 2, (m0.y + m1.y) / 2 - 8);
        ctx.restore();
    }

    /* previsualización de figuras */
    if (drag && (drag.mode === 'rect' || drag.mode === 'ellipse' || drag.mode === 'line')) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245,158,11,.85)';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        var s = toScreen(drag.start), c = toScreen(drag.current);
        ctx.beginPath();
        if (drag.mode === 'rect') ctx.rect(s.x, s.y, c.x - s.x, c.y - s.y);
        else if (drag.mode === 'line') { ctx.moveTo(s.x, s.y); ctx.lineTo(c.x, c.y); }
        else ctx.ellipse((s.x + c.x) / 2, (s.y + c.y) / 2, Math.abs(c.x - s.x) / 2, Math.abs(c.y - s.y) / 2, 0, 0, 6.2832);
        ctx.stroke();
        ctx.restore();
    }

    /* indicador de ajuste */
    if (lastSnap && drag) {
        var p = toScreen(lastSnap);
        ctx.save();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x - 6, p.y); ctx.lineTo(p.x + 6, p.y);
        ctx.moveTo(p.x, p.y - 6); ctx.lineTo(p.x, p.y + 6);
        ctx.stroke();
        ctx.restore();
    }
}

function draw() {
    var w = cv.clientWidth, h = cv.clientHeight;
    ctx.clearRect(0, 0, w, h);

    drawPage();
    drawGrid();

    doc.layers.forEach(function (layer) {
        if (!layer.visible) return;
        layer.items.forEach(drawItem);
    });

    var items = selItems();
    if (items.length) {
        items.forEach(drawSelectionOutline);
        if (tool === 'select') {
            var b = bboxOfItems(items);
            if (b) drawHandleBox(b);
        }
    }
    if (tool === 'node') {
        (items.length ? items : []).forEach(function (it) { if (it.type === 'path') drawNodes(it); });
    }
    if (hover && tool === 'select' && sel.indexOf(hover) < 0) {
        var f = findItem(hover);
        if (f) {
            ctx.save();
            ctx.globalAlpha = .5;
            drawSelectionOutline(f.item);
            ctx.restore();
        }
    }

    drawPenPreview();
    drawOverlay();
    updateStatus();
}

/* ========================================================================== */
/*  9. Herramientas: puntero                                                  */
/* ========================================================================== */

function setTool(t) {
    if (pen) finishPen();
    tool = t;
    $$('.vs-tool').forEach(function (b) { b.classList.toggle('active', b.dataset.tool === t); });
    cv.className = 'tool-' + t;
    if (t !== 'measure') measureLine = null;
    if (t !== 'node') nodeSel = [];
    updateHint();
    draw();
}

var TOOL_HINTS = {
    select: 'Clic para seleccionar · arrastra para mover · <b>Shift</b> añade a la selección · tira de los tiradores para escalar',
    node: 'Clic en un nodo para editarlo · arrastra las manijas azules para curvar · <b>doble clic</b> sobre el trazo inserta un nodo · <b>Supr</b> borra',
    pen: 'Clic añade un vértice · <b>clic y arrastra</b> crea una curva · clic en el primer nodo cierra · <b>Enter</b> termina',
    line: 'Clic tras clic para encadenar rectas · <b>Shift</b> restringe a 15° · <b>Enter</b> termina',
    pencil: 'Arrastra para dibujar a mano alzada; el trazo se simplifica y suaviza al soltar',
    rect: 'Arrastra para crear un rectángulo · <b>Shift</b> = cuadrado',
    ellipse: 'Arrastra para crear una elipse · <b>Shift</b> = círculo',
    text: 'Clic para colocar el texto escrito en el panel Estilo',
    knife: 'Arrastra una línea sobre los trazos para <b>cortarlos</b> en los cruces',
    measure: 'Arrastra para medir distancia y ángulo',
    pan: 'Arrastra para desplazar la vista'
};

function updateHint() {
    $('#hint').innerHTML = TOOL_HINTS[tool] || '';
    $('#stTool').textContent = ({
        select: 'Seleccionar', node: 'Nodos', pen: 'Pluma', line: 'Línea', pencil: 'Lápiz',
        rect: 'Rectángulo', ellipse: 'Elipse', text: 'Texto', knife: 'Cuchilla',
        measure: 'Medir', pan: 'Encuadre'
    })[tool] || tool;
}

function onPointerDown(ev) {
    cv.setPointerCapture(ev.pointerId);
    var p = eventDoc(ev);
    cursorMm = p;

    /* Encuadre: botón central, herramienta mano o barra espaciadora */
    if (ev.button === 1 || tool === 'pan' || spaceDown) {
        drag = { mode: 'pan', sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y };
        cv.classList.add('panning');
        return;
    }
    if (ev.button !== 0) return;

    switch (tool) {
        case 'select': return downSelect(ev, p);
        case 'node': return downNode(ev, p);
        case 'pen': return downPen(ev, p, false);
        case 'line': return downPen(ev, p, true);
        case 'pencil':
            pushHistory();
            drag = { mode: 'pencil', pts: [p] };
            return;
        case 'rect':
        case 'ellipse':
            drag = { mode: tool, start: snapPoint(p), current: snapPoint(p) };
            return;
        case 'text': return placeText(p);
        case 'knife':
            drag = { mode: 'knife', start: p, current: p };
            return;
        case 'measure':
            drag = { mode: 'measure', start: snapPoint(p), current: snapPoint(p) };
            measureLine = { a: drag.start, b: drag.current };
            return;
    }
}

function downSelect(ev, p) {
    var items = selItems();

    /* ¿tirador de escala? */
    if (items.length) {
        var b = bboxOfItems(items);
        if (b) {
            var hit = null;
            handlePositions(b).forEach(function (h) {
                var s = toScreen(h), c = canvasPoint(ev);
                if (Math.abs(s.x - c.x) <= 6 && Math.abs(s.y - c.y) <= 6) hit = h;
            });
            if (hit) {
                pushHistory();
                drag = {
                    mode: 'scale', k: hit.k, b: b,
                    anchor: oppositeAnchor(b, hit.k),
                    orig: items.map(function (it) { return clone(it); })
                };
                return;
            }
        }
    }

    var target = hitTest(p);
    if (!target) {
        if (!ev.shiftKey) { sel = []; syncPanels(); }
        drag = { mode: 'marquee', start: p, current: p, add: ev.shiftKey, base: sel.slice() };
        draw();
        return;
    }

    if (ev.shiftKey) {
        var i = sel.indexOf(target.id);
        if (i >= 0) sel.splice(i, 1); else sel.push(target.id);
    } else if (sel.indexOf(target.id) < 0) {
        sel = [target.id];
    }
    syncPanels();

    var b2 = bboxOfItems(selItems());
    pushHistory();
    drag = {
        mode: 'move', start: p,
        anchor: b2 ? { x: b2.x0, y: b2.y0 } : { x: p.x, y: p.y },
        grab: b2 ? { x: p.x - b2.x0, y: p.y - b2.y0 } : { x: 0, y: 0 },
        moved: false
    };
    draw();
}

function oppositeAnchor(b, k) {
    var mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    return {
        nw: { x: b.x1, y: b.y1 }, ne: { x: b.x0, y: b.y1 },
        se: { x: b.x0, y: b.y0 }, sw: { x: b.x1, y: b.y0 },
        n: { x: mx, y: b.y1 }, s: { x: mx, y: b.y0 },
        w: { x: b.x1, y: my }, e: { x: b.x0, y: my }
    }[k];
}

function downNode(ev, p) {
    var h = hitNode(p);
    if (!h) {
        if (!ev.shiftKey) nodeSel = [];
        var t = hitTest(p);
        if (t) { if (sel.indexOf(t.id) < 0) sel = [t.id]; }
        else if (!ev.shiftKey) sel = [];
        drag = { mode: 'marqueeNode', start: p, current: p, add: ev.shiftKey };
        syncPanels();
        draw();
        return;
    }
    if (sel.indexOf(h.id) < 0) sel.push(h.id);

    if (h.handle) {
        pushHistory();
        drag = { mode: 'handle', ref: h, alt: ev.altKey };
        draw();
        return;
    }
    if (ev.shiftKey) {
        if (nodeSelected(h.id, h.si, h.ni)) {
            nodeSel = nodeSel.filter(function (s) { return !(s.id === h.id && s.si === h.si && s.ni === h.ni); });
        } else nodeSel.push({ id: h.id, si: h.si, ni: h.ni });
    } else if (!nodeSelected(h.id, h.si, h.ni)) {
        nodeSel = [{ id: h.id, si: h.si, ni: h.ni }];
    }
    pushHistory();
    drag = { mode: 'nodeMove', last: p };
    syncPanels();
    draw();
}

function downPen(ev, p, straight) {
    var sp = snapPoint(p, pen ? [pen.id] : null);
    if (ev.shiftKey && pen) {
        var f0 = findItem(pen.id);
        if (f0) {
            var ns = f0.item.subs[pen.si].nodes;
            sp = constrainAngle(ns[ns.length - 1], p, 15);
        }
    }

    if (!pen) {
        pushHistory();
        var item = newPath([{ closed: false, nodes: [node(sp.x, sp.y)] }]);
        addItem(item);
        sel = [item.id];
        pen = { id: item.id, si: 0, straight: straight };
        drag = straight ? null : { mode: 'penHandle', ni: 0 };
        syncPanels();
        draw();
        return;
    }

    var f = findItem(pen.id);
    if (!f) { pen = null; return downPen(ev, p, straight); }
    var sub = f.item.subs[pen.si];

    if (sub.nodes.length > 1 && dist(sp, sub.nodes[0]) < 9 / view.z) {
        sub.closed = true;
        finishPen();
        return;
    }
    sub.nodes.push(node(sp.x, sp.y));
    drag = straight ? null : { mode: 'penHandle', ni: sub.nodes.length - 1 };
    draw();
}

function finishPen() {
    if (!pen) return;
    var f = findItem(pen.id);
    if (f && f.item.subs[pen.si].nodes.length < 2) removeItem(pen.id);
    pen = null;
    draw();
}

function placeText(p) {
    var input = $('#stTextValue');
    var txt = (input.value || '').trim();
    if (!txt) {
        txt = (window.prompt('Texto a colocar:', '') || '').trim();
        if (!txt) return;
        input.value = txt;
    }
    pushHistory();
    var it = {
        id: uid('t'), type: 'text', x: p.x, y: p.y, text: txt,
        size: style.textSize, fill: style.fill || style.stroke,
        align: style.textAlign, opacity: style.opacity
    };
    addItem(it);
    sel = [it.id];
    syncPanels();
    renderLayers();
    draw();
}

function onPointerMove(ev) {
    var p = eventDoc(ev);
    cursorMm = p;

    if (!drag) {
        if (tool === 'select') {
            var t = hitTest(p);
            var id = t ? t.id : null;
            if (id !== hover) { hover = id; draw(); }
        }
        if (pen) draw();
        updateStatus();
        return;
    }

    switch (drag.mode) {
        case 'pan':
            view.x = drag.vx - (ev.clientX - drag.sx) / view.z;
            view.y = drag.vy - (ev.clientY - drag.sy) / view.z;
            break;

        case 'move': {
            var target = snapPoint({ x: p.x - drag.grab.x, y: p.y - drag.grab.y }, sel);
            if (ev.shiftKey) {
                if (Math.abs(p.x - drag.start.x) > Math.abs(p.y - drag.start.y)) target.y = drag.anchor.y;
                else target.x = drag.anchor.x;
            }
            var dx = target.x - drag.anchor.x, dy = target.y - drag.anchor.y;
            if (dx || dy) {
                selItems().forEach(function (it) { moveItem(it, dx, dy); });
                drag.anchor = target;
                drag.moved = true;
            }
            break;
        }

        case 'scale': {
            var b = drag.b, a = drag.anchor;
            var cur = snapPoint(p, sel);
            var sx = (b.x1 - b.x0) ? (cur.x - a.x) / ((drag.k.indexOf('w') >= 0 ? b.x0 : b.x1) - a.x) : 1;
            var sy = (b.y1 - b.y0) ? (cur.y - a.y) / ((drag.k.indexOf('n') >= 0 ? b.y0 : b.y1) - a.y) : 1;
            if (drag.k === 'n' || drag.k === 's') sx = 1;
            if (drag.k === 'e' || drag.k === 'w') sy = 1;
            if (!isFinite(sx) || Math.abs(sx) < 1e-4) sx = 1e-4;
            if (!isFinite(sy) || Math.abs(sy) < 1e-4) sy = 1e-4;
            if (ev.shiftKey || $('#trLock').checked) {
                if (drag.k.length === 2) { var m = Math.abs(sx) > Math.abs(sy) ? sx : sy; sx = m; sy = m; }
            }
            var live = selItems();
            live.forEach(function (it, i) { restoreGeometry(it, drag.orig[i]); });
            scaleItems(live, a.x, a.y, sx, sy);
            break;
        }

        case 'nodeMove': {
            var np = snapPoint(p, sel);
            var ddx = np.x - drag.last.x, ddy = np.y - drag.last.y;
            if (ddx || ddy) {
                nodeSel.forEach(function (s) {
                    var f = findItem(s.id);
                    if (!f) return;
                    var n = f.item.subs[s.si].nodes[s.ni];
                    n.x += ddx; n.y += ddy;
                    if (n.hi) { n.hi.x += ddx; n.hi.y += ddy; }
                    if (n.ho) { n.ho.x += ddx; n.ho.y += ddy; }
                });
                drag.last = np;
            }
            break;
        }

        case 'handle': {
            var r = drag.ref, fh = findItem(r.id);
            if (fh) {
                var nh = fh.item.subs[r.si].nodes[r.ni];
                nh[r.handle] = { x: p.x, y: p.y };
                var other = r.handle === 'hi' ? 'ho' : 'hi';
                if (!drag.alt && nh[other]) {
                    var len = dist(nh, nh[other]);
                    var a2 = Math.atan2(nh.y - p.y, nh.x - p.x);
                    nh[other] = { x: nh.x + Math.cos(a2) * len, y: nh.y + Math.sin(a2) * len };
                }
            }
            break;
        }

        case 'penHandle': {
            var fp = findItem(pen.id);
            if (fp) {
                var sub = fp.item.subs[pen.si];
                var nn = sub.nodes[drag.ni];
                var hp = ev.shiftKey ? constrainAngle(nn, p, 15) : p;
                nn.ho = { x: hp.x, y: hp.y };
                nn.hi = { x: 2 * nn.x - hp.x, y: 2 * nn.y - hp.y };
                if (drag.ni === 0) nn.hi = null;
            }
            break;
        }

        case 'pencil':
            if (dist(p, drag.pts[drag.pts.length - 1]) > 0.25) drag.pts.push(p);
            break;

        case 'marquee':
        case 'marqueeNode':
            drag.current = p;
            break;

        case 'rect':
        case 'ellipse': {
            var c2 = snapPoint(p);
            if (ev.shiftKey) {
                var side = Math.max(Math.abs(c2.x - drag.start.x), Math.abs(c2.y - drag.start.y));
                c2 = {
                    x: drag.start.x + Math.sign(c2.x - drag.start.x || 1) * side,
                    y: drag.start.y + Math.sign(c2.y - drag.start.y || 1) * side
                };
            }
            drag.current = c2;
            break;
        }

        case 'knife':
            drag.current = ev.shiftKey ? constrainAngle(drag.start, p, 15) : p;
            break;

        case 'measure':
            drag.current = ev.shiftKey ? constrainAngle(drag.start, p, 15) : snapPoint(p);
            measureLine = { a: drag.start, b: drag.current };
            break;
    }

    draw();
    if (drag.mode === 'pencil') {
        /* traza provisional del lápiz */
        ctx.save();
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = Math.max(style.width * view.z, 1);
        ctx.lineJoin = ctx.lineCap = 'round';
        ctx.beginPath();
        drag.pts.forEach(function (q, i) {
            var s = toScreen(q);
            if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();
        ctx.restore();
    }
}

function restoreGeometry(item, orig) {
    if (item.type === 'text') { item.x = orig.x; item.y = orig.y; item.size = orig.size; }
    else item.subs = clone(orig.subs);
}

function onPointerUp(ev) {
    if (!drag) return;
    var p = eventDoc(ev);
    var d = drag;
    drag = null;
    cv.classList.remove('panning');

    switch (d.mode) {
        case 'marquee': {
            var r = normRect(d.start, d.current);
            var picked = d.add ? d.base.slice() : [];
            eachItem(function (it, layer) {
                if (!layer.visible || layer.locked) return;
                var b = itemBBox(it);
                if (!b) return;
                if (b.x1 >= r.x0 && b.x0 <= r.x1 && b.y1 >= r.y0 && b.y0 <= r.y1) {
                    if (picked.indexOf(it.id) < 0) picked.push(it.id);
                }
            });
            sel = picked;
            syncPanels();
            break;
        }

        case 'marqueeNode': {
            var rr = normRect(d.start, d.current);
            if (!d.add) nodeSel = [];
            selItems().forEach(function (it) {
                if (it.type !== 'path') return;
                it.subs.forEach(function (sub, si) {
                    sub.nodes.forEach(function (n, ni) {
                        if (n.x >= rr.x0 && n.x <= rr.x1 && n.y >= rr.y0 && n.y <= rr.y1 &&
                            !nodeSelected(it.id, si, ni)) nodeSel.push({ id: it.id, si: si, ni: ni });
                    });
                });
            });
            break;
        }

        case 'pencil': {
            var pts = simplify(d.pts, Math.max(0.25, opts.tol * 0.5));
            if (pts.length < 2) { undoStack.pop(); updateUndoButtons(); break; }
            var sub = polyToSub(pts, false);
            smoothSub(sub);
            var it2 = newPath([sub]);
            addItem(it2);
            sel = [it2.id];
            renderLayers();
            syncPanels();
            break;
        }

        case 'rect': {
            var rb = normRect(d.start, d.current);
            if (rb.x1 - rb.x0 < 0.05 || rb.y1 - rb.y0 < 0.05) break;
            pushHistory();
            var rit = newPath([{
                closed: true, nodes: [
                    node(rb.x0, rb.y0), node(rb.x1, rb.y0), node(rb.x1, rb.y1), node(rb.x0, rb.y1)
                ]
            }]);
            addItem(rit);
            sel = [rit.id];
            renderLayers(); syncPanels();
            break;
        }

        case 'ellipse': {
            var eb = normRect(d.start, d.current);
            if (eb.x1 - eb.x0 < 0.05 || eb.y1 - eb.y0 < 0.05) break;
            pushHistory();
            var eit = newPath([ellipseSub(eb)]);
            addItem(eit);
            sel = [eit.id];
            renderLayers(); syncPanels();
            break;
        }

        case 'knife':
            if (dist(d.start, d.current) > 0.3) knifeCut(d.start, d.current);
            break;

        case 'move':
            if (!d.moved) { undoStack.pop(); updateUndoButtons(); }
            break;
    }
    draw();
}

function normRect(a, b) {
    return {
        x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y),
        x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y)
    };
}

var KAPPA = 0.5522847498;
function ellipseSub(b) {
    var rx = (b.x1 - b.x0) / 2, ry = (b.y1 - b.y0) / 2;
    var cx = b.x0 + rx, cy = b.y0 + ry;
    var kx = rx * KAPPA, ky = ry * KAPPA;
    return {
        closed: true, nodes: [
            { x: cx, y: b.y0, hi: { x: cx - kx, y: b.y0 }, ho: { x: cx + kx, y: b.y0 } },
            { x: b.x1, y: cy, hi: { x: b.x1, y: cy - ky }, ho: { x: b.x1, y: cy + ky } },
            { x: cx, y: b.y1, hi: { x: cx + kx, y: b.y1 }, ho: { x: cx - kx, y: b.y1 } },
            { x: b.x0, y: cy, hi: { x: b.x0, y: cy + ky }, ho: { x: b.x0, y: cy - ky } }
        ]
    };
}

function onDoubleClick(ev) {
    var p = eventDoc(ev);
    if (tool === 'select') {
        var t = hitTest(p);
        if (t && t.type === 'path') { sel = [t.id]; setTool('node'); syncPanels(); }
        return;
    }
    if (tool === 'node') { insertNodeAt(p); return; }
    if (tool === 'pen' || tool === 'line') finishPen();
}

function onWheel(ev) {
    ev.preventDefault();
    var sp = canvasPoint(ev);
    if (ev.shiftKey) {
        view.x += ev.deltaY / view.z * 0.6;
        draw();
        return;
    }
    zoomAt(ev.deltaY < 0 ? 1.12 : 1 / 1.12, sp);
}

/* ========================================================================== */
/* 10. Operaciones sobre trazos                                               */
/* ========================================================================== */

/* --- Ramer–Douglas–Peucker ------------------------------------------------ */
function simplify(pts, tol) {
    if (pts.length < 3) return pts.slice();
    var keep = new Array(pts.length).fill(false);
    keep[0] = keep[pts.length - 1] = true;

    (function rec(i, j) {
        if (j <= i + 1) return;
        var maxD = -1, idx = -1, k, d;
        for (k = i + 1; k < j; k++) {
            d = projectOnSegment(pts[k], pts[i], pts[j]).dist;
            if (d > maxD) { maxD = d; idx = k; }
        }
        if (maxD > tol) { keep[idx] = true; rec(i, idx); rec(idx, j); }
    })(0, pts.length - 1);

    return pts.filter(function (p, i) { return keep[i]; });
}

/* --- Suavizado tipo Catmull-Rom ------------------------------------------ */
function smoothSub(sub, amount) {
    var n = sub.nodes, len = n.length, i, prev, next, tx, ty;
    var k = (amount == null ? 1 : amount) / 6;
    if (len < 2) return;
    for (i = 0; i < len; i++) {
        prev = n[(i - 1 + len) % len];
        next = n[(i + 1) % len];
        if (!sub.closed) {
            if (i === 0) prev = n[0];
            if (i === len - 1) next = n[len - 1];
        }
        tx = (next.x - prev.x) * k;
        ty = (next.y - prev.y) * k;
        n[i].hi = (sub.closed || i > 0) ? { x: n[i].x - tx, y: n[i].y - ty } : null;
        n[i].ho = (sub.closed || i < len - 1) ? { x: n[i].x + tx, y: n[i].y + ty } : null;
    }
}

/* --- Conversión segmentos <-> subtrazo ------------------------------------ */
function subToSegs(sub) {
    var segs = [], i;
    for (i = 0; i < segCount(sub); i++) segs.push(segOf(sub, i));
    return segs;
}

function segsToSub(segs, closed) {
    if (!segs.length) return null;
    var nodes = [], i, s, prev;
    nodes.push(node(segs[0].p0.x, segs[0].p0.y, null, segs[0].c1));
    for (i = 0; i < segs.length; i++) {
        s = segs[i];
        if (closed && i === segs.length - 1) {
            nodes[0].hi = s.c2 ? { x: s.c2.x, y: s.c2.y } : null;
            break;
        }
        nodes.push(node(s.p1.x, s.p1.y, s.c2, segs[i + 1] ? segs[i + 1].c1 : null));
    }
    return { closed: !!closed, nodes: nodes };
}

/* --- Corte de un subtrazo en una lista de cortes {i,t} -------------------- */
function splitSubAt(sub, cuts) {
    var segs = subToSegs(sub);
    var byIndex = {}, i;
    cuts.forEach(function (c) { (byIndex[c.i] = byIndex[c.i] || []).push(c.t); });

    var outSegs = [], breakAfter = [];
    for (i = 0; i < segs.length; i++) {
        var ts = (byIndex[i] || []).slice().sort(function (a, b) { return a - b; })
            .filter(function (t) { return t > 1e-4 && t < 1 - 1e-4; });
        var rest = segs[i], base = 0, k;
        for (k = 0; k < ts.length; k++) {
            var local = (ts[k] - base) / (1 - base);
            var parts = bezSplit(rest, clamp(local, 1e-4, 1 - 1e-4));
            outSegs.push(parts[0]); breakAfter.push(true);
            rest = parts[1];
            base = ts[k];
        }
        outSegs.push(rest);
        breakAfter.push(false);
    }

    var anyBreak = breakAfter.some(Boolean);
    if (!anyBreak) return null;

    var groups = [], cur = [];
    if (sub.closed) {
        /* rota hasta justo después del primer corte */
        var first = breakAfter.indexOf(true);
        var order = [];
        for (i = 0; i < outSegs.length; i++) {
            var idx = (first + 1 + i) % outSegs.length;
            order.push({ seg: outSegs[idx], brk: breakAfter[idx] });
        }
        order.forEach(function (o) {
            cur.push(o.seg);
            if (o.brk) { groups.push(cur); cur = []; }
        });
        if (cur.length) groups.push(cur);
    } else {
        for (i = 0; i < outSegs.length; i++) {
            cur.push(outSegs[i]);
            if (breakAfter[i]) { groups.push(cur); cur = []; }
        }
        if (cur.length) groups.push(cur);
    }

    return groups.map(function (g) { return segsToSub(g, false); }).filter(Boolean);
}

/* --- Intersección segmento-segmento --------------------------------------- */
function segIntersect(p1, p2, p3, p4) {
    var d = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(d) < 1e-12) return null;
    var ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d;
    var ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;
    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;
    return { ua: ua, ub: ub, x: p1.x + ua * (p2.x - p1.x), y: p1.y + ua * (p2.y - p1.y) };
}

/* --- Cuchilla: corta todo lo que cruce la línea a-b ------------------------ */
function knifeCut(a, b) {
    var targets = sel.length ? selItems() : [];
    if (!targets.length) eachItem(function (it, l) { if (l.visible && !l.locked && it.type === 'path') targets.push(it); });

    var madeCuts = 0, snapshotTaken = false, newSel = [];

    targets.forEach(function (item) {
        if (item.type !== 'path') return;
        var f = findItem(item.id);
        if (!f) return;

        var resultSubs = [], cutHere = false;
        item.subs.forEach(function (sub) {
            var cuts = [], i, k, s, steps, prev, cur, hit;
            for (i = 0; i < segCount(sub); i++) {
                s = segOf(sub, i);
                steps = segSteps(s, 0.12);
                prev = s.p0;
                for (k = 1; k <= steps; k++) {
                    cur = bezAt(s, k / steps);
                    hit = segIntersect(prev, cur, a, b);
                    if (hit) cuts.push({ i: i, t: (k - 1 + hit.ua) / steps });
                    prev = cur;
                }
            }
            if (!cuts.length) { resultSubs.push([sub]); return; }
            var pieces = splitSubAt(sub, cuts);
            if (!pieces || !pieces.length) { resultSubs.push([sub]); return; }
            cutHere = true;
            madeCuts += pieces.length - 1;
            resultSubs.push(pieces);
        });

        if (!cutHere) return;
        if (!snapshotTaken) { pushHistory(); snapshotTaken = true; }

        var layer = f.layer, at = f.ii;
        var created = [];
        resultSubs.forEach(function (group) {
            group.forEach(function (sb) {
                var ni = newPath([sb], {
                    stroke: item.stroke, width: item.width, fill: null,
                    fillRule: item.fillRule, dash: item.dash, cap: item.cap,
                    join: item.join, opacity: item.opacity
                });
                created.push(ni);
            });
        });
        layer.items.splice(at, 1);
        created.forEach(function (ni, i) { layer.items.splice(at + i, 0, ni); newSel.push(ni.id); });
    });

    if (madeCuts) {
        sel = newSel;
        nodeSel = [];
        renderLayers(); syncPanels();
        toast(madeCuts + ' corte(s) realizados');
    } else {
        toast('La cuchilla no cruzó ningún trazo');
    }
    draw();
}

/* --- Unir / soldar --------------------------------------------------------- */
function joinSelection() {
    var items = selItems().filter(function (it) { return it.type === 'path'; });
    if (!items.length) { toast('Selecciona trazos para unir'); return; }
    pushHistory();

    var tol = opts.tol;
    var open = [], closed = [];
    items.forEach(function (it) {
        it.subs.forEach(function (sub) { (sub.closed ? closed : open).push(clone(sub)); });
    });

    var chains = [];
    while (open.length) {
        var chain = open.shift();
        var merged = true;
        while (merged) {
            merged = false;
            for (var i = 0; i < open.length; i++) {
                var cand = open[i];
                var cs = chain.nodes[0], ce = chain.nodes[chain.nodes.length - 1];
                var os = cand.nodes[0], oe = cand.nodes[cand.nodes.length - 1];
                if (dist(ce, os) <= tol) { appendSub(chain, cand, false); }
                else if (dist(ce, oe) <= tol) { appendSub(chain, cand, true); }
                else if (dist(cs, os) <= tol) { reverseSub(chain); appendSub(chain, cand, false); }
                else if (dist(cs, oe) <= tol) { reverseSub(chain); appendSub(chain, cand, true); }
                else continue;
                open.splice(i, 1);
                merged = true;
                break;
            }
        }
        var a = chain.nodes[0], z = chain.nodes[chain.nodes.length - 1];
        if (chain.nodes.length > 2 && dist(a, z) <= tol) {
            a.hi = z.hi ? { x: z.hi.x, y: z.hi.y } : null;
            chain.nodes.pop();
            chain.closed = true;
        }
        chains.push(chain);
    }

    var first = items[0];
    var f = findItem(first.id);
    var target = newPath(closed.concat(chains), {
        stroke: first.stroke, width: first.width, fill: first.fill,
        fillRule: first.fillRule, dash: first.dash, cap: first.cap,
        join: first.join, opacity: first.opacity
    });
    items.forEach(function (it) { removeItem(it.id); });
    f.layer.items.splice(Math.min(f.ii, f.layer.items.length), 0, target);

    sel = [target.id];
    nodeSel = [];
    renderLayers(); syncPanels(); draw();
    toast('Unidos en un trazo de ' + target.subs.length + ' subtrazo(s)');
}

function reverseSub(sub) {
    sub.nodes.reverse();
    sub.nodes.forEach(function (n) { var t = n.hi; n.hi = n.ho; n.ho = t; });
}

function appendSub(chain, other, reversed) {
    var o = clone(other);
    if (reversed) reverseSub(o);
    var last = chain.nodes[chain.nodes.length - 1];
    /* funde el extremo de la cadena con el inicio del siguiente */
    last.ho = o.nodes[0].ho ? { x: o.nodes[0].ho.x, y: o.nodes[0].ho.y } : null;
    chain.nodes = chain.nodes.concat(o.nodes.slice(1));
}

/* --- Separar en subtrazos independientes ---------------------------------- */
function breakApart() {
    var items = selItems().filter(function (it) { return it.type === 'path'; });
    if (!items.length) return;
    pushHistory();
    var newSel = [];
    items.forEach(function (item) {
        var f = findItem(item.id);
        if (!f || item.subs.length < 2) { newSel.push(item.id); return; }
        var at = f.ii;
        f.layer.items.splice(at, 1);
        item.subs.forEach(function (sub, i) {
            var ni = newPath([sub], {
                stroke: item.stroke, width: item.width, fill: item.fill,
                fillRule: item.fillRule, dash: item.dash, cap: item.cap,
                join: item.join, opacity: item.opacity
            });
            f.layer.items.splice(at + i, 0, ni);
            newSel.push(ni.id);
        });
    });
    sel = newSel;
    renderLayers(); syncPanels(); draw();
    toast('Trazos separados');
}

/* --- Cerrar / abrir / invertir / aplanar ---------------------------------- */
function eachSelectedSub(fn) {
    var items = selItems().filter(function (it) { return it.type === 'path'; });
    if (!items.length) { toast('Nada seleccionado'); return false; }
    pushHistory();
    items.forEach(function (it) { it.subs.forEach(function (sub) { fn(sub, it); }); });
    draw();
    return true;
}

function closePaths() { eachSelectedSub(function (s) { if (s.nodes.length > 2) s.closed = true; }); }
function openPaths() { eachSelectedSub(function (s) { s.closed = false; }); }
function reversePaths() { eachSelectedSub(reverseSub); }
function smoothPaths() { eachSelectedSub(function (s) { smoothSub(s); }); }

function simplifyPaths() {
    eachSelectedSub(function (sub) {
        var pts = simplify(flattenSub(sub, 0.15), opts.tol);
        if (pts.length < 2) return;
        var closed = sub.closed;
        var ns = polyToSub(pts, closed);
        smoothSub(ns);
        sub.nodes = ns.nodes;
        sub.closed = closed;
    });
}

function flattenPaths() {
    eachSelectedSub(function (sub) {
        var pts = flattenSub(sub, Math.max(opts.tol * 0.35, 0.08));
        pts = simplify(pts, Math.max(opts.tol * 0.15, 0.03));
        var closed = sub.closed;
        sub.nodes = polyToSub(pts, closed).nodes;
        sub.closed = closed;
    });
}

/* ========================================================================== */
/* 11. Operaciones booleanas (sobre contornos aplanados)                      */
/* ========================================================================== */

function itemRings(item) {
    return item.subs
        .filter(function (s) { return s.closed && s.nodes.length >= 3; })
        .map(function (s) { return flattenSub(s, 0.12); })
        .filter(function (r) { return r.length >= 3; });
}

function ringsToEdges(rings) {
    var edges = [];
    rings.forEach(function (r) {
        for (var i = 0; i < r.length; i++) {
            var a = r[i], b = r[(i + 1) % r.length];
            if (dist(a, b) > 1e-7) edges.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } });
        }
    });
    return edges;
}

function splitEdges(edgesA, edgesB) {
    var cuts = edgesA.map(function () { return []; });
    edgesA.forEach(function (ea, i) {
        edgesB.forEach(function (eb) {
            var x = segIntersect(ea.a, ea.b, eb.a, eb.b);
            if (x && x.ua > 1e-9 && x.ua < 1 - 1e-9) cuts[i].push(x.ua);
        });
    });
    var out = [];
    edgesA.forEach(function (ea, i) {
        var ts = cuts[i].sort(function (p, q) { return p - q; });
        var prev = ea.a, k;
        for (k = 0; k < ts.length; k++) {
            var p = { x: ea.a.x + (ea.b.x - ea.a.x) * ts[k], y: ea.a.y + (ea.b.y - ea.a.y) * ts[k] };
            if (dist(prev, p) > 1e-7) out.push({ a: prev, b: p });
            prev = p;
        }
        if (dist(prev, ea.b) > 1e-7) out.push({ a: prev, b: ea.b });
    });
    return out;
}

function chainEdges(edges) {
    var Q = 1e4;
    var key = function (p) { return Math.round(p.x * Q) + ',' + Math.round(p.y * Q); };
    var map = {};
    edges.forEach(function (e, i) {
        e.used = false;
        (map[key(e.a)] = map[key(e.a)] || []).push(i);
    });

    var rings = [], i;
    for (i = 0; i < edges.length; i++) {
        if (edges[i].used) continue;
        var ring = [], cur = edges[i], startKey = key(cur.a), guard = 0;
        while (cur && !cur.used && guard++ < edges.length + 4) {
            cur.used = true;
            ring.push({ x: cur.a.x, y: cur.a.y });
            var nk = key(cur.b);
            if (nk === startKey) break;
            var list = map[nk] || [], next = null, j;
            for (j = 0; j < list.length; j++) {
                if (!edges[list[j]].used) { next = edges[list[j]]; break; }
            }
            cur = next;
        }
        if (ring.length >= 3) rings.push(ring);
    }
    return rings;
}

function midOf(e) { return { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 }; }

function booleanRings(ringsA, ringsB, op) {
    var ea = splitEdges(ringsToEdges(ringsA), ringsToEdges(ringsB));
    var eb = splitEdges(ringsToEdges(ringsB), ringsToEdges(ringsA));
    var keep = [];

    var pick = function (edges, otherRings, wantInside, reverse) {
        edges.forEach(function (e) {
            var inside = pointInRings(midOf(e), otherRings);
            if (inside === wantInside) {
                keep.push(reverse ? { a: e.b, b: e.a } : { a: e.a, b: e.b });
            }
        });
    };

    if (op === 'union') { pick(ea, ringsB, false, false); pick(eb, ringsA, false, false); }
    else if (op === 'intersect') { pick(ea, ringsB, true, false); pick(eb, ringsA, true, false); }
    else if (op === 'diff') { pick(ea, ringsB, false, false); pick(eb, ringsA, true, true); }
    else if (op === 'xor') {
        return booleanRings(ringsA, ringsB, 'diff').concat(booleanRings(ringsB, ringsA, 'diff'));
    }
    return chainEdges(keep);
}

function booleanOp(op) {
    var items = selItems().filter(function (it) { return it.type === 'path'; });
    if (items.length < 2) { toast('Selecciona al menos dos formas cerradas'); return; }

    var A = itemRings(items[0]);
    var B = [];
    items.slice(1).forEach(function (it) { B = B.concat(itemRings(it)); });
    if (!A.length || !B.length) { toast('Las operaciones booleanas requieren trazos cerrados'); return; }

    var rings = booleanRings(A, B, op);
    if (!rings.length) { toast('El resultado está vacío'); return; }

    pushHistory();
    var first = items[0], f = findItem(first.id);
    var result = newPath(rings.map(function (r) { return polyToSub(simplify(r, 0.02), true); }), {
        stroke: first.stroke, width: first.width,
        fill: first.fill || (op === 'union' ? null : first.fill),
        fillRule: 'evenodd', dash: first.dash, cap: first.cap,
        join: first.join, opacity: first.opacity
    });
    var at = f.ii, layer = f.layer;
    items.forEach(function (it) { removeItem(it.id); });
    layer.items.splice(Math.min(at, layer.items.length), 0, result);

    sel = [result.id];
    nodeSel = [];
    renderLayers(); syncPanels(); draw();
    toast({ union: 'Suma', diff: 'Resta', intersect: 'Intersección', xor: 'Exclusión' }[op] + ' aplicada');
}

/* ========================================================================== */
/* 12. Operaciones con nodos                                                  */
/* ========================================================================== */

function insertNodeAt(p) {
    var pool = selItems().filter(function (it) { return it.type === 'path'; });
    if (!pool.length) { var t = hitTest(p); if (t && t.type === 'path') pool = [t]; }
    if (!pool.length) return;

    var best = null;
    pool.forEach(function (item) {
        var c = closestOnItem(item, p);
        if (c && (!best || c.dist < best.dist)) { best = c; best.item = item; }
    });
    if (!best || best.dist > 8 / view.z) return;

    pushHistory();
    var sub = best.item.subs[best.si];
    var segs = subToSegs(sub);
    var parts = bezSplit(segs[best.i], clamp(best.t, 0.001, 0.999));
    segs.splice(best.i, 1, parts[0], parts[1]);
    var ns = segsToSub(segs, sub.closed);
    sub.nodes = ns.nodes;
    nodeSel = [{ id: best.item.id, si: best.si, ni: best.i + 1 }];
    draw();
    toast('Nodo insertado');
}

function deleteSelectedNodes() {
    if (!nodeSel.length) return false;
    pushHistory();
    var groups = {};
    nodeSel.forEach(function (s) { (groups[s.id + '|' + s.si] = groups[s.id + '|' + s.si] || []).push(s.ni); });
    Object.keys(groups).forEach(function (k) {
        var parts = k.split('|'), f = findItem(parts[0]);
        if (!f) return;
        var sub = f.item.subs[+parts[1]];
        groups[k].sort(function (a, b) { return b - a; }).forEach(function (ni) {
            if (sub.nodes.length > 1) sub.nodes.splice(ni, 1);
        });
    });
    /* limpia subtrazos y objetos vacíos */
    doc.layers.forEach(function (layer) {
        layer.items = layer.items.filter(function (it) {
            if (it.type !== 'path') return true;
            it.subs = it.subs.filter(function (s) { return s.nodes.length >= 2; });
            return it.subs.length > 0;
        });
    });
    nodeSel = [];
    renderLayers(); draw();
    return true;
}

function setNodeType(kind) {
    if (!nodeSel.length) { toast('Selecciona nodos con la herramienta A'); return; }
    pushHistory();
    nodeSel.forEach(function (s) {
        var f = findItem(s.id);
        if (!f) return;
        var sub = f.item.subs[s.si], n = sub.nodes[s.ni], len = sub.nodes.length;
        if (kind === 'corner') { n.hi = null; n.ho = null; return; }
        var prev = sub.nodes[(s.ni - 1 + len) % len], next = sub.nodes[(s.ni + 1) % len];
        if (!sub.closed) {
            if (s.ni === 0) prev = n;
            if (s.ni === len - 1) next = n;
        }
        var tx = (next.x - prev.x) / 6, ty = (next.y - prev.y) / 6;
        n.hi = (sub.closed || s.ni > 0) ? { x: n.x - tx, y: n.y - ty } : null;
        n.ho = (sub.closed || s.ni < len - 1) ? { x: n.x + tx, y: n.y + ty } : null;
    });
    draw();
}

function splitAtNode() {
    if (!nodeSel.length) { toast('Selecciona un nodo con la herramienta A'); return; }
    var s = nodeSel[0], f = findItem(s.id);
    if (!f) return;
    var item = f.item, sub = item.subs[s.si];
    if (sub.nodes.length < 3) { toast('El trazo es demasiado corto'); return; }
    pushHistory();

    var segs = subToSegs(sub), pieces;
    if (sub.closed) {
        var order = [];
        for (var i = 0; i < segs.length; i++) order.push(segs[(s.ni + i) % segs.length]);
        pieces = [segsToSub(order, false)];
    } else {
        if (s.ni === 0 || s.ni === sub.nodes.length - 1) { toast('Elige un nodo interior'); undoStack.pop(); return; }
        pieces = [segsToSub(segs.slice(0, s.ni), false), segsToSub(segs.slice(s.ni), false)];
    }
    var at = f.ii, layer = f.layer;
    var others = item.subs.filter(function (x, i) { return i !== s.si; });
    layer.items.splice(at, 1);
    var created = [];
    pieces.filter(Boolean).forEach(function (sb) { created.push(newPath([sb], styleOf(item))); });
    others.forEach(function (sb) { created.push(newPath([sb], styleOf(item))); });
    created.forEach(function (ni, i) { layer.items.splice(at + i, 0, ni); });
    sel = created.map(function (c) { return c.id; });
    nodeSel = [];
    renderLayers(); syncPanels(); draw();
    toast('Trazo cortado en el nodo');
}

function styleOf(item) {
    return {
        stroke: item.stroke, width: item.width, fill: item.fill, fillRule: item.fillRule,
        dash: item.dash, cap: item.cap, join: item.join, opacity: item.opacity
    };
}

/* ========================================================================== */
/* 13. Edición general                                                        */
/* ========================================================================== */

function deleteSelection() {
    if (tool === 'node' && nodeSel.length) { if (deleteSelectedNodes()) return; }
    if (!sel.length) return;
    pushHistory();
    sel.forEach(removeItem);
    sel = []; nodeSel = [];
    renderLayers(); syncPanels(); draw();
}

function copySelection() {
    var items = selItems();
    if (!items.length) return;
    clipboard = clone(items);
    toast(items.length + ' objeto(s) copiados');
}

function pasteClipboard(offset) {
    if (!clipboard || !clipboard.length) return;
    pushHistory();
    var d = offset == null ? 4 : offset, ids = [];
    clipboard.forEach(function (src) {
        var it = clone(src);
        it.id = uid(it.type === 'text' ? 't' : 'p');
        if (it.type === 'text') { it.x += d; it.y += d; } else moveItem(it, d, d);
        addItem(it);
        ids.push(it.id);
    });
    sel = ids;
    renderLayers(); syncPanels(); draw();
}

function duplicateSelection() {
    copySelection();
    pasteClipboard(3);
}

function nudge(dx, dy) {
    if (tool === 'node' && nodeSel.length) {
        pushHistory();
        nodeSel.forEach(function (s) {
            var f = findItem(s.id);
            if (!f) return;
            var n = f.item.subs[s.si].nodes[s.ni];
            n.x += dx; n.y += dy;
            if (n.hi) { n.hi.x += dx; n.hi.y += dy; }
            if (n.ho) { n.ho.x += dx; n.ho.y += dy; }
        });
        draw();
        return;
    }
    if (!sel.length) return;
    pushHistory();
    selItems().forEach(function (it) { moveItem(it, dx, dy); });
    syncPanels(); draw();
}

function bringTo(front) {
    if (!sel.length) return;
    pushHistory();
    sel.forEach(function (id) {
        var f = findItem(id);
        if (!f) return;
        f.layer.items.splice(f.ii, 1);
        if (front) f.layer.items.push(f.item);
        else f.layer.items.unshift(f.item);
    });
    renderLayers(); draw();
}

function alignSelection(kind) {
    var items = selItems();
    if (!items.length) return;
    var usePage = $('#alignPage').checked;
    var ref = usePage ? { x0: 0, y0: 0, x1: doc.page.w, y1: doc.page.h } : bboxOfItems(items);
    if (!ref) return;
    pushHistory();
    items.forEach(function (it) {
        var b = itemBBox(it);
        if (!b) return;
        var dx = 0, dy = 0;
        if (kind === 'left') dx = ref.x0 - b.x0;
        if (kind === 'right') dx = ref.x1 - b.x1;
        if (kind === 'hcenter') dx = (ref.x0 + ref.x1) / 2 - (b.x0 + b.x1) / 2;
        if (kind === 'top') dy = ref.y0 - b.y0;
        if (kind === 'bottom') dy = ref.y1 - b.y1;
        if (kind === 'vcenter') dy = (ref.y0 + ref.y1) / 2 - (b.y0 + b.y1) / 2;
        if (dx || dy) moveItem(it, dx, dy);
    });
    syncPanels(); draw();
}

function distributeSelection(axis) {
    var items = selItems();
    if (items.length < 3) { toast('Se necesitan 3 objetos o más'); return; }
    pushHistory();
    var withB = items.map(function (it) { return { it: it, b: itemBBox(it) }; })
        .filter(function (o) { return o.b; });
    withB.sort(function (a, b) {
        return axis === 'h' ? (a.b.x0 + a.b.x1) - (b.b.x0 + b.b.x1) : (a.b.y0 + a.b.y1) - (b.b.y0 + b.b.y1);
    });
    var firstC = center(withB[0].b), lastC = center(withB[withB.length - 1].b);
    var step = (axis === 'h' ? lastC.x - firstC.x : lastC.y - firstC.y) / (withB.length - 1);
    withB.forEach(function (o, i) {
        if (i === 0 || i === withB.length - 1) return;
        var c = center(o.b);
        if (axis === 'h') moveItem(o.it, firstC.x + step * i - c.x, 0);
        else moveItem(o.it, 0, firstC.y + step * i - c.y);
    });
    draw();
}

function center(b) { return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; }

/* ========================================================================== */
/* 14. Interfaz: paneles, capas y estado                                      */
/* ========================================================================== */

function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
    $('#stMsg').textContent = msg;
}

function updateStatus() {
    $('#stX').textContent = fmt(cursorMm.x, 1);
    $('#stY').textContent = fmt(cursorMm.y, 1);
    $('#stZoom').textContent = Math.round(view.z / (96 / 25.4) * 100) + '%';
    $('#stSel').textContent = String(sel.length);
}

function syncPanels() {
    var items = selItems();
    var one = items.length === 1 ? items[0] : null;

    if (one) {
        if (one.type === 'path') {
            $('#stStroke').value = one.stroke || '#000000';
            $('#stWidth').value = one.width;
            $('#stDash').value = one.dash || '';
            $('#stCap').value = one.cap || 'round';
            $('#stFillOn').checked = !!one.fill;
            if (one.fill) $('#stFill').value = one.fill;
            $('#stFillRule').value = one.fillRule || 'nonzero';
        } else {
            $('#stTextSize').value = one.size;
            $('#stTextValue').value = one.text;
            if (one.fill) $('#stFill').value = one.fill;
        }
        $('#stOpacity').value = Math.round((one.opacity == null ? 1 : one.opacity) * 100);
    }

    var b = bboxOfItems(items);
    ['trX', 'trY', 'trW', 'trH'].forEach(function (id, i) {
        var el = $('#' + id);
        if (!b) { el.value = ''; return; }
        el.value = fmt([b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0][i], 2);
    });

    var info = $('#objInfo');
    if (!items.length) {
        info.textContent = 'Sin selección.';
    } else {
        var nodes = 0, subs = 0;
        items.forEach(function (it) {
            if (it.type !== 'path') return;
            subs += it.subs.length;
            it.subs.forEach(function (s) { nodes += s.nodes.length; });
        });
        info.innerHTML = '<b>' + items.length + '</b> objeto(s)<br>' +
            '<b>' + subs + '</b> subtrazo(s) · <b>' + nodes + '</b> nodo(s)' +
            (b ? '<br>Caja: ' + fmt(b.x1 - b.x0, 2) + ' × ' + fmt(b.y1 - b.y0, 2) + ' mm' : '');
    }
    updateStatus();
}

function renderLayers() {
    var host = $('#layerList');
    host.innerHTML = '';
    doc.layers.slice().reverse().forEach(function (layer) {
        var idx = doc.layers.indexOf(layer);
        var row = document.createElement('div');
        row.className = 'vs-layer' + (idx === doc.active ? ' active' : '');
        row.innerHTML =
            '<button class="vs-icon-btn' + (layer.visible ? '' : ' off') + '" data-act="vis" title="Visibilidad">' +
            '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
            '<button class="vs-icon-btn' + (layer.locked ? '' : ' off') + '" data-act="lock" title="Bloqueo">' +
            '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></button>' +
            '<span class="name">' + layer.name + '</span>' +
            '<span class="count">' + layer.items.length + '</span>';
        row.addEventListener('click', function (ev) {
            var act = ev.target.closest('[data-act]');
            if (act) {
                pushHistory();
                if (act.dataset.act === 'vis') layer.visible = !layer.visible;
                else layer.locked = !layer.locked;
                renderLayers(); draw();
                return;
            }
            doc.active = idx;
            renderLayers();
        });
        host.appendChild(row);
    });
}

/* ========================================================================== */
/* 15. Documento y archivos                                                   */
/* ========================================================================== */

function applyPagePreset(label) {
    if (label === 'custom') {
        doc.page.label = 'custom';
        doc.page.w = clamp(parseFloat($('#pgW').value) || doc.page.w, 10, 2000);
        doc.page.h = clamp(parseFloat($('#pgH').value) || doc.page.h, 10, 2000);
    } else {
        var p = PAGE_PRESETS[label];
        if (!p) return;
        pushHistory();
        doc.page = { w: p[0], h: p[1], label: label };
    }
    $('#pgW').value = fmt(doc.page.w, 1);
    $('#pgH').value = fmt(doc.page.h, 1);
    fitPage();
}

function saveProject() {
    var data = JSON.stringify({ format: 'trazo-studio', version: 1, doc: doc }, null, 1);
    TrazoExport.download((doc.name || 'trazo') + '.trazo', new Blob([data], { type: 'application/json' }));
    toast('Proyecto guardado');
}

function openProject(file) {
    var fr = new FileReader();
    fr.onload = function () {
        try {
            var data = JSON.parse(fr.result);
            var d = data.doc || data;
            if (!d.layers || !d.page) throw new Error('formato');
            pushHistory();
            doc = d;
            doc.name = (file.name || 'trazo').replace(/\.(trazo|json)$/i, '');
            sel = []; nodeSel = []; pen = null;
            $('#docName').textContent = '— ' + doc.name;
            $('#pagePreset').value = PAGE_PRESETS[doc.page.label] ? doc.page.label : 'custom';
            renderLayers(); syncPanels(); fitPage();
            toast('Proyecto abierto');
        } catch (e) {
            toast('No se pudo leer el archivo');
        }
    };
    fr.readAsText(file);
}

function newDocument() {
    if (doc.layers.some(function (l) { return l.items.length; }) &&
        !window.confirm('¿Descartar el dibujo actual y empezar de cero?')) return;
    pushHistory();
    doc = newDoc();
    sel = []; nodeSel = []; pen = null;
    $('#docName').textContent = '— sin título';
    renderLayers(); syncPanels(); fitPage();
}

/* ========================================================================== */
/* 16. Estilos aplicados a la selección                                       */
/* ========================================================================== */

function applyStyle(patch, storeDefault) {
    var items = selItems();
    if (items.length) pushHistory();
    items.forEach(function (it) {
        Object.keys(patch).forEach(function (k) {
            if (it.type === 'text' && (k === 'stroke' || k === 'width' || k === 'dash' || k === 'cap')) return;
            it[k] = patch[k];
        });
    });
    if (storeDefault !== false) Object.assign(style, patch);
    draw();
    syncPanels();
}

/* ========================================================================== */
/* 17. Teclado                                                                */
/* ========================================================================== */

var TOOL_KEYS = { v: 'select', a: 'node', p: 'pen', l: 'line', b: 'pencil', r: 'rect', e: 'ellipse', t: 'text', k: 'knife', m: 'measure', h: 'pan' };

function onKeyDown(ev) {
    var el = document.activeElement;
    if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
        if (ev.key === 'Escape') el.blur();
        return;
    }

    var mod = ev.ctrlKey || ev.metaKey;
    var k = ev.key.toLowerCase();

    if (ev.code === 'Space' && !mod) { spaceDown = true; ev.preventDefault(); return; }

    if (mod) {
        switch (k) {
            case 'z': ev.preventDefault(); ev.shiftKey ? redo() : undo(); return;
            case 'y': ev.preventDefault(); redo(); return;
            case 'c': ev.preventDefault(); copySelection(); return;
            case 'x': ev.preventDefault(); copySelection(); deleteSelection(); return;
            case 'v': ev.preventDefault(); pasteClipboard(); return;
            case 'd': ev.preventDefault(); duplicateSelection(); return;
            case 'a': ev.preventDefault(); sel = []; eachItem(function (it, l) { if (l.visible && !l.locked) sel.push(it.id); }); syncPanels(); draw(); return;
            case 'j': ev.preventDefault(); ev.shiftKey ? breakApart() : joinSelection(); return;
            case 's': ev.preventDefault(); saveProject(); return;
            case 'o': ev.preventDefault(); $('#fileInput').click(); return;
            case 'n': ev.preventDefault(); newDocument(); return;
            case 'e': ev.preventDefault(); exportPDF(); return;
            case 'p': ev.preventDefault(); printDocument(); return;
            case '0': ev.preventDefault(); fitPage(); return;
            case '1': ev.preventDefault(); view.z = 96 / 25.4; draw(); return;
        }
        if (ev.key === 'ArrowUp') { ev.preventDefault(); bringTo(true); return; }
        if (ev.key === 'ArrowDown') { ev.preventDefault(); bringTo(false); return; }
        return;
    }

    switch (ev.key) {
        case 'Escape':
            if (pen) finishPen();
            else { sel = []; nodeSel = []; measureLine = null; syncPanels(); }
            draw();
            return;
        case 'Enter':
            if (pen) finishPen();
            return;
        case 'Delete':
        case 'Backspace':
            if (pen) {
                var f = findItem(pen.id);
                if (f) {
                    var sub = f.item.subs[pen.si];
                    sub.nodes.pop();
                    if (!sub.nodes.length) { removeItem(pen.id); pen = null; }
                    draw();
                }
                ev.preventDefault();
                return;
            }
            ev.preventDefault();
            deleteSelection();
            return;
        case 'ArrowLeft': ev.preventDefault(); nudge(-step(ev), 0); return;
        case 'ArrowRight': ev.preventDefault(); nudge(step(ev), 0); return;
        case 'ArrowUp': ev.preventDefault(); nudge(0, -step(ev)); return;
        case 'ArrowDown': ev.preventDefault(); nudge(0, step(ev)); return;
        case '+': case '=': zoomButton(1.15); return;
        case '-': zoomButton(1 / 1.15); return;
        case 'F1': ev.preventDefault(); $('#help').hidden = false; return;
    }

    if (TOOL_KEYS[k]) { setTool(TOOL_KEYS[k]); return; }
}

function step(ev) {
    if (ev.shiftKey) return opts.gridStep;
    return ev.altKey ? 0.1 : 1;
}

function onKeyUp(ev) {
    if (ev.code === 'Space') spaceDown = false;
}

/* ========================================================================== */
/* 18. Exportación                                                            */
/* ========================================================================== */

function exportPDF() {
    if (pen) finishPen();
    TrazoExport.downloadPDF(doc);
    toast('PDF vectorial generado (' + fmt(doc.page.w, 0) + '×' + fmt(doc.page.h, 0) + ' mm)');
}

function exportSVG() {
    if (pen) finishPen();
    TrazoExport.downloadSVG(doc);
    toast('SVG exportado');
}

function printDocument() {
    if (pen) finishPen();
    TrazoExport.print(doc);
}

/* ========================================================================== */
/* 19. Contenido de ejemplo                                                   */
/* ========================================================================== */

function seedExample() {
    var m = 15, W = doc.page.w, H = doc.page.h;
    var frame = newPath([{
        closed: true, nodes: [
            node(m, m), node(W - m, m), node(W - m, H - m), node(m, H - m)
        ]
    }], { stroke: '#0f172a', width: 0.5, fill: null });

    var wave = { closed: false, nodes: [] };
    for (var i = 0; i <= 6; i++) {
        wave.nodes.push(node(m + 10 + i * (W - 2 * m - 20) / 6, H / 2 + Math.sin(i) * 18));
    }
    smoothSub(wave);
    var curve = newPath([wave], { stroke: '#b45309', width: 0.8, fill: null });

    var circle = newPath([ellipseSub({ x0: W / 2 - 22, y0: H / 2 - 62, x1: W / 2 + 22, y1: H / 2 - 18 })],
        { stroke: '#0f172a', width: 0.35, fill: null });

    var label = {
        id: uid('t'), type: 'text', x: W / 2, y: H - m - 8,
        text: 'Trazo Studio · vectores listos para imprimir',
        size: 5, fill: '#334155', align: 'center', opacity: 1
    };

    doc.layers[0].items.push(frame, circle, curve, label);
}

/* ========================================================================== */
/* 20. Arranque                                                               */
/* ========================================================================== */

function bindUI() {
    /* herramientas */
    $$('.vs-tool').forEach(function (b) {
        b.addEventListener('click', function () { setTool(b.dataset.tool); });
    });

    /* pestañas del panel */
    $$('.vs-tab').forEach(function (b) {
        b.addEventListener('click', function () {
            $$('.vs-tab').forEach(function (x) { x.classList.remove('active'); });
            b.classList.add('active');
            $$('.vs-page').forEach(function (p) { p.classList.toggle('active', p.dataset.page === b.dataset.page); });
        });
    });

    /* archivo */
    $('#btnNew').addEventListener('click', newDocument);
    $('#btnOpen').addEventListener('click', function () { $('#fileInput').click(); });
    $('#fileInput').addEventListener('change', function (ev) {
        if (ev.target.files[0]) openProject(ev.target.files[0]);
        ev.target.value = '';
    });
    $('#btnSave').addEventListener('click', saveProject);
    $('#docName').addEventListener('click', function () {
        var n = window.prompt('Nombre del documento:', doc.name);
        if (n) { doc.name = n.trim(); $('#docName').textContent = '— ' + doc.name; }
    });

    $('#btnUndo').addEventListener('click', undo);
    $('#btnRedo').addEventListener('click', redo);
    $('#btnSvg').addEventListener('click', exportSVG);
    $('#btnPdf').addEventListener('click', exportPDF);
    $('#btnPrint').addEventListener('click', printDocument);
    $('#btnHelp').addEventListener('click', function () { $('#help').hidden = false; });
    $('#btnHelpClose').addEventListener('click', function () { $('#help').hidden = true; });
    $('#help').addEventListener('click', function (ev) { if (ev.target.id === 'help') $('#help').hidden = true; });

    /* página */
    $('#pagePreset').addEventListener('change', function () { applyPagePreset(this.value); });
    $('#btnOrient').addEventListener('click', function () {
        pushHistory();
        var w = doc.page.w; doc.page.w = doc.page.h; doc.page.h = w;
        $('#pgW').value = fmt(doc.page.w, 1);
        $('#pgH').value = fmt(doc.page.h, 1);
        fitPage();
    });
    ['#pgW', '#pgH'].forEach(function (idSel) {
        $(idSel).addEventListener('change', function () {
            $('#pagePreset').value = 'custom';
            applyPagePreset('custom');
        });
    });

    /* zoom */
    $('#btnZoomIn').addEventListener('click', function () { zoomButton(1.2); });
    $('#btnZoomOut').addEventListener('click', function () { zoomButton(1 / 1.2); });
    $('#btnZoom100').addEventListener('click', function () { view.z = 96 / 25.4; draw(); });
    $('#btnFit').addEventListener('click', fitPage);

    /* estilo */
    $('#stStroke').addEventListener('input', function () { applyStyle({ stroke: this.value }); });
    $('#stWidth').addEventListener('change', function () { applyStyle({ width: Math.max(0, parseFloat(this.value) || 0) }); });
    $('#stDash').addEventListener('change', function () { applyStyle({ dash: this.value || null }); });
    $('#stCap').addEventListener('change', function () { applyStyle({ cap: this.value, join: this.value === 'butt' ? 'miter' : 'round' }); });
    $('#stFillOn').addEventListener('change', function () { applyStyle({ fill: this.checked ? $('#stFill').value : null }); });
    $('#stFill').addEventListener('input', function () {
        if ($('#stFillOn').checked || selItems().some(function (i) { return i.type === 'text'; })) applyStyle({ fill: this.value });
    });
    $('#stFillRule').addEventListener('change', function () { applyStyle({ fillRule: this.value }); });
    $('#stOpacity').addEventListener('change', function () { applyStyle({ opacity: clamp(parseFloat(this.value) / 100, 0, 1) }); });
    $('#stTextSize').addEventListener('change', function () {
        style.textSize = parseFloat(this.value) || 6;
        var t = selItems().filter(function (i) { return i.type === 'text'; });
        if (t.length) { pushHistory(); t.forEach(function (i) { i.size = style.textSize; }); draw(); }
    });
    $('#stTextValue').addEventListener('change', function () {
        var t = selItems().filter(function (i) { return i.type === 'text'; });
        if (t.length) { pushHistory(); t.forEach(function (i) { i.text = $('#stTextValue').value; }); draw(); }
    });
    $$('[data-align-text]').forEach(function (b) {
        b.addEventListener('click', function () {
            style.textAlign = b.dataset.alignText;
            var t = selItems().filter(function (i) { return i.type === 'text'; });
            if (t.length) { pushHistory(); t.forEach(function (i) { i.align = style.textAlign; }); draw(); }
            toast('Alineación de texto: ' + style.textAlign);
        });
    });

    /* lienzo */
    $('#optGrid').addEventListener('change', function () { opts.grid = this.checked; draw(); });
    $('#optGridStep').addEventListener('change', function () { opts.gridStep = Math.max(0.5, parseFloat(this.value) || 10); draw(); });
    $('#optSnapGrid').addEventListener('change', function () { opts.snapGrid = this.checked; });
    $('#optSnapNode').addEventListener('change', function () { opts.snapNode = this.checked; });
    $('#optOutline').addEventListener('change', function () { opts.outline = this.checked; draw(); });
    $('#opTol').addEventListener('change', function () { opts.tol = Math.max(0.05, parseFloat(this.value) || 0.6); });

    /* geometría */
    function applyBox() {
        var items = selItems();
        var b = bboxOfItems(items);
        if (!b) return;
        var nx = parseFloat($('#trX').value), ny = parseFloat($('#trY').value);
        var nw = parseFloat($('#trW').value), nh = parseFloat($('#trH').value);
        if (!isFinite(nx) || !isFinite(ny) || !isFinite(nw) || !isFinite(nh)) return;
        var w = b.x1 - b.x0, h = b.y1 - b.y0;
        pushHistory();
        var sx = w > 1e-6 ? nw / w : 1, sy = h > 1e-6 ? nh / h : 1;
        if ($('#trLock').checked) {
            if (Math.abs(sx - 1) > Math.abs(sy - 1)) sy = sx; else sx = sy;
        }
        if (sx !== 1 || sy !== 1) scaleItems(items, b.x0, b.y0, sx, sy);
        var nb = bboxOfItems(items);
        items.forEach(function (it) { moveItem(it, nx - nb.x0, ny - nb.y0); });
        syncPanels(); draw();
    }
    ['#trX', '#trY', '#trW', '#trH'].forEach(function (s) { $(s).addEventListener('change', applyBox); });

    $('#btnRotL').addEventListener('click', function () { rotateSel(-Math.abs(parseFloat($('#trAngle').value) || 90)); });
    $('#btnRotR').addEventListener('click', function () { rotateSel(Math.abs(parseFloat($('#trAngle').value) || 90)); });
    $('#btnFlipH').addEventListener('click', function () { flipSel(true); });
    $('#btnFlipV').addEventListener('click', function () { flipSel(false); });
    $$('[data-align]').forEach(function (b) { b.addEventListener('click', function () { alignSelection(b.dataset.align); }); });
    $$('[data-distribute]').forEach(function (b) { b.addEventListener('click', function () { distributeSelection(b.dataset.distribute); }); });
    $('#btnFront').addEventListener('click', function () { bringTo(true); });
    $('#btnBack').addEventListener('click', function () { bringTo(false); });

    /* operaciones */
    $('#opCopy').addEventListener('click', copySelection);
    $('#opPaste').addEventListener('click', function () { pasteClipboard(); });
    $('#opDup').addEventListener('click', duplicateSelection);
    $('#opDelete').addEventListener('click', deleteSelection);
    $('#opJoin').addEventListener('click', joinSelection);
    $('#opBreak').addEventListener('click', breakApart);
    $('#opClose').addEventListener('click', closePaths);
    $('#opOpen').addEventListener('click', openPaths);
    $('#opReverse').addEventListener('click', reversePaths);
    $('#opSmooth').addEventListener('click', smoothPaths);
    $('#opSimplify').addEventListener('click', simplifyPaths);
    $('#opFlatten').addEventListener('click', flattenPaths);
    $('#opUnion').addEventListener('click', function () { booleanOp('union'); });
    $('#opDiff').addEventListener('click', function () { booleanOp('diff'); });
    $('#opInter').addEventListener('click', function () { booleanOp('intersect'); });
    $('#opXor').addEventListener('click', function () { booleanOp('xor'); });
    $('#opNodeAdd').addEventListener('click', function () { setTool('node'); insertNodeAt(cursorMm); });
    $('#opNodeDel').addEventListener('click', function () { if (!deleteSelectedNodes()) toast('Selecciona nodos con la herramienta A'); });
    $('#opNodeCorner').addEventListener('click', function () { setNodeType('corner'); });
    $('#opNodeSmooth').addEventListener('click', function () { setNodeType('smooth'); });
    $('#opNodeSplit').addEventListener('click', splitAtNode);

    /* capas */
    $('#btnAddLayer').addEventListener('click', function () {
        pushHistory();
        doc.layers.push(newLayer('Capa ' + (doc.layers.length + 1)));
        doc.active = doc.layers.length - 1;
        renderLayers();
    });
    $('#btnDelLayer').addEventListener('click', function () {
        if (doc.layers.length < 2) { toast('Debe quedar al menos una capa'); return; }
        pushHistory();
        doc.layers.splice(doc.active, 1);
        doc.active = clamp(doc.active, 0, doc.layers.length - 1);
        sel = []; nodeSel = [];
        renderLayers(); syncPanels(); draw();
    });
    $('#btnRenameLayer').addEventListener('click', function () {
        var n = window.prompt('Nombre de la capa:', activeLayer().name);
        if (n) { pushHistory(); activeLayer().name = n.trim(); renderLayers(); }
    });
    $('#btnMoveToLayer').addEventListener('click', function () {
        var items = selItems();
        if (!items.length) { toast('Nada seleccionado'); return; }
        pushHistory();
        items.forEach(function (it) { removeItem(it.id); activeLayer().items.push(it); });
        renderLayers(); draw();
        toast('Movido a ' + activeLayer().name);
    });

    /* lienzo: eventos de puntero */
    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointermove', onPointerMove);
    cv.addEventListener('pointerup', onPointerUp);
    cv.addEventListener('pointercancel', onPointerUp);
    cv.addEventListener('dblclick', onDoubleClick);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', function (ev) { ev.preventDefault(); if (pen) finishPen(); });

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', resizeCanvas);

    /* panel plegable en pantallas estrechas */
    if (window.matchMedia('(max-width: 900px)').matches) {
        var t = document.createElement('button');
        t.className = 'vs-btn ghost';
        t.textContent = '☰';
        t.title = 'Mostrar / ocultar panel';
        t.addEventListener('click', function () { $('#panel').classList.toggle('open'); });
        document.querySelector('.vs-zoombox').prepend(t);
    }
}

function rotateSel(deg) {
    var items = selItems();
    if (!items.length) return;
    var b = bboxOfItems(items);
    pushHistory();
    rotateItems(items, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, deg);
    syncPanels(); draw();
}

function flipSel(horizontal) {
    var items = selItems();
    if (!items.length) return;
    var b = bboxOfItems(items);
    pushHistory();
    scaleItems(items, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, horizontal ? -1 : 1, horizontal ? 1 : -1);
    syncPanels(); draw();
}

function init() {
    bindUI();
    $('#pgW').value = fmt(doc.page.w, 1);
    $('#pgH').value = fmt(doc.page.h, 1);
    seedExample();
    renderLayers();
    syncPanels();
    setTool('select');
    resizeCanvas();
    fitPage();
    updateUndoButtons();

    if (window.ResizeObserver) {
        new ResizeObserver(resizeCanvas).observe(cv.parentElement);
    }
}

init();
