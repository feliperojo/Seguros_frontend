import React from "react";
import TablaConfiguracionPagos from "../components/TablaConfiguracionPagos";

const PagosGenerar = () => {
  return (
    <div className="container py-4">
      <div className="mb-4">
        <h2 className="text-primary">Generación de Pagos Mensuales</h2>
        <p className="text-muted">
          Consulta los parámetros de cobro configurados para las pólizas activas y genera automáticamente los registros de pago 
          del mes seleccionado según el día de cobro asignado a cada cliente.
        </p>
      </div>

      <TablaConfiguracionPagos />
    </div>
  );
};

export default PagosGenerar;
