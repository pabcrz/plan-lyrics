/* Service worker de Plan & Lyrics: abrir la aplicación sin red tras una primera visita.
 * Guarda solo archivos de la propia aplicación y las tipografías. Nunca toca /api ni /m (datos y enlaces privados). */
const SHELL = 'pl-shell-v1'
const ASSETS = 'pl-assets-v1'
const FONTS = 'pl-fonts-v1'
const KEEP = [SHELL, ASSETS, FONTS]

self.addEventListener('install', (event) => {
  // No se activa sola: la página avisa «Hay una versión nueva» y pide el cambio con SKIP_WAITING.
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add('/')))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => !KEEP.includes(name)).map((name) => caches.delete(name)))).then(() => self.clients.claim()))
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(staleWhileRevalidate(FONTS, request))
    return
  }
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/m/') || url.pathname === '/sw.js') return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(SHELL).then((cache) => cache.put('/', response.clone()))
      return response
    }).catch(() => caches.match('/')))
    return
  }
  // Los archivos de /assets llevan hash en el nombre: nunca cambian, se sirven de la caché.
  if (url.pathname.startsWith('/assets/')) event.respondWith(caches.open(ASSETS).then(async (cache) => (await cache.match(request)) ?? fetchAndPut(cache, request)))
  else event.respondWith(staleWhileRevalidate(SHELL, request))
})

const fetchAndPut = async (cache, request) => {
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}
const staleWhileRevalidate = async (name, request) => {
  const cache = await caches.open(name)
  const cached = await cache.match(request)
  const network = fetchAndPut(cache, request).catch(() => cached)
  return cached ?? network
}
