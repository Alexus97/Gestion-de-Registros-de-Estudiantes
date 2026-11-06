"use strict";

void import("./regis-track-app.js").catch((error) => {
    console.error("No se pudo cargar RegisTrack.", error);
    const status = document.getElementById("authStatus");
    if (status) {
        status.textContent = "No se pudo cargar la aplicación. Recarga la página para volver a intentarlo.";
        status.dataset.type = "error";
    }
});