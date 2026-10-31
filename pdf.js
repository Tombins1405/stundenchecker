/* Minimaler PDF-Schreiber (Helvetica, Windows-1252) ohne Bibliothek. Aufbau: StundenPdf.build(blocks) -> Uint8Array */
(function () {
  var W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  var CP = { 8364: 128, 8218: 130, 8222: 132, 8230: 133, 8216: 145, 8217: 146, 8220: 147, 8221: 148, 8226: 149, 8211: 150, 8212: 151 };
  function code(ch) { var c = ch.charCodeAt(0); if (CP[c]) return CP[c]; if (c < 256) return c; return 63; }
  function cw(ch, bold) { var c = code(ch); var w = (c >= 32 && c <= 126) ? W[c - 32] : 556; return bold ? w * 1.06 : w; }
  function width(s, size, bold) { var t = 0; for (var i = 0; i < s.length; i++) t += cw(s[i], bold); return t * size / 1000; }
  function esc(s) { var o = ''; for (var i = 0; i < s.length; i++) { var c = code(s[i]); if (c === 40 || c === 41 || c === 92) o += '\\' + String.fromCharCode(c); else if (c < 32) o += ' '; else if (c > 126) o += '\\' + ('00' + c.toString(8)).slice(-3); else o += String.fromCharCode(c); } return o; }
  function wrap(s, size, maxW, bold) {
    var words = String(s).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (width(t, size, bold) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur); return lines.length ? lines : [''];
  }
  function build(blocks, opts) {
    var land = opts && opts.landscape, PW = land ? 842 : 595, PH = land ? 595 : 842, M = land ? 30 : 48, CW = PW - 2 * M, pages = [], ops, y;
    function newPage() { ops = []; pages.push(ops); y = PH - M; }
    function need(h) { if (y - h < M + 20) newPage(); }
    function text(x, yy, s, size, bold, al, w) {
      if (!s) return; var tw = width(s, size, bold), xx = al === 'r' ? x + w - tw : al === 'c' ? x + (w - tw) / 2 : x;
      ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + xx.toFixed(1) + ' ' + yy.toFixed(1) + ' Td (' + esc(s) + ') Tj ET');
    }
    function line(x1, y1, x2, y2, g) { ops.push((g || 0.6) + ' G 0.6 w ' + x1 + ' ' + y1.toFixed(1) + ' m ' + x2 + ' ' + y2.toFixed(1) + ' l S'); }
    var imgs = [];
    function useImg(im) { var i = imgs.indexOf(im); if (i < 0) { imgs.push(im); i = imgs.length - 1; } return i; }
    function drawImg(im, x, yy, w, h) { var k = useImg(im), sc = Math.min(w / im.w, h / im.h); ops.push('q ' + (im.w * sc).toFixed(1) + ' 0 0 ' + (im.h * sc).toFixed(1) + ' ' + x.toFixed(1) + ' ' + yy.toFixed(1) + ' cm /Im' + k + ' Do Q'); }
    newPage();
    blocks.forEach(function (b) {
      if (b.t === 'h1') { need(34); text(M, y - 20, b.text, 20, true); y -= 28; line(M, y, PW - M, y, 0.3); y -= 10; }
      else if (b.t === 'h2') { need(26); y -= 6; text(M, y - 12, b.text, 12, true); y -= 20; }
      else if (b.t === 'p') { var ls = wrap(b.text, b.size || 10, CW, b.bold); ls.forEach(function (l) { need(14); text(M, y - 10, l, b.size || 10, b.bold); y -= (b.size || 10) + 4; }); y -= 3; }
      else if (b.t === 'kv') { b.rows.forEach(function (r) { need(15); text(M, y - 10, r[0], 10, true); text(M + 130, y - 10, r[1], 10, false); y -= 15; }); y -= 4; }
      else if (b.t === 'table') {
        var tot = b.cols.reduce(function (a, c) { return a + c.w; }, 0), fs = b.fs || 9, lh = fs + 3, cols = b.cols.map(function (c) { return { w: c.w / tot * CW, al: c.al || 'l' }; });
        function row(cells, bold, shade, ex) {
          var cl = cells.map(function (c, i) { return wrap(c == null ? '' : String(c), fs, cols[i].w - 6, bold); }), n = Math.max.apply(null, cl.map(function (a) { return a.length; })), h = n * lh + 6; if (ex && ex.minH && h < ex.minH) h = ex.minH;
          need(h); if (shade) ops.push('0.92 g ' + M + ' ' + (y - h).toFixed(1) + ' ' + CW + ' ' + h + ' re f 0 g');
          var x = M; cl.forEach(function (ls, i) { ls.forEach(function (l, k) { text(x + 3, y - 10 - k * lh, l, fs, bold, cols[i].al, cols[i].w - 6); }); x += cols[i].w; });
          if (ex && ex.img) { var xi = M; for (var q = 0; q < ex.col; q++) xi += cols[q].w; drawImg(ex.img, xi + 6, y - h + 4, cols[ex.col].w - 12, h - 8); }
          y -= h; line(M, y, PW - M, y, 0.8);
        }
        need(24); line(M, y, PW - M, y, 0.3); row(b.head, true, true);
        b.rows.forEach(function (r) { row(r.cells || r, !!r.bold, false, r.cells ? r : null); });
        y -= 8;
      }
      else if (b.t === 'sig') { need(70); if (b.img) drawImg(b.img, M + 4, y - 40, 190, 38); y -= 36; line(M, y, M + 200, y, 0); line(PW - M - 200, y, PW - M, y, 0); text(M, y - 12, b.l || 'Unterschrift', 9, false); text(PW - M - 200, y - 12, b.r || 'Unterschrift Firma', 9, false); y -= 24; }
      else if (b.t === 'gap') { y -= b.h || 10; }
    });
    var objs = [], offs = [], out = '';
    function add(s) { objs.push(s); return objs.length; }
    add('<< /Type /Catalog /Pages 2 0 R >>'); add(''); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    var imgNo = imgs.map(function (im) { var s = ''; for (var q = 0; q < im.data.length; q++) s += String.fromCharCode(im.data[q]); return add('<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ' + s.length + ' >>\nstream\n' + s + '\nendstream'); });
    var xo = imgNo.length ? ' /XObject << ' + imgNo.map(function (n, q) { return '/Im' + q + ' ' + n + ' 0 R'; }).join(' ') + ' >>' : '';
    var kids = [];
    pages.forEach(function (p, i) {
      p.push('BT /F1 8 Tf ' + (PW / 2 - 20) + ' 24 Td (Seite ' + (i + 1) + ' von ' + pages.length + ') Tj ET');
      var st = p.join('\n'), c = add('<< /Length ' + st.length + ' >>\nstream\n' + st + '\nendstream');
      kids.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents ' + c + ' 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >>' + xo + ' >> >>') + ' 0 R');
    });
    objs[1] = '<< /Type /Pages /Count ' + kids.length + ' /Kids [' + kids.join(' ') + '] >>';
    out = '%PDF-1.4\n'; objs.forEach(function (o, i) { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    var xr = out.length; out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offs.forEach(function (o) { out += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF';
    var u = new Uint8Array(out.length); for (var i = 0; i < out.length; i++) u[i] = out.charCodeAt(i) & 255; return u;
  }
  window.StundenPdf = { build: build };
})();
