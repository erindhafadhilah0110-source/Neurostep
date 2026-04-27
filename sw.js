// ============================================================
// NEUROSTEP - Service Worker
// ============================================================
// Strategi cache:
//   - Shell app (HTML, CSS, JS, font) → Cache First
//   - Request lain (API Supabase, dll) → Network First
// ============================================================

const CACHE_NAME = "neurostep-v1";
const OFFLINE_URL = "/index.html";

// File yang di-cache saat instalasi (app shell)
const PRECACHE_ASSETS = [
  "/index.html",
  "/style.css",
  "/script.js",
  "/config.js",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  // Google Fonts (opsional — hapus jika tidak ingin cache font)
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
];

// ============================================================
// INSTALL — cache app shell
// ============================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Pre-caching app shell");
      // addAll gagal total jika satu URL error,
      // pakai loop agar font eksternal tidak memblokir instalasi
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn(`[SW] Gagal cache: ${url}`, err)
          )
        )
      );
    })
  );
  // Aktifkan SW baru langsung tanpa menunggu tab lama ditutup
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — hapus cache lama
// ============================================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[SW] Menghapus cache lama:", key);
            return caches.delete(key);
          })
      )
    )
  );
  // Ambil kontrol semua tab yang sudah terbuka
  self.clients.claim();
});

// ============================================================
// FETCH — strategi cache
// ============================================================
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Abaikan request non-GET dan chrome-extension
  if (request.method !== "GET") return;
  if (url.protocol === "chrome-extension:") return;

  // Request ke Supabase API → Network First
  if (url.hostname.includes("supabase.co")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Request ke Google Fonts → Cache First
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // App shell (same-origin) → Cache First, fallback ke network
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default → Network First
  event.respondWith(networkFirst(request));
});

// ============================================================
// HELPER: Cache First
// Coba cache dulu, jika tidak ada ambil dari network lalu simpan.
// ============================================================
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Jika offline dan tidak ada cache, kembalikan halaman offline
    const fallback = await caches.match(OFFLINE_URL);
    return fallback || new Response("Offline — tidak ada koneksi internet.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

// ============================================================
// HELPER: Network First
// Coba network dulu, jika gagal (offline) gunakan cache.
// ============================================================
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(
      JSON.stringify({ error: "Offline — tidak ada koneksi internet." }),
      {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      }
    );
  }
}
