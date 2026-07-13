// Service worker mínimo: solo lo necesario para que Chrome considere
// el sitio "instalable" y muestre el botón de instalar/agregar a inicio.
const CACHE = "notilea-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
