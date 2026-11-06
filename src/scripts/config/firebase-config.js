"use strict";

globalThis.FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyD-ee8DjWxAXbPUiFGSZoUIxez5Olzxk9Y",
  authDomain: "registroestudiantes-1e405.firebaseapp.com",
  projectId: "registroestudiantes-1e405",
  storageBucket: "registroestudiantes-1e405.firebasestorage.app",
  messagingSenderId: "369220522594",
  appId: "1:369220522594:web:58e0e8c0aa4d8526d1373b",
});

globalThis.FIREBASE_VAPID_KEY =
  "BDatl2h2Xa0QRAK0U8eMApGn0DtYgqMHW2Izc-3DW3ZuuswCcBI-xDn7HiTuT7XnjEE0Rv0MP3uE7H-Vf9eBhWY";

globalThis.initializeFirebaseClient = (appSdk, authSdk, firestoreSdk) => {
  const config = globalThis.FIREBASE_CONFIG;
  const requiredFields = ["apiKey", "authDomain", "projectId", "appId"];
  if (
    !requiredFields.every(
      (field) =>
        typeof config?.[field] === "string" && config[field].length > 0,
    )
  ) {
    throw new Error("La configuración de Firebase está incompleta.");
  }

  const app =
    appSdk.getApps().length > 0
      ? appSdk.getApp()
      : appSdk.initializeApp(config);
  return {
    app,
    auth: authSdk.getAuth(app),
    firestore: firestoreSdk.getFirestore(app),
  };
};
