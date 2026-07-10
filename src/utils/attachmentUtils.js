import apiRequest from "../services/api";

/** Base API (misma convención que TareasPendientesPanel). */
export const API_PUBLIC_BASE =
  (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "") || "/api";

/**
 * URL absoluta para `<img>` / fetch: el API a veces devuelve rutas relativas (`/storage/...`).
 * Referencia: TareasPendientesPanel.jsx
 */
export function resolveAttachmentPublicUrl(url) {
  if (url == null || typeof url !== "string") return url;
  const trimmed = url.trim();
  if (!trimmed) return url;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return trimmed;
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${API_PUBLIC_BASE}${path}`;
}

export function isPrivateS3Url(url) {
  if (!url || typeof url !== "string") return false;
  return /amazonaws\.com/i.test(url) || /\.s3\./i.test(url);
}

export function getAdjuntoKey(adjunto) {
  if (!adjunto) return "";
  return String(adjunto.id ?? adjunto.url ?? "");
}

export function isAdjuntoAuditoriaDisponible(adjunto) {
  return adjunto?.disponible === true;
}

const DEFAULT_S3_PUBLIC_BASE =
  (import.meta.env.VITE_S3_PUBLIC_BASE_URL || "https://tampa-seguros-archivos.s3.amazonaws.com").replace(
    /\/+$/,
    ""
  );

/**
 * URL para <img> / preview en auditoría.
 * Solo si adjunto.disponible === true (contrato backend).
 */
export function getAdjuntoDisplayUrl(adjunto) {
  if (!adjunto || !isAdjuntoAuditoriaDisponible(adjunto)) return null;
  const raw = adjunto.url ?? adjunto.file_url ?? adjunto.download_url;
  if (raw != null && typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed) return resolveAttachmentPublicUrl(trimmed);
  }
  const ruta = adjunto.ruta_archivo;
  if (typeof ruta === "string") {
    const trimmedRuta = ruta.trim();
    if (!trimmedRuta) return null;
    if (/^https?:\/\//i.test(trimmedRuta)) return trimmedRuta;
    return `${DEFAULT_S3_PUBLIC_BASE}/${trimmedRuta.replace(/^\//, "")}`;
  }
  return null;
}

/** GET /api/auditorias/adjuntos/{id}/descargar → { url } */
export async function fetchAuditoriaAdjuntoDownloadUrl(adjuntoId) {
  if (!adjuntoId) return null;
  try {
    const res = await apiRequest(`auditorias/adjuntos/${adjuntoId}/descargar`, "GET");
    const url = res?.url ?? res?.data?.url;
    return typeof url === "string" && url.trim()
      ? resolveAttachmentPublicUrl(url.trim())
      : null;
  } catch {
    return null;
  }
}

export async function abrirAdjuntoAuditoriaEnNuevaPestana(adjunto) {
  if (!adjunto) return;
  let url = getAdjuntoDisplayUrl(adjunto);
  if (!url && adjunto.id) {
    url = await fetchAuditoriaAdjuntoDownloadUrl(adjunto.id);
  }
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

/** Descarga / abre adjunto de auditoría (sin endpoints de bitácora operativa). */
export async function descargarAdjuntoAuditoria(adjunto) {
  if (!adjunto) return;

  const nombre = adjunto.nombre_original || adjunto.filename || "archivo";

  try {
    if (adjunto.id) {
      const signed = await fetchAuditoriaAdjuntoDownloadUrl(adjunto.id);
      if (signed) {
        const link = document.createElement("a");
        link.href = signed;
        link.download = nombre;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
    }

    const direct = getAdjuntoDisplayUrl(adjunto);
    if (!direct) throw new Error("Adjunto no disponible");

    const response = await fetch(direct);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = nombre;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("Error al descargar adjunto de auditoría:", error);
    await abrirAdjuntoAuditoriaEnNuevaPestana(adjunto);
  }
}

export function unwrapAuditoriaCommentResponse(response) {
  if (!response || typeof response !== "object") return null;
  return response.comment ?? response.data ?? response;
}

export function esImagenAdjunto(adj) {
  return (
    adj?.tipo_mime?.startsWith("image/") ||
    adj?.mime_type?.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(adj?.nombre_original || adj?.filename || "")
  );
}

export function esPDFAdjunto(adj) {
  return (
    adj?.tipo_mime === "application/pdf" ||
    adj?.mime_type === "application/pdf" ||
    /\.pdf$/i.test(adj?.nombre_original || adj?.filename || "")
  );
}

export function esWordAdjunto(adj) {
  return (
    adj?.tipo_mime?.includes("word") ||
    adj?.mime_type?.includes("word") ||
    /\.(doc|docx)$/i.test(adj?.nombre_original || adj?.filename || "")
  );
}

async function fetchSignedUrlFromEndpoint(endpoint) {
  const res = await apiRequest(endpoint, "GET");
  const url = res?.url ?? res?.data?.url ?? res?.data?.download_url ?? res?.download_url;
  return typeof url === "string" && url.trim() ? resolveAttachmentPublicUrl(url.trim()) : null;
}

function buildDownloadEndpoints(adjunto, ctx = {}) {
  const id = adjunto?.id;
  if (!id) return [];

  const endpoints = [];

  // Auditoría: endpoint dedicado (NO bitácora operativa)
  endpoints.push(`auditorias/adjuntos/${id}/descargar`);

  if (ctx.auditOnly) return endpoints;

  endpoints.push(`adjuntos/bitacora/${id}/descargar`);

  if (ctx.commentId) {
    endpoints.push(`auditorias/comentarios/${ctx.commentId}/adjuntos/${id}/descargar`);
  }
  if (ctx.taskId && ctx.commentId) {
    endpoints.push(
      `auditorias/tasks/${ctx.taskId}/comments/${ctx.commentId}/adjuntos/${id}/descargar`
    );
  }

  return endpoints;
}

/**
 * URL para mostrar adjunto en <img> / iframe.
 * Prioriza GET adjuntos/bitacora/{id}/descargar (igual que TareasPendientesPanel).
 */
export async function resolveAdjuntoViewUrl(adjunto, ctx = {}) {
  if (!adjunto) return null;

  const direct = resolveAttachmentPublicUrl(adjunto.url);
  const needsSignedUrl = !direct || isPrivateS3Url(direct);

  if (needsSignedUrl && adjunto.id) {
    for (const endpoint of buildDownloadEndpoints(adjunto, ctx)) {
      try {
        const signed = await fetchSignedUrlFromEndpoint(endpoint);
        if (signed) return signed;
      } catch {
        // siguiente endpoint
      }
    }
  }

  return direct || null;
}

export function revokeAdjuntoViewUrl(url) {
  if (url && typeof url === "string" && url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // no-op
    }
  }
}

export function revokeAdjuntoViewUrlMap(urlMap) {
  if (!urlMap || typeof urlMap !== "object") return;
  Object.values(urlMap).forEach((url) => revokeAdjuntoViewUrl(url));
}

/**
 * Descarga de adjunto — mismo flujo que TareasPendientesPanel.descargarArchivo
 */
export async function descargarArchivoAdjunto(adjunto, ctx = {}) {
  if (!adjunto) return;

  try {
    if (adjunto.id) {
      for (const endpoint of buildDownloadEndpoints(adjunto, ctx)) {
        try {
          const res = await apiRequest(endpoint, "GET");
          const signed = res?.url ?? res?.data?.url;
          if (signed) {
            const link = document.createElement("a");
            link.href = resolveAttachmentPublicUrl(signed);
            link.download = adjunto.nombre_original || adjunto.filename || "archivo";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
          }
        } catch {
          // siguiente endpoint
        }
      }
    }

    const response = await fetch(resolveAttachmentPublicUrl(adjunto.url));
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = adjunto.nombre_original || adjunto.filename || "archivo";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error al descargar archivo:", error);
    if (adjunto.url) {
      window.open(resolveAttachmentPublicUrl(adjunto.url), "_blank", "noopener,noreferrer");
    }
  }
}

/** @deprecated Usar descargarArchivoAdjunto */
export const downloadAdjunto = descargarArchivoAdjunto;
