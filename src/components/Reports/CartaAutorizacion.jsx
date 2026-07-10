import React, { useState } from "react";
import { generarPDFAutorizacion } from "../../services/formatoAutorizacion";
import DocumentoGeneradoModal from "../DocumentoGeneradoModal";
import Swal from "sweetalert2";

const CartaAutorizacion = ({ cliente }) => {
  const [showModal, setShowModal] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [language, setLanguage] = useState("es");

  if (!cliente) return null;

  const handleGeneratePDF = async () => {
    try {
      const { value: selectedLanguage } = await Swal.fire({
        title: "Idioma del documento",
        text: "¿En qué idioma deseas enviar la autorización?",
        icon: "question",
        input: "select",
        inputOptions: {
          es: "Español",
          en: "Inglés",
        },
        inputPlaceholder: "Selecciona un idioma",
        showCancelButton: true,
        confirmButtonText: "Aceptar",
        cancelButtonText: "Cancelar",
      });

      if (!selectedLanguage) return;

      setLanguage(selectedLanguage);

      // Generar PDF sin descargar
      const result = await generarPDFAutorizacion(
        cliente.id || cliente,
        false,
        selectedLanguage
      );
      if (result) {
        setPdfData(result);
        setShowModal(true);
      }
    } catch (error) {
      console.error("Error al generar PDF:", error);
      // Fallback: descargar directamente si falla
      await generarPDFAutorizacion(cliente.id || cliente, true, language);
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
          documentLanguage={language}
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
