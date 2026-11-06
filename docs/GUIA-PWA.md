# RegisTrack PWA: guía offline

## Servir la aplicación

El Service Worker requiere HTTPS o `localhost`; no abras la página con `file://`. Desde la raíz del proyecto:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. La pantalla y recursos esenciales se cachean tras una primera carga con conexión. Firebase Auth requiere red para iniciar o crear sesión.

## Worker y caché

La aplicación registra un solo worker raíz: `firebase-messaging-sw.js`. Este importa `src/scripts/config/firebase-config.js` y `service-worker.js`; por ello, el mismo worker controla el cacheo offline, la navegación y los eventos de FCM. No registres otro worker con alcance `/`.

En Chrome o Edge, abre **Application > Service Workers** y confirma que `firebase-messaging-sw.js` está activo y controla la página. En **Application > Cache Storage**, revisa la caché vigente `regis-track-shell-v6`. La lista de recursos se define en `SHELL_FILES` dentro de `service-worker.js`.

La navegación usa **network-first** con fallback a `index.html`; los recursos del shell usan **cache-first**. El botón **Actualizar copia offline** envía `UPDATE_CACHE` al worker y espera `CACHE_UPDATED`. Al activar una nueva versión, se eliminan las cachés antiguas de RegisTrack y de la app anterior.

Para probar: carga con red, espera al worker activo, cambia Network a **Offline** y recarga. Debe mostrarse la pantalla de acceso. Iniciar sesión no puede completarse offline. Restaura la conexión y prueba la actualización manual de la caché.

## Firebase Auth

Activa **Authentication > Sign-in method > Email/Password** y añade `localhost` en **Authentication > Settings > Authorized domains**. El cliente conserva la sesión en el navegador con Firebase Auth. No se cachean credenciales ni respuestas de Firebase.

## FCM

La guía de configuración y el estado del flujo de push están en [GUIA-FCM.md](./GUIA-FCM.md). Tras iniciar sesión, la UI puede solicitar permiso y mostrar el token FCM. El worker muestra notificaciones de fondo y limita el clic al mismo origen. La asociación del token con la cuenta y el envío automático de confirmaciones siguen pendientes.
