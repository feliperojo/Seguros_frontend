export const LIMITE_TAMANO_MB = 50;
export const MAX_BYTES = LIMITE_TAMANO_MB * 1024 * 1024;

export const TEXTO_LIMITE_SUBIDA =
  `Puede arrastrar archivos o carpetas completas (con subcarpetas). Cada archivo puede pesar hasta ${LIMITE_TAMANO_MB} MB.`;

export const TEXTO_ARRASTRE_EXTERNO =
  "Arrastre el nombre del archivo (icono ⋮⋮) al cuadro de mensaje de WhatsApp en el mismo navegador.";

export const TEXTO_ARRASTRE_CRUCE_NAVEGADORES =
  "Si WhatsApp está en Safari y esta ventana en Chrome (o al revés), el arrastre entre ventanas no funciona en Mac. Use el botón verde de WhatsApp: guarda el archivo en Descargas y arrástrelo desde ahí al chat.";
const TIMEOUT_BASE_MS = 120000;
const TIMEOUT_MAX_MS = 300000;

export const calcularTimeoutSubida = (bytes = 0) => {
  const mb = bytes / (1024 * 1024);
  return Math.min(TIMEOUT_MAX_MS, Math.max(TIMEOUT_BASE_MS, TIMEOUT_BASE_MS + mb * 4000));
};

export const calcularPausaTrasSubida = (bytes = 0, indice = 0) => {
  const base = 700;
  const porTamano = Math.min(2500, Math.floor(bytes / (512 * 1024)) * 250);
  const pausaPorLote = indice > 0 && indice % 5 === 0 ? 2500 : 0;
  return base + porTamano + pausaPorLote;
};

const TRADUCCIONES = {
  "The archivo field is required.": "No se recibió ningún archivo.",
  "The archivo must be a file.": "El archivo adjunto no es válido.",
  "The archivo failed to upload.": "El servidor no pudo procesar el archivo. Verifica tu conexión e intenta de nuevo.",
  "Debe adjuntar un archivo.": "No se recibió ningún archivo.",
  "El archivo adjunto no es válido.": "El archivo adjunto no es válido.",
  "El archivo supera el tamaño máximo permitido de 50 MB.": "El archivo supera el tamaño máximo permitido de 50 MB.",
};

export const formatearTamaño = (bytes) => {
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

const mensajeRechazoPorTamano = (nombreArchivo, tamanoBytes) => {
  const nombre = nombreArchivo ? `"${nombreArchivo}"` : "El archivo";
  const peso = tamanoBytes ? ` (${formatearTamaño(tamanoBytes)})` : "";
  return `${nombre} no se subió porque pesa más de lo permitido${peso}. El límite máximo es ${LIMITE_TAMANO_MB} MB por archivo.`;
};

const esErrorValidacionTamano = (mensaje = "") => {
  const m = mensaje.toLowerCase();
  return (
    m.includes("supera el tamaño") ||
    m.includes("too large") ||
    m.includes("entity too large") ||
    m.includes("post too large") ||
    m.includes("greater than") ||
    m.includes("kilobytes")
  );
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
    const texto = validaciones.join(" ");
    if (esErrorValidacionTamano(texto)) {
      return mensajeRechazoPorTamano(archivo?.name, archivo?.size);
    }
    return texto;
  }

  if (archivo?.size > MAX_BYTES) {
    return mensajeRechazoPorTamano(archivo?.name, archivo?.size);
  }

  if (esErrorValidacionTamano(err?.message || "")) {
    return mensajeRechazoPorTamano(archivo?.name, archivo?.size);
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
    return mensajeRechazoPorTamano(archivo?.name, archivo?.size);
  }

  if (status === 422) {
    const msg = traducirMensaje(err?.message) || "El archivo no cumple los requisitos de validación.";
    if (esErrorValidacionTamano(msg)) {
      return mensajeRechazoPorTamano(archivo?.name, archivo?.size);
    }
    return msg;
  }

  if (status >= 500) {
    if (archivo?.size > MAX_BYTES) {
      return mensajeRechazoPorTamano(archivo?.name, archivo?.size);
    }
    return "Error interno del servidor al subir el archivo. Intenta de nuevo en unos minutos.";
  }

  const detalleTamano = archivo?.size
    ? ` (${formatearTamaño(archivo.size)})`
    : "";

  if (err?.isTimeout) {
    return `Tiempo de espera agotado al subir este archivo${detalleTamano}. En producción el servidor o el proxy pueden cortar peticiones largas; se reintentó automáticamente sin éxito.`;
  }

  const msgRed = (err?.message || "").toLowerCase();
  const esErrorRed =
    err?.isNetworkError ||
    msgRed.includes("failed to fetch") ||
    msgRed.includes("networkerror") ||
    msgRed.includes("load failed") ||
    msgRed.includes("network request failed");

  if (esErrorRed) {
    if (archivo?.size > MAX_BYTES) {
      return mensajeRechazoPorTamano(archivo?.name, archivo?.size);
    }
    return `El servidor de producción no completó la subida de este archivo${detalleTamano} (conexión cortada o tiempo de espera del proxy/servidor). No es un problema de tu internet si otros archivos de la misma carpeta sí subieron.`;
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
export const ejecutarConReintentos = async (fn, { maxIntentos = 5, pausaMs = 2000 } = {}) => {
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
    return mensajeRechazoPorTamano(archivo.name, archivo.size);
  }

  return null;
};
