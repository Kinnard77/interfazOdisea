/* ============================================================================
   Trazo Studio — Exportación vectorial (SVG · PDF · Impresión)
   ----------------------------------------------------------------------------
   El documento vive en milímetros con el origen en la esquina superior
   izquierda de la página. El PDF se escribe a mano (sin librerías): los
   operadores de trazado de PDF son equivalentes a los de una ruta Bézier,
   así que la exportación es 100% vectorial y por tanto imprimible a
   cualquier resolución.
   ========================================================================== */

(function (global) {
    'use strict';

    var MM2PT = 72 / 25.4;          // 1 mm = 2.8346 pt
    var r3 = function (n) { return Math.round(n * 1000) / 1000; };

    /* ---------------------------------------------------------------- utils */

    function hexToRgb(hex) {
        var h = String(hex || '#000000').replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        var n = parseInt(h, 16);
        if (isNaN(n)) n = 0;
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }

    function escapeXml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* Convierte un subtrazo en una lista de comandos independientes del
       formato de salida: {op:'M'|'L'|'C'|'Z', pts:[...]}  (coordenadas en mm) */
    function subToCommands(sub) {
        var n = sub.nodes, out = [], i, a, b, c1, c2;
        if (!n || n.length === 0) return out;
        out.push({ op: 'M', pts: [n[0].x, n[0].y] });
        var last = sub.closed ? n.length : n.length - 1;
        for (i = 0; i < last; i++) {
            a = n[i];
            b = n[(i + 1) % n.length];
            if (!a.ho && !b.hi) {
                out.push({ op: 'L', pts: [b.x, b.y] });
            } else {
                c1 = a.ho || { x: a.x, y: a.y };
                c2 = b.hi || { x: b.x, y: b.y };
                out.push({ op: 'C', pts: [c1.x, c1.y, c2.x, c2.y, b.x, b.y] });
            }
        }
        if (sub.closed) out.push({ op: 'Z', pts: [] });
        return out;
    }

    function itemCommands(item) {
        var cmds = [], i;
        for (i = 0; i < item.subs.length; i++) {
            cmds = cmds.concat(subToCommands(item.subs[i]));
        }
        return cmds;
    }

    /* ------------------------------------------------------------------ SVG */

    function commandsToD(cmds) {
        var d = [], i, c;
        for (i = 0; i < cmds.length; i++) {
            c = cmds[i];
            if (c.op === 'Z') { d.push('Z'); continue; }
            d.push(c.op + c.pts.map(r3).join(' '));
        }
        return d.join(' ');
    }

    function toSVG(doc, opts) {
        opts = opts || {};
        var W = doc.page.w, H = doc.page.h;
        var out = [];
        out.push('<svg xmlns="http://www.w3.org/2000/svg" version="1.1" ' +
            'width="' + W + 'mm" height="' + H + 'mm" viewBox="0 0 ' + W + ' ' + H + '">');
        out.push('<title>' + escapeXml(doc.name || 'Trazo Studio') + '</title>');
        if (opts.background !== false) {
            out.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>');
        }

        doc.layers.forEach(function (layer) {
            if (!layer.visible) return;
            out.push('<g id="' + escapeXml(layer.name) + '">');
            layer.items.forEach(function (item) {
                var op = (item.opacity == null ? 1 : item.opacity);
                var attrs = op < 1 ? ' opacity="' + r3(op) + '"' : '';
                if (item.type === 'text') {
                    out.push('<text x="' + r3(item.x) + '" y="' + r3(item.y) + '"' +
                        ' font-family="Helvetica, Arial, sans-serif"' +
                        ' font-size="' + r3(item.size) + '"' +
                        ' text-anchor="' + (item.align === 'center' ? 'middle' : item.align === 'right' ? 'end' : 'start') + '"' +
                        ' fill="' + (item.fill || '#000000') + '"' + attrs + '>' +
                        escapeXml(item.text) + '</text>');
                    return;
                }
                var d = commandsToD(itemCommands(item));
                if (!d) return;
                var s = '<path d="' + d + '"';
                s += ' fill="' + (item.fill ? item.fill : 'none') + '"';
                if (item.fill && item.fillRule === 'evenodd') s += ' fill-rule="evenodd"';
                if (item.width > 0 && item.stroke) {
                    s += ' stroke="' + item.stroke + '" stroke-width="' + r3(item.width) + '"';
                    s += ' stroke-linecap="' + (item.cap || 'round') + '"';
                    s += ' stroke-linejoin="' + (item.join || 'round') + '"';
                    if (item.dash) s += ' stroke-dasharray="' + item.dash + '"';
                } else {
                    s += ' stroke="none"';
                }
                out.push(s + attrs + '/>');
            });
            out.push('</g>');
        });

        out.push('</svg>');
        return out.join('\n');
    }

    /* ------------------------------------------------------------------ PDF */

    // cp1252: caracteres frecuentes fuera de latin-1
    var CP1252 = {
        0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
        0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
        0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
        0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
        0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
        0x017E: 0x9E, 0x0178: 0x9F
    };

    function pdfString(str) {
        var out = '', i, code;
        for (i = 0; i < str.length; i++) {
            code = str.charCodeAt(i);
            if (CP1252[code] !== undefined) code = CP1252[code];
            if (code > 255) code = 63; // '?'
            var ch = String.fromCharCode(code);
            if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
            else if (code < 32) out += ' ';
            else out += ch;
        }
        return '(' + out + ')';
    }

    /* Cadenas del diccionario Info: UTF-16BE con BOM para admitir acentos */
    function pdfUnicodeString(str) {
        var out = '\xFE\xFF', i, code, ch;
        for (i = 0; i < str.length; i++) {
            code = str.charCodeAt(i);
            ch = String.fromCharCode((code >> 8) & 0xFF) + String.fromCharCode(code & 0xFF);
            out += ch.replace(/([()\\])/g, '\\$1');
        }
        return '(' + out + ')';
    }

    var CAPS = { butt: 0, round: 1, square: 2 };
    var JOINS = { miter: 0, round: 1, bevel: 2 };

    function buildContent(doc) {
        var H = doc.page.h;
        var X = function (v) { return r3(v * MM2PT); };
        var Y = function (v) { return r3((H - v) * MM2PT); };
        var s = [], alphas = {};

        doc.layers.forEach(function (layer) {
            if (!layer.visible) return;
            layer.items.forEach(function (item) {
                var hasFill = !!item.fill;
                var hasStroke = !!(item.stroke && item.width > 0);
                if (!hasFill && !hasStroke) return;

                s.push('q');

                var op = (item.opacity == null ? 1 : item.opacity);
                if (op < 1) {
                    var key = 'GS' + Math.round(op * 100);
                    alphas[key] = op;
                    s.push('/' + key + ' gs');
                }

                if (item.type === 'text') {
                    var c = hexToRgb(item.fill || item.stroke || '#000000');
                    var size = item.size * MM2PT;
                    var tx = item.x;
                    if (item.align === 'center' || item.align === 'right') {
                        var w = measureHelvetica(item.text, item.size);
                        tx -= (item.align === 'center' ? w / 2 : w);
                    }
                    s.push(r3(c[0]) + ' ' + r3(c[1]) + ' ' + r3(c[2]) + ' rg');
                    s.push('BT /F1 ' + r3(size) + ' Tf ' + X(tx) + ' ' + Y(item.y) + ' Td ' +
                        pdfString(item.text) + ' Tj ET');
                    s.push('Q');
                    return;
                }

                if (hasStroke) {
                    var sc = hexToRgb(item.stroke);
                    s.push(r3(sc[0]) + ' ' + r3(sc[1]) + ' ' + r3(sc[2]) + ' RG');
                    s.push(r3(item.width * MM2PT) + ' w');
                    s.push((CAPS[item.cap] != null ? CAPS[item.cap] : 1) + ' J');
                    s.push((JOINS[item.join] != null ? JOINS[item.join] : 1) + ' j');
                    if (item.dash) {
                        var arr = String(item.dash).split(',').map(function (v) {
                            return r3(parseFloat(v) * MM2PT);
                        });
                        s.push('[' + arr.join(' ') + '] 0 d');
                    } else {
                        s.push('[] 0 d');
                    }
                }
                if (hasFill) {
                    var fc = hexToRgb(item.fill);
                    s.push(r3(fc[0]) + ' ' + r3(fc[1]) + ' ' + r3(fc[2]) + ' rg');
                }

                var cmds = itemCommands(item), i, cm, p;
                if (!cmds.length) { s.push('Q'); return; }
                for (i = 0; i < cmds.length; i++) {
                    cm = cmds[i]; p = cm.pts;
                    if (cm.op === 'M') s.push(X(p[0]) + ' ' + Y(p[1]) + ' m');
                    else if (cm.op === 'L') s.push(X(p[0]) + ' ' + Y(p[1]) + ' l');
                    else if (cm.op === 'C') s.push(X(p[0]) + ' ' + Y(p[1]) + ' ' + X(p[2]) + ' ' +
                        Y(p[3]) + ' ' + X(p[4]) + ' ' + Y(p[5]) + ' c');
                    else if (cm.op === 'Z') s.push('h');
                }

                var eo = (item.fillRule === 'evenodd') ? '*' : '';
                if (hasFill && hasStroke) s.push('B' + eo);
                else if (hasFill) s.push('f' + eo);
                else s.push('S');

                s.push('Q');
            });
        });

        return { stream: s.join('\n'), alphas: alphas };
    }

    /* Anchos de Helvetica (base-14) para alinear texto centrado/derecha */
    var HELV_W = [
        278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
        556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
        1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
        667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
        333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
        556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
    ];
    function measureHelvetica(text, sizeMm) {
        var total = 0, i, c;
        for (i = 0; i < text.length; i++) {
            c = text.charCodeAt(i);
            total += (c >= 32 && c <= 126) ? HELV_W[c - 32] : 556;
        }
        return total / 1000 * sizeMm;
    }

    function toPDF(doc) {
        var W = r3(doc.page.w * MM2PT), H = r3(doc.page.h * MM2PT);
        var built = buildContent(doc);
        var content = built.stream;

        var gsKeys = Object.keys(built.alphas);
        var gsRes = '';
        if (gsKeys.length) {
            gsRes = '/ExtGState << ' + gsKeys.map(function (k) {
                var a = r3(built.alphas[k]);
                return '/' + k + ' << /Type /ExtGState /CA ' + a + ' /ca ' + a + ' >>';
            }).join(' ') + ' >> ';
        }

        var now = new Date();
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        var stamp = 'D:' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
            pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());

        var objs = [];
        objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
        objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] ' +
            '/Resources << /ProcSet [/PDF /Text] ' + gsRes + '/Font << /F1 5 0 R >> >> ' +
            '/Contents 4 0 R >>';
        objs[4] = '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream';
        objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        objs[6] = '<< /Producer ' + pdfUnicodeString('Trazo Studio') +
            ' /Creator ' + pdfUnicodeString('Trazo Studio — editor vectorial') +
            ' /Title ' + pdfUnicodeString(doc.name || 'Trazo') +
            ' /CreationDate ' + pdfString(stamp) + ' >>';

        var pdf = '%PDF-1.4\n%âãÏÓ\n';
        var offsets = [];
        for (var i = 1; i < objs.length; i++) {
            offsets[i] = pdf.length;
            pdf += i + ' 0 obj\n' + objs[i] + '\nendobj\n';
        }
        var xref = pdf.length;
        pdf += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
        for (i = 1; i < objs.length; i++) {
            pdf += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
        }
        pdf += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R /Info 6 0 R >>\n' +
            'startxref\n' + xref + '\n%%EOF';

        var bytes = new Uint8Array(pdf.length);
        for (i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xFF;
        return bytes;
    }

    /* --------------------------------------------------------------- salida */

    function download(filename, blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }

    function downloadSVG(doc, filename) {
        download(filename || (doc.name || 'trazo') + '.svg',
            new Blob([toSVG(doc)], { type: 'image/svg+xml' }));
    }

    function downloadPDF(doc, filename) {
        download(filename || (doc.name || 'trazo') + '.pdf',
            new Blob([toPDF(doc)], { type: 'application/pdf' }));
    }

    /* Impresión a tamaño real: se inserta el SVG en mm y se fija @page */
    function printDoc(doc) {
        var area = document.getElementById('printArea');
        if (!area) return;
        var styleId = 'vs-print-style';
        var st = document.getElementById(styleId);
        if (!st) {
            st = document.createElement('style');
            st.id = styleId;
            document.head.appendChild(st);
        }
        st.textContent = '@page { size: ' + doc.page.w + 'mm ' + doc.page.h + 'mm; margin: 0; }';
        area.innerHTML = toSVG(doc, { background: false });
        window.print();
    }

    global.TrazoExport = {
        MM2PT: MM2PT,
        toSVG: toSVG,
        toPDF: toPDF,
        subToCommands: subToCommands,
        measureHelvetica: measureHelvetica,
        download: download,
        downloadSVG: downloadSVG,
        downloadPDF: downloadPDF,
        print: printDoc
    };

})(window);
