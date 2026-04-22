// Service Worker mínimo — solo activa el trigger de instalación PWA.
// No implementa cache offline. Las solicitudes siempre van a la red.
self.addEventListener("install", () => {
  self.skipWaiting()
})
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim())
})
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request))
})
