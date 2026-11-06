# Firebase Cloud Messaging en RegisTrack

## Estado actual

El Service Worker raíz `firebase-messaging-sw.js` carga la configuración pública de `src/scripts/config/firebase-config.js`, importa `service-worker.js` y configura `onBackgroundMessage()` con Firebase compat `10.14.1`. Si los scripts remotos de FCM no pueden cargarse, los handlers offline ya registrados siguen disponibles.

Después de iniciar sesión, el panel **Firebase Cloud Messaging** permite pedir permiso desde un clic explícito y obtener el token con la clave VAPID configurada. El token se muestra en un `textarea` de solo lectura y no se persiste. Su asociación segura con el UID y el envío automático de confirmaciones siguen pendientes junto con Cloud Functions.

## Configuración del proyecto

1. En Firebase Console, registra una aplicación Web y verifica `apiKey`, `authDomain`, `projectId`, `messagingSenderId` y `appId` en `src/scripts/config/firebase-config.js`.
2. En **Project settings > Cloud Messaging**, habilita Firebase Cloud Messaging y configura Web Push. La clave VAPID del cliente es pública; nunca publiques credenciales de Admin SDK, cuenta de servicio o claves privadas.
3. Sirve el sitio mediante HTTPS o `localhost`; no uses `file://`. Para Auth, habilita **Email/Password** y autoriza `localhost` en Firebase Authentication.
4. Mantén la versión del SDK compat del worker alineada con los módulos Firebase usados por la página.

## Diseño del envío

El cliente no enviará mensajes con credenciales administrativas. Una Cloud Function de confianza deberá reaccionar a una matrícula recién aceptada en Firestore, comprobar que el evento no se haya procesado antes, recuperar el token asociado al usuario y enviar la confirmación. Las reglas Firestore deben impedir que un usuario lea o modifique tokens de otra cuenta.

El mensaje puede incluir `transactionId` y una URL relativa al comprobante. El worker muestra título/cuerpo y limita el clic al mismo origen. La entrega push depende de permisos del usuario, navegador y servicio push; no debe ser la única forma de consultar el comprobante.

## Probar la obtención del token

1. Sirve RegisTrack por HTTPS o `localhost` y habilita Email/Password en Firebase Authentication.
2. Inicia sesión, abre el panel Firebase Cloud Messaging y pulsa **Autorizar y obtener token FCM**.
3. Concede el permiso del navegador. La UI muestra el token en el campo de solo lectura.
4. No publiques el token ni lo guardes en capturas o repositorios. En esta fase solo se muestra para demostrar la suscripción del navegador.

## Validación pendiente

Cuando el flujo de matrícula y el guardado seguro del token estén implementados, prueba con un dispositivo autorizado: push tras ACK de Firestore, recepción con la app en segundo plano y navegación al comprobante al pulsar la notificación. Documenta por separado los fallos de permisos, red, reglas y Function; no afirmes entrega hasta observarla en el dispositivo.
