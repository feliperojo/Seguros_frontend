import React from "react";

/**
 * CotizacionesButtons
 * - Renderiza 4 botones en grid 2x2 como en el mockup.
 */
export default function CotizacionesButtons({
  className = "",
  onCotizacionDental = () => {},
  onTomaDatos = () => {},
  onCotizacionVida = () => {},
  onSeguimiento = () => {},
}) {
  const Btn = ({ label, onClick }) => (
    <button
      type="button"
      className="btn btn-light border w-100 text-start btn-sm py-2 rounded-1"
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <div className={`card ${className}`}>
      <div className="card-body">
        <h6 className="text-center fw-semibold mb-3">Cotizaciones</h6>
        <div className="row g-2">
          <div className="col-md-6">
            <Btn label="Cotización Póliza Dental" onClick={onCotizacionDental} />
          </div>
          <div className="col-md-6">
            <Btn label="Toma de Datos" onClick={onTomaDatos} />
          </div>
          <div className="col-md-6">
            <Btn label="Cotización Póliza de Vida" onClick={onCotizacionVida} />
          </div>
          <div className="col-md-6">
            <Btn label="Seguimiento" onClick={onSeguimiento} />
          </div>
        </div>
      </div>
    </div>
  );
}
