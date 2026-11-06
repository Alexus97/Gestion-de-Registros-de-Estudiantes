"use strict";

importScripts("./src/scripts/config/firebase-config.js");
importScripts("./service-worker.js");

const FIREBASE_SDK_VERSION = "10.14.1";
const firebaseConfig = globalThis.FIREBASE_CONFIG;
const hasFirebaseConfig = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"]
  .every((field) => typeof firebaseConfig?.[field] === "string" && firebaseConfig[field].length > 0);

if (hasFirebaseConfig) {
  try {
    importScripts(
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`,
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`
    );

    const firebaseApp = firebase.apps.length > 0
      ? firebase.app()
      : firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging(firebaseApp);

    messaging.onBackgroundMessage((payload) => {
      const data = payload.data || {};
      const notification = payload.notification || {};
      const title = notification.title || data.title || "RegisTrack";
      const body = notification.body || data.body || "Hay una actualización sobre tu matrícula.";

      return self.registration.showNotification(title, {
        body,
        icon: "./src/assets/icons/app-icon.svg",
        data: { url: data.url || "./" },
        tag: data.transactionId || "regis-track-confirmation"
      });
    });
  } catch (error) {
    console.error("FCM no está disponible en este momento; el worker offline sigue activo.", error);
  }
}
