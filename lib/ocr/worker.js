/* Stunden-Checker: Texterkennung für Lohnzettel-Fotos.
   Läuft nur auf diesem Gerät (WebAssembly), es wird nichts hochgeladen.
   Erkennung: Tesseract (Apache-Lizenz 2.0, siehe tesseract-LICENSE.txt), Sprachdaten Deutsch (tessdata_fast). */
var T = null, api = null, startP = null;
function simd() { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; } }
function start() {
  if (startP) return startP;
  startP = new Promise(function (ok, fail) {
    try { importScripts(simd() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'); } catch (e) { fail(e); return; }
    self.TesseractCore({}).then(function (m) { T = m; return fetch('deu.traineddata'); })
      .then(function (r) { if (!r.ok) throw new Error('Sprachdaten fehlen'); return r.arrayBuffer(); })
      .then(function (buf) {
        T.FS.writeFile('/deu.traineddata', new Uint8Array(buf));
        api = new T.TessBaseAPI();
        if (api.Init('/', 'deu', 1) !== 0) throw new Error('Start der Texterkennung fehlgeschlagen');
        ok();
      }).catch(fail);
  });
  return startP;
}
function lese(bytes) {
  T.FS.writeFile('/input', bytes);
  // 1. Schräglage messen, 2. gerade gedreht als ein Textblock lesen (Tabellenzeilen bleiben zusammen)
  api.SetVariable('tessedit_pageseg_mode', '3');
  if (api.SetImageFile(1, 0) === 1) throw new Error('Bild nicht lesbar');
  api.FindLines();
  var w = api.GetGradient ? api.GetGradient() : (api.GetAngle ? api.GetAngle() : 0);
  api.SetVariable('tessedit_pageseg_mode', '6');
  api.SetVariable('preserve_interword_spaces', '1');
  if (api.SetImageFile(1, Math.abs(w) > 0.005 && Math.abs(w) < 0.35 ? w : 0) === 1) throw new Error('Bild nicht lesbar');
  api.Recognize(null);
  var t = api.GetUTF8Text() || '';
  try { T.FS.unlink('/input'); } catch (e) {}
  return t;
}
self.onmessage = function (ev) {
  var d = ev.data || {};
  start().then(function () { self.postMessage({ id: d.id, ok: true, text: lese(d.bytes) }); })
    .catch(function (e) { self.postMessage({ id: d.id, ok: false, msg: String(e && e.message || e) }); });
};
