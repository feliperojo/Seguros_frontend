const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

const getAuthToken = () => localStorage.getItem("auth_token");

const MIME_POR_EXTENSION = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const normalizarMime = (nombre, tipoMime, blobType) => {
  if (tipoMime) return tipoMime;
  const ext = (nombre || "").split(".").pop()?.toLowerCase() || "";
  if (MIME_POR_EXTENSION[ext]) return MIME_POR_EXTENSION[ext];
  if (blobType && blobType !== "application/octet-stream") return blobType;
  return "application/octet-stream";
};

export const esSafari = () => {
  const ua = navigator.userAgent || "";
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/i.test(ua);
};

/**
 * Descarga el archivo vía API y lo prepara para arrastrar a WhatsApp Web u otras apps.
 */
export const obtenerArchivoParaArrastre = async (archivoId, archivo) => {
  const token = getAuthToken();
  const url = `${API_BASE}/documentos-adjuntos/${archivoId}/contenido`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error("No se pudo preparar el archivo para arrastrar.");
  }

  const blob = await response.blob();
  const nombre = archivo?.nombre_original || "archivo";
  const tipo = normalizarMime(nombre, archivo?.tipo_mime, blob.type);

  const file = new File([blob], nombre, {
    type: tipo,
    lastModified: Date.now(),
  });

  const blobUrl = URL.createObjectURL(file);

  return { file, blobUrl };
};

/**
 * Configura dataTransfer según el navegador.
 * - Chrome/Firefox: items.add (no usar setData después).
 * - Safari/WebKit: DownloadURL con enlace blob (arrastre hacia apps externas).
 */
export const configurarArrastreExterno = (dataTransfer, { file, blobUrl }) => {
  if (!dataTransfer || !file) return false;

  dataTransfer.effectAllowed = "copy";

  if (esSafari()) {
    if (!blobUrl) return false;
    try {
      dataTransfer.setData("DownloadURL", `${file.type}:${file.name}:${blobUrl}`);
      return true;
    } catch (err) {
      console.warn("DownloadURL falló en Safari:", err);
      return false;
    }
  }

  if (dataTransfer.items) {
    try {
      dataTransfer.items.add(file);
      return true;
    } catch (err) {
      console.warn("items.add falló:", err);
    }
  }

  return false;
};

/**
 * Guarda el archivo en Descargas para adjuntarlo manualmente en WhatsApp (Safari u otro navegador).
 */
export const guardarArchivoEnDescargas = ({ file, blobUrl }, nombre) => {
  const url = blobUrl || URL.createObjectURL(file);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre || file?.name || "archivo";
  enlace.style.display = "none";
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
};
