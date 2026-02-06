import React, { useState } from "react";
import { generarPDFAutorizacion } from "../../services/formatoAutorizacion";
import DocumentoGeneradoModal from "../DocumentoGeneradoModal";

const CartaAutorizacion = ({ cliente }) => {
  const [showModal, setShowModal] = useState(false);
  const [pdfData, setPdfData] = useState(null);

  if (!cliente) return null;

  const handleGeneratePDF = async () => {
    try {
      // Generar PDF sin descargar
      const result = await generarPDFAutorizacion(cliente.id || cliente, false);
      if (result) {
        setPdfData(result);
        setShowModal(true);
      }
    } catch (error) {
      console.error("Error al generar PDF:", error);
      // Fallback: descargar directamente si falla
      await generarPDFAutorizacion(cliente.id || cliente, true);
    }
  };

  return (
    <>
      <div className="mt-3">
        <button
          className="btn btn-outline-danger w-100"
          onClick={handleGeneratePDF}
        >
          <i className="bi bi-file-earmark-pdf me-2"></i>
          Descargar PDF
        </button>
      </div>

      {pdfData && (
        <DocumentoGeneradoModal
          show={showModal}
          onHide={() => {
            setShowModal(false);
            setPdfData(null);
          }}
          pdfBlob={pdfData.blob}
          filename={pdfData.filename}
          documentType="AUTORIZACION"
          defaultSigner={{
            email: cliente.email || "",
            name: cliente.nombre_completo || "",
          }}
          metadata={{
            cliente_id: cliente.id || cliente,
          }}
        />
      )}
    </>
  );
};

export default CartaAutorizacion;
