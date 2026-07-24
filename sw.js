const CACHE_NAME = "la-lupita-prototipo-v12";
const APP_SHELL = [
  "./",
  "index.html",
  "cliente.html",
  "dueno.html",
  "manifest-cliente.webmanifest",
  "manifest-admin.webmanifest",
  "styles.css",
  "api-config.js",
  "shared-store.js",
  "pwa.js",
  "cliente.js",
  "dueno.js",
  "assets/logo-lupita-real.jpeg",
  "assets/app-icon-pan.svg",
  "assets/icon-cliente-192.png",
  "assets/icon-cliente.png",
  "assets/icon-admin-192.png",
  "assets/icon-admin.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
