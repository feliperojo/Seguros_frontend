import React from "react";

/** CotizacionesButtons
 *  Muestra coberturas con estados de cotización (no "Grupo Familiar")
 */
export default function CotizacionesButtons({
  className = "",
  coberturas = [],
  onSelectCobertura = () => {},
}) {
  const ESTADOS_COTIZACION = [
    "Prospecto",
    "Cotización",
    "Seguimiento",
    "Toma de Datos",
    "Inscripción Inicial",
  ];

  const Btn = ({ title, subtitle, right, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-light border w-100 text-dark py-2 rounded-1 shadow-sm d-flex align-items-center justify-content-between text-start"
      style={{ fontSize: "0.9rem", backgroundColor: "#f8f9fa" }}
    >
      <span className="flex-grow-1 pe-3">
        <div className="fw-semibold text-truncate">{title}</div>
        {subtitle ? (
          <div className="small text-muted text-truncate">{subtitle}</div>
        ) : null}
      </span>
      <span className="badge bg-white border text-secondary rounded-pill">GF {right}</span>
    </button>
  );

  const filtradas = (coberturas || []).filter((c) => {
    const estado = c?.grupo_familiar?.estado_actual_catalogo?.estado_nombre;
    return estado && ESTADOS_COTIZACION.includes(estado);
  });

  return (
    <div className={`card ${className}`}>
      <div className="card-body">
        <h6 className="text-center fw-semibold mb-3">Cotizaciones</h6>
        {filtradas.length ? (
          <div className="row g-2">
            {filtradas.map((c) => {
              const estado = c?.grupo_familiar?.estado_actual_catalogo?.estado_nombre ?? "-";
              return (
                <div className="col-md-6" key={c.id}>
                  <Btn
                    title={estado}
                    subtitle={c.cobertura_tipo || ""}
                    right={c.grupo_familiar?.id ?? c.grupo_familiar_id ?? "-"}
                    onClick={() => onSelectCobertura(c)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-muted small">Sin coberturas en estados de cotización</div>
        )}
      </div>
    </div>
  );
}
