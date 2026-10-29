/* Minimaler Service Worker: macht die App installierbar. Es wird nichts zwischengespeichert,
   darum sehen alle immer die neueste Version. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () { });
