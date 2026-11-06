"use strict";

const DATABASE_NAME = "regis-track";
const DATABASE_VERSION = 1;
const ENROLLMENTS_STORE = "matriculas";

let databasePromise;

function openDatabase() {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(
        new Error("Este navegador no permite guardar comprobantes localmente."),
      );
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ENROLLMENTS_STORE)) {
        const store = database.createObjectStore(ENROLLMENTS_STORE, {
          keyPath: "id",
        });
        store.createIndex("ownerUid", "ownerUid", { unique: false });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };
    request.onerror = () =>
      reject(
        request.error || new Error("No se pudo abrir el almacenamiento local."),
      );
    request.onblocked = () =>
      reject(
        new Error(
          "Cierra otras pestañas de RegisTrack para actualizar el almacenamiento.",
        ),
      );
  }).catch((error) => {
    databasePromise = undefined;
    throw error;
  });

  return databasePromise;
}

export async function initializeLocalStore() {
  await openDatabase();
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () =>
      reject(
        transaction.error || new Error("La operación local fue cancelada."),
      );
    transaction.onerror = () =>
      reject(transaction.error || new Error("Falló una operación local."));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Falló una consulta local."));
  });
}

function createEnrollmentId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function validateEnrollment(data, ownerUid) {
  if (typeof ownerUid !== "string" || ownerUid.length === 0) {
    throw new Error("Inicia sesión antes de guardar una matrícula.");
  }
  if (
    typeof data.studentName !== "string" ||
    data.studentName.trim().length < 2 ||
    data.studentName.trim().length > 100
  ) {
    throw new Error("El nombre debe tener entre 2 y 100 caracteres.");
  }
  if (
    typeof data.program !== "string" ||
    data.program.trim().length < 2 ||
    data.program.trim().length > 100
  ) {
    throw new Error("El programa debe tener entre 2 y 100 caracteres.");
  }
  if (
    typeof data.academicPeriod !== "string" ||
    data.academicPeriod.trim().length < 2 ||
    data.academicPeriod.trim().length > 30
  ) {
    throw new Error("El periodo académico debe tener entre 2 y 30 caracteres.");
  }
}

function normalizeDuplicateValue(value) {
  return value.trim().normalize("NFKC").toLocaleLowerCase("es");
}

function isDuplicateEnrollment(record, program, academicPeriod) {
  return (
    normalizeDuplicateValue(record.program) ===
      normalizeDuplicateValue(program) &&
    normalizeDuplicateValue(record.academicPeriod) ===
      normalizeDuplicateValue(academicPeriod)
  );
}

function duplicateEnrollmentError() {
  const error = new Error(
    "Ya estás matriculado en este programa para este periodo.",
  );
  error.name = "DuplicateEnrollmentError";
  return error;
}

export async function findLocalDuplicateEnrollment(
  ownerUid,
  program,
  academicPeriod,
) {
  const database = await openDatabase();
  const transaction = database.transaction(ENROLLMENTS_STORE, "readonly");
  const completed = transactionComplete(transaction);
  const [records] = await Promise.all([
    requestResult(
      transaction
        .objectStore(ENROLLMENTS_STORE)
        .index("ownerUid")
        .getAll(ownerUid),
    ),
    completed,
  ]);
  return (
    records.find((record) =>
      isDuplicateEnrollment(record, program, academicPeriod),
    ) || null
  );
}

export async function saveLocalEnrollment(data, ownerUid) {
  validateEnrollment(data, ownerUid);
  const record = {
    id: createEnrollmentId(),
    ownerUid,
    studentName: data.studentName.trim(),
    program: data.program.trim(),
    academicPeriod: data.academicPeriod.trim(),
    createdAt: new Date().toISOString(),
    syncStatus: "pending",
    lastSyncError: "",
  };

  const database = await openDatabase();
  const transaction = database.transaction(ENROLLMENTS_STORE, "readwrite");
  let duplicateError;
  const completed = new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () =>
      reject(
        duplicateError ||
          transaction.error ||
          new Error("La operación local fue cancelada."),
      );
    transaction.onerror = () =>
      reject(
        duplicateError ||
          transaction.error ||
          new Error("Falló una operación local."),
      );
  });
  const store = transaction.objectStore(ENROLLMENTS_STORE);
  const existingRequest = store.index("ownerUid").getAll(ownerUid);
  existingRequest.onsuccess = () => {
    const duplicate = existingRequest.result.find((existingRecord) =>
      isDuplicateEnrollment(
        existingRecord,
        record.program,
        record.academicPeriod,
      ),
    );
    if (duplicate) {
      duplicateError = duplicateEnrollmentError();
      transaction.abort();
      return;
    }
    store.add(record);
  };
  await completed;
  return record;
}

export async function getLocalEnrollments(ownerUid) {
  const database = await openDatabase();
  const transaction = database.transaction(ENROLLMENTS_STORE, "readonly");
  const completed = transactionComplete(transaction);
  const [records] = await Promise.all([
    requestResult(
      transaction
        .objectStore(ENROLLMENTS_STORE)
        .index("ownerUid")
        .getAll(ownerUid),
    ),
    completed,
  ]);
  return records.sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );
}

export async function getPendingEnrollments(ownerUid) {
  const records = await getLocalEnrollments(ownerUid);
  return records.filter(
    (record) =>
      record.syncStatus === "pending" || record.syncStatus === "syncing",
  );
}

export async function updateLocalSyncState(
  id,
  ownerUid,
  syncStatus,
  lastSyncError = "",
) {
  const database = await openDatabase();
  const transaction = database.transaction(ENROLLMENTS_STORE, "readwrite");
  const completed = transactionComplete(transaction);
  const store = transaction.objectStore(ENROLLMENTS_STORE);
  try {
    const record = await requestResult(store.get(id));
    if (!record || record.ownerUid !== ownerUid) {
      await completed;
      throw new Error("No se encontró el comprobante local de esta cuenta.");
    }

    record.syncStatus = syncStatus;
    record.lastSyncError = lastSyncError;
    if (syncStatus === "synced") {
      record.syncedAt = new Date().toISOString();
    }
    store.put(record);
    await completed;
    return record;
  } catch (error) {
    await completed.catch(() => undefined);
    throw error;
  }
}

export async function writeEnrollmentToFirestore(
  firestoreSdk,
  database,
  enrollment,
) {
  const reference = firestoreSdk.doc(database, "matriculas", enrollment.id);
  const enrollmentData = {
    ownerUid: enrollment.ownerUid,
    studentName: enrollment.studentName,
    program: enrollment.program,
    academicPeriod: enrollment.academicPeriod,
  };

  await firestoreSdk.runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists()) {
      const currentData = snapshot.data();
      const sameRequest =
        currentData.ownerUid === enrollmentData.ownerUid &&
        currentData.studentName === enrollmentData.studentName &&
        currentData.program === enrollmentData.program &&
        currentData.academicPeriod === enrollmentData.academicPeriod;
      if (!sameRequest) {
        throw new Error(
          "El identificador del comprobante ya pertenece a otra matrícula.",
        );
      }
      return;
    }

    transaction.set(reference, {
      ...enrollmentData,
      createdAt: firestoreSdk.serverTimestamp(),
    });
  });

  return { id: enrollment.id, acknowledged: true };
}
