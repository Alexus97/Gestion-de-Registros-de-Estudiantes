"use strict";

import * as enrollmentData from "./services/typedata.js";

const FIREBASE_SDK_VERSION = "10.14.1";
const OFFLINE_UID_KEY = "regis-track:last-owner-uid";
const FIREBASE_MODULE_URLS = {
  app: `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`,
  auth: `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`,
  firestore: `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`,
  messaging: `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging.js`,
};

const authForm = document.getElementById("authForm");
const authPanel = document.getElementById("authPanel");
const sessionPanel = document.getElementById("sessionPanel");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authStatus = document.getElementById("authStatus");
const authActions = Array.from(
  authForm.querySelectorAll("button[type='submit']"),
);
const signedInEmail = document.getElementById("signedInEmail");
const signOutButton = document.getElementById("signOutButton");
const enrollmentPanel = document.getElementById("enrollmentPanel");
const authorizeFcmButton = document.getElementById("authorizeFcmButton");
const fcmToken = document.getElementById("fcmToken");
const fcmStatus = document.getElementById("fcmStatus");
const connectionStatus = document.getElementById("connectionStatus");
const serviceWorkerStatus = document.getElementById("serviceWorkerStatus");
const cacheStatus = document.getElementById("cacheStatus");
const updateCacheButton = document.getElementById("updateCacheButton");
const enrollmentForm = document.getElementById("enrollmentForm");
const enrollmentName = document.getElementById("enrollmentName");
const enrollmentProgram = document.getElementById("enrollmentProgram");
const enrollmentPeriod = document.getElementById("enrollmentPeriod");
const enrollmentSubmitButton = document.getElementById(
  "enrollmentSubmitButton",
);
const enrollmentStatus = document.getElementById("enrollmentStatus");
const receiptPanel = document.getElementById("comprobante-card");
const receiptStudent = document.getElementById("receiptStudent");
const receiptProgram = document.getElementById("receiptProgram");
const receiptPeriod = document.getElementById("receiptPeriod");
const receiptCode = document.getElementById("receiptCode");
const receiptConfirmationId = document.getElementById("receiptConfirmationId");
const receiptQr = document.getElementById("receiptQr");
const receiptQrStatus = document.getElementById("receiptQrStatus");
const downloadReceiptPdfButton = document.getElementById(
  "downloadReceiptPdfButton",
);
const receiptDigitalSignature = document.getElementById(
  "receiptDigitalSignature",
);
const receiptLocalStatus = document.getElementById("receiptLocalStatus");
const receiptCloudStatus = document.getElementById("receiptCloudStatus");
const enrollmentList = document.getElementById("enrollmentList");

let auth;
let authSdk;
let firestoreSdk;
let firestore;
let firebaseApp;
let currentUser;
let serviceWorkerRegistration;
let syncInProgress = false;
let syncRequested = false;
let localStoreReady = false;
let authInitialized = false;
let authInitializing = false;
let offlineSession = false;

void enrollmentData
  .initializeLocalStore()
  .then(() => {
    localStoreReady = true;
    enrollmentSubmitButton.disabled = !currentUser;
    if (currentUser) {
      void loadEnrollments(currentUser.uid);
      void syncPendingEnrollments();
    }
  })
  .catch((error) => {
    showStatus(
      enrollmentStatus,
      `No se pudo preparar el almacenamiento local: ${error.message}`,
      "error",
    );
    enrollmentSubmitButton.disabled = true;
  });

function showStatus(element, message, type = "info") {
  element.textContent = message;
  element.dataset.type = type;
}

function updateConnectionStatus() {
  showStatus(
    connectionStatus,
    navigator.onLine
      ? "Conexión disponible."
      : "Sin conexión. La pantalla de acceso está disponible; iniciar sesión requiere internet.",
    navigator.onLine ? "success" : "warning",
  );
  updateCacheButton.disabled =
    !navigator.onLine || !serviceWorkerRegistration?.active;
  updateFcmButtonState();
}

function updateFcmButtonState() {
  authorizeFcmButton.disabled =
    !currentUser ||
    offlineSession ||
    !navigator.onLine ||
    !window.isSecureContext ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator);
}

function setAuthBusy(busy) {
  authActions.forEach((button) => {
    button.disabled = busy;
  });
  authForm.setAttribute("aria-busy", String(busy));
}

function authErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/invalid-email": "Escribe un correo válido.",
    "auth/network-request-failed":
      "No se pudo conectar con Firebase. Comprueba tu conexión.",
    "auth/operation-not-allowed":
      "Habilita el proveedor Correo/contraseña en Firebase Authentication.",
    "auth/too-many-requests":
      "Se limitaron temporalmente los intentos. Prueba más tarde.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/user-disabled": "Esta cuenta está deshabilitada.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Correo o contraseña incorrectos.",
  };
  return (
    messages[error.code] ||
    "No se pudo completar la autenticación. Inténtalo de nuevo."
  );
}

function updateAuthView(user, options = {}) {
  currentUser = user;
  offlineSession = options.offline === true;
  authPanel.hidden = Boolean(user);
  sessionPanel.hidden = !user;
  enrollmentPanel.hidden = !user;
  enrollmentSubmitButton.disabled = !user || !localStoreReady;
  updateFcmButtonState();
  if (user) {
    signedInEmail.textContent = user.email || "Cuenta autenticada";
    if (offlineSession) {
      signedInEmail.textContent = "Última cuenta usada en este dispositivo";
    } else {
      try {
        localStorage.setItem(OFFLINE_UID_KEY, user.uid);
      } catch {
        showStatus(
          enrollmentStatus,
          "El navegador no permitió recordar la cuenta para acceso offline.",
          "warning",
        );
      }
    }
    showStatus(authStatus, "Sesión iniciada.", "success");
    if (offlineSession) {
      showStatus(
        enrollmentStatus,
        "Modo offline local: consulta y guarda comprobantes pendientes. Firebase revalidará la sesión al reconectar.",
        "warning",
      );
    }
    enrollmentForm.reset();
    receiptPanel.hidden = true;
    if (localStoreReady) {
      void loadEnrollments(user.uid);
      void syncPendingEnrollments();
    }
  } else {
    if (!offlineSession) {
      try {
        localStorage.removeItem(OFFLINE_UID_KEY);
      } catch {
        // Local sign-out still proceeds if storage is unavailable.
      }
    }
    enrollmentList.replaceChildren();
    receiptPanel.hidden = true;
  }
}

function renderReceipt(record, elapsedMs = null) {
  receiptPanel.hidden = false;
  receiptStudent.textContent = record.studentName;
  receiptProgram.textContent = record.program;
  receiptPeriod.textContent = record.academicPeriod;
  receiptCode.textContent = `RT-${record.id.slice(0, 8).toUpperCase()}`;
  receiptConfirmationId.textContent = record.id;
  receiptQr.replaceChildren();
  if (typeof globalThis.QRCode === "function") {
    try {
      new globalThis.QRCode(receiptQr, {
        text: record.id,
        width: 144,
        height: 144,
        colorDark: "#123f78",
        colorLight: "#ffffff",
        correctLevel: globalThis.QRCode.CorrectLevel.M,
      });
      receiptQrStatus.textContent = "QR del ID de confirmación";
    } catch (error) {
      receiptQrStatus.textContent = "No se pudo generar el código QR.";
      console.error("No se pudo renderizar el QR del comprobante.", error);
    }
  } else {
    receiptQrStatus.textContent =
      "El QR requiere conexión para cargar la librería. El ID de confirmación sigue disponible.";
  }
  receiptLocalStatus.textContent =
    elapsedMs === null
      ? `Guardado localmente el ${new Date(record.createdAt).toLocaleString("es")}.`
      : `Comprobante guardado localmente en ${Math.round(elapsedMs)} ms.`;
  if (record.syncStatus === "synced") {
    showStatus(receiptCloudStatus, "Respaldado en la nube.", "success");
  } else if (record.syncStatus === "syncing") {
    showStatus(receiptCloudStatus, "Enviando a Firestore…");
  } else if (record.lastSyncError) {
    showStatus(
      receiptCloudStatus,
      `Pendiente de sincronización: ${record.lastSyncError}`,
      "warning",
    );
  } else {
    showStatus(
      receiptCloudStatus,
      "Guardado en este dispositivo; sincronización pendiente.",
      "warning",
    );
  }
}

async function downloadReceiptPdf() {
  const user = auth?.currentUser;
  if (!user) {
    showStatus(
      enrollmentStatus,
      "Inicia sesión con conexión para firmar y exportar el comprobante.",
      "warning",
    );
    return;
  }
  if (typeof globalThis.html2pdf !== "function") {
    showStatus(
      enrollmentStatus,
      "No se pudo cargar html2pdf.js. Conéctate y actualiza la aplicación antes de exportar.",
      "error",
    );
    return;
  }

  downloadReceiptPdfButton.disabled = true;
  const originalHidden = receiptPanel.hidden;
  const styleProperties = [
    "display",
    "visibility",
    "opacity",
    "transition",
    "transform",
    "background-color",
    "color",
  ];
  const originalStyles = new Map(
    styleProperties.map((property) => [
      property,
      {
        value: receiptPanel.style.getPropertyValue(property),
        priority: receiptPanel.style.getPropertyPriority(property),
      },
    ]),
  );

  try {
    const token = await user.getIdToken();
    receiptDigitalSignature.textContent = `Firma Digital (JWT): ${token.slice(0, 30)}...`;
    receiptDigitalSignature.hidden = false;

    receiptPanel.hidden = false;
    receiptPanel.style.setProperty("display", "block", "important");
    receiptPanel.style.setProperty("visibility", "visible", "important");
    receiptPanel.style.setProperty("opacity", "1", "important");
    receiptPanel.style.setProperty("transition", "none", "important");
    receiptPanel.style.setProperty("transform", "none", "important");
    receiptPanel.style.setProperty("background-color", "#ffffff", "important");
    receiptPanel.style.setProperty("color", "#231f20", "important");

    await Promise.all(
      Array.from(receiptPanel.querySelectorAll("img"), (image) => {
        if (image.complete) {
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
          window.setTimeout(resolve, 2000);
        });
      }),
    );
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    await new Promise((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)),
    );

    const studentName = receiptStudent.textContent.trim() || "Estudiante";
    const safeStudentName = studentName
      .replace(/\s+/g, "_")
      .replace(/[<>:"/\\|?*]/g, "");
    const options = {
      margin: [10, 10, 10, 10],
      filename: `Matricula_${safeStudentName}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        letterRendering: true,
        backgroundColor: "#ffffff",
        scrollY: 0,
        scrollX: 0,
        windowWidth: document.documentElement.offsetWidth,
        onclone: (clonedDocument) => {
          const clonedReceipt =
            clonedDocument.getElementById("comprobante-card");
          if (clonedReceipt) {
            clonedReceipt.hidden = false;
            clonedReceipt.style.setProperty("display", "block", "important");
            clonedReceipt.style.setProperty(
              "visibility",
              "visible",
              "important",
            );
            clonedReceipt.style.setProperty("opacity", "1", "important");
            clonedReceipt.style.setProperty("transition", "none", "important");
            clonedReceipt.style.setProperty(
              "background-color",
              "#ffffff",
              "important",
            );
            clonedReceipt.style.setProperty("color", "#231f20", "important");
          }
        },
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };

    await globalThis.html2pdf().set(options).from(receiptPanel).save();
  } catch (error) {
    console.error("No se pudo generar el PDF del comprobante.", error);
    showStatus(
      enrollmentStatus,
      `No se pudo descargar el comprobante PDF: ${error.message}`,
      "error",
    );
  } finally {
    receiptDigitalSignature.textContent = "";
    receiptDigitalSignature.hidden = true;
    receiptPanel.hidden = originalHidden;
    for (const [property, original] of originalStyles) {
      if (original.value) {
        receiptPanel.style.setProperty(
          property,
          original.value,
          original.priority,
        );
      } else {
        receiptPanel.style.removeProperty(property);
      }
    }
    downloadReceiptPdfButton.disabled = false;
  }
}

async function authorizeFcmAndGetToken() {
  if (!currentUser || offlineSession) {
    showStatus(
      fcmStatus,
      "Inicia sesión con conexión para registrar este dispositivo.",
      "warning",
    );
    return;
  }
  if (
    !window.isSecureContext ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  ) {
    showStatus(
      fcmStatus,
      "FCM requiere HTTPS o localhost, Service Worker y soporte de notificaciones.",
      "error",
    );
    return;
  }
  if (!globalThis.FIREBASE_VAPID_KEY) {
    showStatus(
      fcmStatus,
      "Falta configurar la clave pública VAPID en firebase-config.js.",
      "error",
    );
    return;
  }

  authorizeFcmButton.disabled = true;
  showStatus(fcmStatus, "Solicitando permiso para mostrar notificaciones…");
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      showStatus(
        fcmStatus,
        permission === "denied"
          ? "Permiso denegado. Habilítalo en la configuración del sitio y vuelve a intentarlo."
          : "No se concedió permiso para las notificaciones.",
        "warning",
      );
      return;
    }

    const messagingSdk = await import(FIREBASE_MODULE_URLS.messaging);
    if (!(await messagingSdk.isSupported())) {
      throw new Error(
        "Este navegador no es compatible con Firebase Cloud Messaging.",
      );
    }
    const registration =
      serviceWorkerRegistration || (await navigator.serviceWorker.ready);
    if (!registration.active) {
      throw new Error("El Service Worker de RegisTrack no está activo.");
    }
    const messaging = messagingSdk.getMessaging(firebaseApp);
    const token = await messagingSdk.getToken(messaging, {
      vapidKey: globalThis.FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) {
      throw new Error("Firebase no devolvió un token para este dispositivo.");
    }

    fcmToken.value = token;
    showStatus(
      fcmStatus,
      "Token FCM obtenido. Esta demostración lo muestra aquí; todavía no lo guarda en Firestore.",
      "success",
    );
  } catch (error) {
    console.error("No se pudo obtener el token FCM.", error);
    showStatus(
      fcmStatus,
      `No se pudo obtener el token FCM: ${error.message}`,
      "error",
    );
  } finally {
    updateFcmButtonState();
  }
}

function renderEnrollmentList(records) {
  enrollmentList.replaceChildren();
  records.forEach((record) => {
    const item = document.createElement("li");
    const summary = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = record.studentName;
    const detail = document.createElement("span");
    detail.textContent = `${record.program} · ${record.academicPeriod}`;
    const receiptButton = document.createElement("button");
    receiptButton.type = "button";
    receiptButton.className = "receipt-link";
    receiptButton.dataset.enrollmentId = record.id;
    receiptButton.textContent = record.id;
    const status = document.createElement("span");
    status.className = `enrollment-state enrollment-state-${record.syncStatus}`;
    status.textContent =
      record.syncStatus === "synced"
        ? "Respaldado en la nube"
        : record.syncStatus === "syncing"
          ? "Sincronizando"
          : "Pendiente";
    summary.append(name, detail, receiptButton);
    item.append(summary, status);
    enrollmentList.append(item);
  });
}

async function loadEnrollments(ownerUid) {
  try {
    const records = await enrollmentData.getLocalEnrollments(ownerUid);
    if (currentUser?.uid !== ownerUid) {
      return;
    }
    renderEnrollmentList(records);
  } catch (error) {
    showStatus(
      enrollmentStatus,
      `No se pudieron leer los comprobantes locales: ${error.message}`,
      "error",
    );
  }
}

async function syncPendingEnrollments() {
  if (
    !currentUser ||
    !navigator.onLine ||
    !firestore ||
    !firestoreSdk ||
    !enrollmentData
  ) {
    return;
  }
  if (syncInProgress) {
    syncRequested = true;
    return;
  }

  const ownerUid = currentUser.uid;
  syncInProgress = true;
  try {
    do {
      syncRequested = false;
      const pending = await enrollmentData.getPendingEnrollments(ownerUid);
      for (const record of pending) {
        if (!navigator.onLine || currentUser?.uid !== ownerUid) {
          break;
        }

        await enrollmentData.updateLocalSyncState(
          record.id,
          ownerUid,
          "syncing",
        );
        if (currentUser?.uid !== ownerUid) {
          break;
        }
        renderReceipt({ ...record, syncStatus: "syncing", lastSyncError: "" });
        try {
          await enrollmentData.writeEnrollmentToFirestore(
            firestoreSdk,
            firestore,
            record,
          );
          const acknowledged = await enrollmentData.updateLocalSyncState(
            record.id,
            ownerUid,
            "synced",
          );
          if (currentUser?.uid === ownerUid) {
            renderReceipt(acknowledged);
            showStatus(
              enrollmentStatus,
              "Matrícula respaldada en Firestore.",
              "success",
            );
            renderEnrollmentList(
              await enrollmentData.getLocalEnrollments(ownerUid),
            );
          }
        } catch (error) {
          const pendingRecord = await enrollmentData.updateLocalSyncState(
            record.id,
            ownerUid,
            "pending",
            error.message || "No se pudo confirmar la escritura en Firestore.",
          );
          if (currentUser?.uid === ownerUid) {
            renderReceipt(pendingRecord);
            showStatus(
              enrollmentStatus,
              "El comprobante está seguro localmente; se reintentará al recuperar la conexión.",
              "warning",
            );
            renderEnrollmentList(
              await enrollmentData.getLocalEnrollments(ownerUid),
            );
          }
        }
      }
    } while (
      syncRequested &&
      navigator.onLine &&
      currentUser?.uid === ownerUid
    );
  } catch (error) {
    showStatus(
      enrollmentStatus,
      `No se pudo procesar la cola local: ${error.message}`,
      "error",
    );
  } finally {
    syncInProgress = false;
    if (syncRequested && navigator.onLine) {
      syncRequested = false;
      void syncPendingEnrollments();
    }
  }
}

async function initializeAuth() {
  if (authInitialized || authInitializing) {
    return;
  }
  authInitializing = true;
  try {
    if (typeof globalThis.initializeFirebaseClient !== "function") {
      throw new Error(
        "No se encontró la inicialización de Firebase en firebase-config.js.",
      );
    }

    const [appModule, loadedAuthSdk, loadedFirestoreSdk] = await Promise.all([
      import(FIREBASE_MODULE_URLS.app),
      import(FIREBASE_MODULE_URLS.auth),
      import(FIREBASE_MODULE_URLS.firestore),
    ]);
    const client = globalThis.initializeFirebaseClient(
      appModule,
      loadedAuthSdk,
      loadedFirestoreSdk,
    );
    auth = client.auth;
    firebaseApp = client.app;
    firestore = client.firestore;
    authSdk = loadedAuthSdk;
    firestoreSdk = loadedFirestoreSdk;
    await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    authSdk.onAuthStateChanged(
      auth,
      (user) => {
        updateAuthView(user);
      },
      (error) => {
        showStatus(authStatus, authErrorMessage(error), "error");
      },
    );
    authInitialized = true;
    setAuthBusy(false);
  } catch (error) {
    console.error("No se pudo inicializar Firebase Authentication.", error);
    let cachedUid = "";
    try {
      cachedUid = localStorage.getItem(OFFLINE_UID_KEY) || "";
    } catch {
      cachedUid = "";
    }
    if (!navigator.onLine && cachedUid) {
      updateAuthView({ uid: cachedUid, email: null }, { offline: true });
    } else {
      showStatus(
        authStatus,
        "No se pudo conectar con Firebase Authentication. Comprueba la configuración y vuelve a intentarlo.",
        "error",
      );
      setAuthBusy(true);
    }
  } finally {
    authInitializing = false;
  }
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth || !authSdk) {
    showStatus(authStatus, "La autenticación aún no está disponible.", "error");
    return;
  }

  const action = event.submitter?.value;
  const email = authEmail.value.trim();
  const password = authPassword.value;
  setAuthBusy(true);
  showStatus(
    authStatus,
    action === "create" ? "Creando cuenta…" : "Iniciando sesión…",
  );

  try {
    if (action === "create") {
      await authSdk.createUserWithEmailAndPassword(auth, email, password);
    } else {
      await authSdk.signInWithEmailAndPassword(auth, email, password);
    }
    authForm.reset();
  } catch (error) {
    showStatus(authStatus, authErrorMessage(error), "error");
  } finally {
    setAuthBusy(false);
  }
});

signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;
  try {
    if (!authSdk || !auth) {
      updateAuthView(null);
    } else {
      await authSdk.signOut(auth);
    }
    showStatus(authStatus, "Sesión cerrada.", "success");
  } catch (error) {
    showStatus(authStatus, authErrorMessage(error), "error");
  } finally {
    signOutButton.disabled = false;
  }
});

enrollmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !localStoreReady) {
    showStatus(
      enrollmentStatus,
      "Inicia sesión antes de enviar una matrícula.",
      "error",
    );
    return;
  }

  const startedAt = performance.now();
  const ownerUid = currentUser.uid;
  enrollmentSubmitButton.disabled = true;
  showStatus(enrollmentStatus, "Guardando comprobante en este dispositivo…");
  try {
    const enrollment = {
      studentName: enrollmentName.value,
      program: enrollmentProgram.value,
      academicPeriod: enrollmentPeriod.value,
    };
    const duplicate = await enrollmentData.findLocalDuplicateEnrollment(
      ownerUid,
      enrollment.program,
      enrollment.academicPeriod,
    );
    if (duplicate) {
      const message =
        "Ya estás matriculado en este programa para este periodo.";
      window.alert(message);
      showStatus(enrollmentStatus, message, "warning");
      return;
    }

    const record = await enrollmentData.saveLocalEnrollment(
      enrollment,
      ownerUid,
    );
    const elapsedMs = performance.now() - startedAt;
    if (currentUser?.uid !== ownerUid) {
      return;
    }
    renderReceipt(record, elapsedMs);
    showStatus(
      enrollmentStatus,
      elapsedMs < 1000
        ? "Comprobante local listo en menos de 1 segundo."
        : "Comprobante guardado localmente; el dispositivo tardó más de 1 segundo.",
      elapsedMs < 1000 ? "success" : "warning",
    );
    enrollmentForm.reset();
    void loadEnrollments(ownerUid);
    void syncPendingEnrollments();
  } catch (error) {
    if (error.name === "DuplicateEnrollmentError") {
      const message =
        "Ya estás matriculado en este programa para este periodo.";
      window.alert(message);
      showStatus(enrollmentStatus, message, "warning");
      return;
    }
    showStatus(
      enrollmentStatus,
      `No se pudo guardar el comprobante local: ${error.message}`,
      "error",
    );
  } finally {
    enrollmentSubmitButton.disabled = false;
  }
});

enrollmentList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-enrollment-id]");
  if (!button || !currentUser || !enrollmentData) {
    return;
  }

  const ownerUid = currentUser.uid;
  try {
    const records = await enrollmentData.getLocalEnrollments(ownerUid);
    const record = records.find(
      (item) => item.id === button.dataset.enrollmentId,
    );
    if (record && currentUser?.uid === ownerUid) {
      renderReceipt(record);
    }
  } catch (error) {
    showStatus(
      enrollmentStatus,
      `No se pudo abrir el comprobante: ${error.message}`,
      "error",
    );
  }
});

async function updateOfflineCache() {
  if (!navigator.onLine || !serviceWorkerRegistration?.active) {
    showStatus(
      cacheStatus,
      "Conéctate para actualizar la copia sin conexión.",
      "warning",
    );
    return;
  }

  updateCacheButton.disabled = true;
  showStatus(cacheStatus, "Actualizando los recursos guardados…");
  const channel = new MessageChannel();
  const response = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error("El Service Worker no respondió a tiempo."));
    }, 15000);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      if (event.data?.type === "CACHE_UPDATED") {
        resolve(event.data);
      } else {
        reject(
          new Error(
            event.data?.message ||
              "No se pudo actualizar la copia sin conexión.",
          ),
        );
      }
    };
  });

  try {
    serviceWorkerRegistration.active.postMessage({ type: "UPDATE_CACHE" }, [
      channel.port2,
    ]);
    const result = await response;
    showStatus(
      cacheStatus,
      `Copia sin conexión actualizada (${result.count} recursos).`,
      "success",
    );
  } catch (error) {
    showStatus(cacheStatus, error.message, "error");
  } finally {
    updateConnectionStatus();
  }
}

async function registerServiceWorker() {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) {
    showStatus(
      serviceWorkerStatus,
      "El acceso sin conexión requiere HTTPS o localhost.",
      "warning",
    );
    showStatus(
      cacheStatus,
      "Este origen no permite instalar el Service Worker.",
      "warning",
    );
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "./firebase-messaging-sw.js",
      {
        scope: "./",
        updateViaCache: "none",
      },
    );
    serviceWorkerRegistration = registration;
    await navigator.serviceWorker.ready;
    serviceWorkerRegistration =
      (await navigator.serviceWorker.getRegistration("./")) || registration;
    showStatus(
      serviceWorkerStatus,
      navigator.serviceWorker.controller
        ? "Aplicación controlada por el Service Worker."
        : "Service Worker activo; la página quedará controlada al recargar.",
      "success",
    );
    showStatus(
      cacheStatus,
      "La aplicación guardó sus recursos esenciales para uso sin conexión.",
      "success",
    );
    updateConnectionStatus();

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      showStatus(
        serviceWorkerStatus,
        "Aplicación controlada por el Service Worker.",
        "success",
      );
    });
  } catch (error) {
    console.error("No se pudo instalar el Service Worker.", error);
    showStatus(
      serviceWorkerStatus,
      "No se pudo activar el Service Worker.",
      "error",
    );
    showStatus(
      cacheStatus,
      "No se pudo preparar la copia sin conexión.",
      "error",
    );
  }
}

window.addEventListener("online", () => {
  updateConnectionStatus();
  void initializeAuth();
  void syncPendingEnrollments();
});
window.addEventListener("offline", updateConnectionStatus);
window.addEventListener("focus", syncPendingEnrollments);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    void syncPendingEnrollments();
  }
});
updateCacheButton.addEventListener("click", updateOfflineCache);
downloadReceiptPdfButton.addEventListener("click", downloadReceiptPdf);
authorizeFcmButton.addEventListener("click", authorizeFcmAndGetToken);
updateConnectionStatus();
void registerServiceWorker();
void initializeAuth();
