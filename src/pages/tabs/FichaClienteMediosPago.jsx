import React, { useMemo } from "react";
import { useFichaCliente } from "../../context/fichaClienteContext";
import MediosPagoSection from "../../components/MediosPagoSection";

const toValidId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function FichaClienteMediosPago() {
  const { cliente } = useFichaCliente();

  const clienteId = useMemo(() => toValidId(cliente?.id), [cliente?.id]);

  if (!clienteId) {
    return (
      <div className="alert alert-info mb-0">
        No se encontró un cliente válido para cargar los medios de pago.
      </div>
    );
  }

  return <MediosPagoSection clienteId={clienteId} isOpen={true} />;
}

