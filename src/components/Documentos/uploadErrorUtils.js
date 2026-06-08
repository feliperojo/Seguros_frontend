const MAX_BYTES = 50 * 1024 * 1024;

const TRADUCCIONES = {
  "The archivo field is required.": "No se recibió ningún archivo.",
  "The archivo must be a file.": "El archivo adjunto no es válido.",
  "The archivo failed to upload.": "El servidor no pudo procesar el archivo. Verifica tu conexión e intenta de nuevo.",
  "Debe adjuntar un archivo.": "No se recibió ningún archivo.",
  "El archivo adjunto no es válido.": "El archivo adjunto no es válido.",
  "El archivo supera el tamaño máximo permitido de 50 MB.": "El archivo supera el tamaño máximo permitido de 50 MB.",
};

const formatearTamaño = (bytes) => {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
};

const traducirMensaje = (mensaje = "") => {
  if (!mensaje) return "Error desconocido";

  if (TRADUCCIONES[mensaje]) return TRADUCCIONES[mensaje];

  const matchKb = mensaje.match(/greater than (\d+) kilobytes/i);
  if (matchKb) {
    const mb = Math.round(Number(matchKb[1]) / 1024);
    return `El archivo supera el tamaño máximo permitido de ${mb} MB.`;
  }

  return mensaje;
};

const extraerErroresValidacion = (err) => {
  const errors = err?.response?.errors || err?.response?.data?.errors;
  if (!errors || typeof errors !== "object") return [];

  return Object.entries(errors).flatMap(([campo, mensajes]) => {
    const lista = Array.isArray(mensajes) ? mensajes : [mensajes];
    return lista.map((mensaje) => `${campo}: ${traducirMensaje(mensaje)}`);
  });
};

/**
 * Convierte un error de API en un mensaje claro para el usuario.
 */
export const formatearErrorApi = (err, archivo = null) => {
  const status = err?.response?.status;
  const validaciones = extraerErroresValidacion(err);

  if (validaciones.length > 0) {
    return validaciones.join(" ");
  }

  if (archivo?.size > MAX_BYTES) {
    return `El archivo pesa ${formatearTamaño(archivo.size)} y el máximo permitido es 50 MB.`;
  }

  if (status === 401) {
    return "Tu sesión expiró. Inicia sesión nuevamente e intenta subir el archivo otra vez.";
  }

  if (status === 403) {
    return "No tienes permisos para subir archivos en esta carpeta.";
  }

  if (status === 404) {
    return "No se encontró la carpeta o el servicio de subida. Recarga la página e intenta de nuevo.";
  }

  if (status === 413) {
    return "El archivo es demasiado grande para el servidor. El máximo permitido es 50 MB.";
  }

  if (status === 422) {
    return traducirMensaje(err?.message) || "El archivo no cumple los requisitos de validación.";
  }

  if (status >= 500) {
    return "Error interno del servidor al subir el archivo. Intenta de nuevo en unos minutos.";
  }

  if (err?.isTimeout) {
    return "El servidor tardó demasiado en responder al subir este archivo. Suele ocurrir con archivos pesados o al subir muchos archivos seguidos.";
  }

  const msgRed = (err?.message || "").toLowerCase();
  const esErrorRed =
    err?.isNetworkError ||
    msgRed.includes("failed to fetch") ||
    msgRed.includes("networkerror") ||
    msgRed.includes("load failed") ||
    msgRed.includes("network request failed");

  if (esErrorRed) {
    return "El servidor no respondió al subir este archivo (conexión interrumpida o tiempo de espera agotado tras varios intentos).";
  }

  return traducirMensaje(err?.message) || "No se pudo subir el archivo por un error inesperado.";
};

/**
 * Determina si un error de subida puede reintentarse.
 */
export const esErrorReintentable = (err) => {
  if (!err) return false;
  if (err.isNetworkError || err.isTimeout) return true;

  const msg = (err.message || "").toLowerCase();
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("network request failed")
  ) {
    return true;
  }

  const status = err?.response?.status;
  if (!status) return true;
  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;

  return false;
};

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ejecuta una subida con reintentos automáticos ante fallos de red.
 */
export const ejecutarConReintentos = async (fn, { maxIntentos = 3, pausaMs = 1500 } = {}) => {
  let ultimoError;

  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    try {
      return await fn(intento);
    } catch (err) {
      ultimoError = err;
      if (!esErrorReintentable(err) || intento === maxIntentos) {
        throw err;
      }
      await esperar(pausaMs * intento);
    }
  }

  throw ultimoError;
};

/**
 * Arma un resumen legible cuando fallan uno o más archivos.
 */
export const formatearResumenErroresSubida = (errores = [], subidos = 0) => {
  if (!errores.length) return "";

  const lineas = errores.map((item) => {
    const nombre = item.archivo || item.ruta || "Elemento desconocido";
    const ubicacion = item.ruta && item.ruta !== nombre ? ` (${item.ruta})` : "";
    return `• ${nombre}${ubicacion}: ${item.mensaje}`;
  });

  const encabezado =
    subidos > 0
      ? `Se subieron ${subidos} archivo(s), pero ${errores.length} fallaron:`
      : `No se pudo completar la subida. ${errores.length} error(es):`;

  return `${encabezado}\n${lineas.join("\n")}`;
};

export const validarArchivoAntesDeSubir = (archivo) => {
  if (!archivo) {
    return "No se detectó ningún archivo para subir.";
  }

  if (archivo.size === 0) {
    return `El archivo "${archivo.name}" está vacío (0 bytes).`;
  }

  if (archivo.size > MAX_BYTES) {
    return `El archivo "${archivo.name}" pesa ${formatearTamaño(archivo.size)} y el máximo permitido es 50 MB.`;
  }

  return null;
};
