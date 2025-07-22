import React from "react";
import { generarPDFAutorizacion } from "../../services/formatoAutorizacion";

const CartaAutorizacion = ({ cliente }) => {
  if (!cliente) return null;

  return (
    <div className="mt-3">
      <button
        className="btn btn-outline-danger w-100"
        onClick={() => generarPDFAutorizacion(cliente)}
      >
        <i className="bi bi-file-earmark-pdf me-2"></i>
        Descargar PDF
      </button>
    </div>
  );
};

export default CartaAutorizacion;
