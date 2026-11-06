"use strict";

const CACHE_NAME = "regis-track-shell-v10";
const LEGACY_CACHE_PREFIX = "registro-estudiantes-shell-";
const CACHE_PREFIX = "regis-track-shell-";
const EXTERNAL_SHELL_FILES = [
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js",
];
const SHELL_FILES = [
  "./",
  "./index.html",
  "./src/scripts/app.js",
  "./src/scripts/regis-track-app.js",
  "./src/scripts/services/typedata.js",
  "./src/scripts/config/firebase-config.js",
  "./firebase-messaging-sw.js",
  "./service-worker.js",
  "./src/styles/styles.css",
  "./manifest.webmanifest",
  "./src/assets/icons/app-icon.svg",
  ...EXTERNAL_SHELL_FILES,
];
const OPTIONAL_EXTERNAL_ASSETS = new Set(EXTERNAL_SHELL_FILES);

async function guardarAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const localShellFiles = SHELL_FILES.filter(
    (assetUrl) =>
      new URL(assetUrl, self.location.origin).origin === self.location.origin,
  );
  await cache.addAll(localShellFiles);
  const cachedExternalAssets = await Promise.all(
    Array.from(OPTIONAL_EXTERNAL_ASSETS, async (assetUrl) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(assetUrl, {
          mode: "cors",
          signal: controller.signal,
        });
        if (response.ok || response.type === "opaque") {
          await cache.put(assetUrl, response.clone());
          return 1;
        }
      } catch {
        return 0;
      } finally {
        clearTimeout(timeout);
      }
      return 0;
    }),
  );
  return (
    SHELL_FILES.length +
    cachedExternalAssets.reduce((total, count) => total + count, 0)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(guardarAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter(
              (nombre) =>
                (nombre.startsWith(CACHE_PREFIX) ||
                  nombre.startsWith(LEGACY_CACHE_PREFIX)) &&
                nombre !== CACHE_NAME,
            )
            .map((nombre) => caches.delete(nombre)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "UPDATE_CACHE") {
    return;
  }

  const puerto = event.ports[0];
  event.waitUntil(
    guardarAppShell()
      .then((count) => puerto?.postMessage({ type: "CACHE_UPDATED", count }))
      .catch((error) =>
        puerto?.postMessage({
          type: "CACHE_UPDATE_FAILED",
          message: error.message,
        }),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") {
    return;
  }

  if (OPTIONAL_EXTERNAL_ASSETS.has(url.href)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }

        const response = await fetch(request);
        if (response.ok || response.type === "opaque") {
          await cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match(request)) ||
            (await cache.match(
              new URL("./index.html", self.registration.scope),
            )) ||
            new Response(
              "La página aún no está disponible en la caché sin conexión.",
              {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
              },
            )
          );
        }
      })(),
    );
    return;
  }

  const shellUrl = SHELL_FILES.some(
    (path) => new URL(path, self.registration.scope).href === url.href,
  );
  if (!shellUrl) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }

      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(
    event.notification.data?.url || "./",
    self.registration.scope,
  );
  if (destination.origin !== self.location.origin) {
    destination.href = self.registration.scope;
  }
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existingClient = clients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (existingClient) {
          return existingClient.navigate(destination.href);
        }
        return self.clients.openWindow(destination.href);
      }),
  );
});
