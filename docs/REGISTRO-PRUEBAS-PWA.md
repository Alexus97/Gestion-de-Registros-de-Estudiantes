# Registro de validación RegisTrack PWA

## Validación automática/local completada

| Caso                    | Resultado | Evidencia                                                                                                                                                            |
| ----------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sintaxis JavaScript     | Correcto  | `node --check` en `src/scripts/app.js`, `src/scripts/regis-track-app.js`, `src/scripts/config/firebase-config.js`, `service-worker.js` y `firebase-messaging-sw.js`. |
| Manifiesto              | Correcto  | `manifest.webmanifest` se analiza como JSON válido.                                                                                                                  |
| Servir recursos         | Correcto  | HTTP 200 para `/`, el módulo Auth y ambos workers mediante `python3 -m http.server 8000`.                                                                            |
| Diagnósticos del editor | Correcto  | Sin errores reportados en HTML, scripts, workers y manifiesto modificados.                                                                                           |

## Pendiente en navegador/Firebase

| Caso                                     | Resultado esperado                                                                                                                 | Estado                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Primera instalación y control del worker | `firebase-messaging-sw.js` queda activo, controla la página e importa la estrategia offline.                                       | Pendiente de prueba real en navegador.                                                                 |
| Recarga offline                          | La pantalla de acceso y recursos del shell aparecen tras la primera carga conectada. El inicio de sesión informa que requiere red. | Pendiente de prueba real en navegador.                                                                 |
| Actualización manual de caché            | `UPDATE_CACHE` responde `CACHE_UPDATED` y actualiza el shell `regis-track-shell-v6`.                                               | Pendiente de prueba real en navegador.                                                                 |
| Crear cuenta e iniciar sesión            | Firebase Auth acepta Email/Password y restaura la sesión tras recargar.                                                            | Requiere proveedor Email/Password habilitado y dominio autorizado.                                     |
| Cerrar sesión y errores                  | La UI vuelve al acceso y comunica errores de credenciales, red o proveedor deshabilitado.                                          | Pendiente de prueba con el proyecto Firebase.                                                          |
| Obtener token FCM                        | Con sesión activa, el botón pide permiso y muestra el token en el `textarea`.                                                      | Código integrado; pendiente de probar con permiso concedido en navegador. El token aún no se persiste. |
| Push FCM                                 | Function emite la confirmación tras el ACK de matrícula y el worker la muestra en segundo plano.                                   | Pendiente: asociación del token a la cuenta y flujo de envío automático.                               |

Los resultados históricos de pruebas del CRUD de estudiantes, IndexedDB y la caché `registro-estudiantes-shell-v5/v6` no representan la aplicación RegisTrack actual y no se consideran evidencia de aceptación para este alcance.
