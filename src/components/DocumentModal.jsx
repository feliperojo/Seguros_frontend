import React from "react";
import { Modal, Button } from "react-bootstrap";
import DocusealForm from "./DocusealForm";
import { downloadDocument } from "../services/documentsService";
import useToast from "../hooks/useToast";

/**
 * Modal para ver/firmar un documento DocuSeal.
 * - Si status === "pending": muestra formulario de firma con onComplete.
 * - Si status === "completed": muestra preview (solo lectura) y botón descargar.
 *
 * @param {boolean} show - Si el modal está visible
 * @param {Function} onHide - Cerrar modal
 * @param {Object} document - { id, template_name, status, embed_url|embed_src, ... }
 * @param {Function} onComplete - Callback al completar firma (refrescar lista, cerrar)
 */
const DocumentModal = ({ show, onHide, document: doc, onComplete }) => {
  const toast = useToast();
  const [downloading, setDownloading] = React.useState(false);

  const embedUrl = doc?.embed_url ?? doc?.embed_src ?? null;
  const isCompleted = doc?.status === "completed" || doc?.status === "completado";

  const handleDownload = async () => {
    if (!doc?.id) return;
    setDownloading(true);
    try {
      const { url } = await downloadDocument(doc.id);
      if (url) window.open(url, "_blank");
      else toast.showError("No se pudo obtener el enlace de descarga");
    } catch (err) {
      toast.showError(err?.message || "Error al descargar");
    } finally {
      setDownloading(false);
    }
  };

  const handleComplete = (data) => {
    if (typeof onComplete === "function") onComplete(data);
    onHide();
  };

  if (!show) return null;

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      className="document-modal"
      style={{ maxHeight: "calc(100vh - 2rem)" }}
    >
      <Modal.Header closeButton>
        <Modal.Title>
          {doc?.template_name || "Documento"} {isCompleted && "(Completado)"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0 d-flex flex-column overflow-hidden" style={{ minHeight: "400px" }}>
        {embedUrl ? (
          <DocusealForm
            src={embedUrl}
            preview={isCompleted}
            onComplete={handleComplete}
            className="flex-grow-1"
            style={{ minHeight: "500px" }}
          />
        ) : (
          <div className="p-5 text-center text-muted">
            No hay URL de visualización para este documento.
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {isCompleted && (
          <Button variant="primary" onClick={handleDownload} disabled={downloading}>
            {downloading ? "Descargando…" : "📥 Descargar"}
          </Button>
        )}
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DocumentModal;
