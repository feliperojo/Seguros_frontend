import React from "react";
import { DocusealForm as DocusealFormLib } from "@docuseal/react";

/**
 * CSS inyectado en el formulario DocuSeal para ocultar sus toasts/notificaciones.
 * DocuSeal aplica este CSS dentro del formulario (iframe/embed).
 */
const DOCUSEAL_HIDE_NOTIFICATIONS_CSS = `
  [role="alert"], [role="status"],
  .notification, .toast, .alert-success, .alert-info,
  [class*="notification"], [class*="toast"], [class*="alert"] {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
`;

/**
 * Formulario embebido de DocuSeal para firma electrónica.
 * Usa el componente oficial @docuseal/react.
 * Notificaciones nativas de DocuSeal se ocultan; usamos nuestro sistema (react-toastify) vía onComplete.
 *
 * @param {string} src - URL del formulario de firma (embed_src del backend)
 * @param {Function} onComplete - Callback al completar la firma; recibe (data). Usar para mostrar nuestro toast.
 * @param {boolean} preview - Si true, modo solo lectura (sin firma)
 * @param {Object} style - Estilos opcionales para el contenedor
 * @param {string} className - Clase CSS opcional para el contenedor
 */
const DocusealForm = ({ src, onComplete, preview = false, style = {}, className = "" }) => {
  if (!src) return null;

  if (import.meta.env?.DEV && typeof console?.log === "function") {
    console.log("DocuSeal Embed URL:", src);
  }

  return (
    <div
      className={`docuseal-form-container ${className}`.trim()}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "min(400px, 50vh)",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    >
      <DocusealFormLib
        src={src}
        preview={preview}
        completedMessage={{ title: "", body: "" }}
        customCss={DOCUSEAL_HIDE_NOTIFICATIONS_CSS}
        onComplete={(data) => {
          if (typeof onComplete === "function") onComplete(data);
        }}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "min(400px, 50vh)",
          border: "none",
          display: "block",
        }}
      />
    </div>
  );
};

export default DocusealForm;
