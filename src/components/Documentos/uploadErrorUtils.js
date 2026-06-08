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

  if (err?.message?.toLowerCase().includes("failed to fetch")) {
    return "No hay conexión con el servidor. Verifica tu internet e intenta de nuevo.";
  }

  return traducirMensaje(err?.message) || "No se pudo subir el archivo por un error inesperado.";
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
