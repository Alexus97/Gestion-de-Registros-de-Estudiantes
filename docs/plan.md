# Plan de implementación RegisTrack

## Alcance confirmado

RegisTrack reemplaza por completo la lista local de estudiantes e inventario por un portal de matrícula académica. La autenticación usa Firebase Auth con correo/contraseña. La confirmación push automática se enviará desde Cloud Functions después de aceptar la matrícula en Firestore; nunca se enviarán credenciales administrativas al navegador.

## Tareas y estado

1. **Estabilizar PWA/offline — implementado.** `firebase-messaging-sw.js` es el único worker raíz y carga `service-worker.js`; este precarga el shell RegisTrack, ofrece fallback offline y responde a `UPDATE_CACHE`. FCM se carga de forma opcional, de modo que un fallo al descargar el SDK no anule el worker offline. El worker limpia las cachés anteriores de la app.
2. **Autenticación — implementado.** La página ofrece inicio de sesión, creación de cuenta y cierre de sesión por correo/contraseña. Firebase Auth se inicializa desde `src/scripts/config/firebase-config.js`, mantiene la sesión local del navegador y actualiza la vista al cambiar el estado.
3. **Matrícula en Firestore — implementado.** `src/scripts/services/typedata.js` guarda en `/matriculas/{id}` con UUID local estable y usa una transacción idempotente para reintentos. La UI presenta un formulario de nombre, programa y periodo; esta selección de campos es el esquema inicial.
4. **Reglas Firestore — implementado y desplegado.** `firestore.rules` es default-deny, exige `ownerUid == request.auth.uid`, valida campos y fecha de servidor y prohíbe actualizaciones/borrados desde clientes. El 2026-11-05 Firebase compiló y desplegó las reglas en `registroestudiantes-1e405`.
5. **Push automático — pendiente.** Registrar tokens vinculados al UID y disparar Cloud Function al confirmar una matrícula, evitando duplicados. Resolver clic de notificación hacia el comprobante.
6. **Pruebas E2E y evidencia — pendiente.** Probar usuarios distintos, errores de red/reglas, sincronización única, recibo offline, ACK cloud, push en primer/segundo plano e instalación en navegadores objetivo.

## Uso y límites actuales

- El shell y la pantalla de acceso pueden cargarse offline después de una primera visita con conexión. Iniciar sesión requiere conexión a Firebase.
- El formulario, recibo local y sincronización Firestore ya están implementados. El envío solo se marca respaldado después del ACK de la transacción.
- La UI solicita permiso FCM y muestra el token de este dispositivo; aún no lo persiste ni lo asocia al UID. El worker puede recibir mensajes en segundo plano, pero el envío de confirmación sigue pendiente.
- La configuración Firebase Web y VAPID es pública; no introducir secretos de Admin SDK en archivos cliente.
- Habilitar el proveedor Email/Password en Firebase Console y autorizar `localhost` para desarrollo.

## Validación realizada para los pasos 1 y 2

- `node --check` pasó para `src/scripts/app.js`, `src/scripts/regis-track-app.js`, `src/scripts/config/firebase-config.js`, `service-worker.js` y `firebase-messaging-sw.js`.
- `manifest.webmanifest` se pudo analizar como JSON.
- La página, el módulo Auth y ambos workers respondieron HTTP 200 con `python3 -m http.server 8000`.
- El editor no reportó diagnósticos en los archivos modificados.
- Firebase compiló y desplegó `firestore.rules` en la base `(default)` de Standard en `us-central1`.
- La captura integrada verificó la vista de acceso; la herramienta de automatización carece del binario Chromium y no ejecutó la matrícula real.
- La escritura/ACK con sesión real, recarga offline de comprobantes, intentos entre dos usuarios y sincronización tras reconexión aún requieren prueba E2E.
