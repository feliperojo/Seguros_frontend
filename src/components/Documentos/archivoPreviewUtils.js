/**
 * Tipos de archivo que el navegador puede previsualizar en el modal (PDF e imágenes).
 */
export const puedeVisualizarseEnNavegador = (tipoMime = "", nombre = "") => {
  const tipo = (tipoMime || "").toLowerCase();
  const ext = (nombre || "").split(".").pop()?.toLowerCase() || "";

  if (tipo.includes("pdf") || ext === "pdf") return true;
  if (
    tipo.includes("image") ||
    ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)
  ) {
    return true;
  }

  return false;
};

export const obtenerTipoVistaPrevia = (tipoMime = "", nombre = "") => {
  const tipo = (tipoMime || "").toLowerCase();
  const ext = (nombre || "").split(".").pop()?.toLowerCase() || "";

  if (tipo.includes("pdf") || ext === "pdf") return "pdf";
  if (
    tipo.includes("image") ||
    ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)
  ) {
    return "imagen";
  }
  return "otro";
};
