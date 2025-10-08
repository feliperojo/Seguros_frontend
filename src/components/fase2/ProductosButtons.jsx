import React from "react";

/** ProductosButtons
 *  Solo muestra coberturas con estado "Grupo Familiar"
 */
export default function ProductosButtons({
  className = "",
  coberturas = [],
  onSelectCobertura = () => {},
}) {
  const Btn = ({ left, right, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-light border w-100 text-dark py-2 rounded-1 shadow-sm d-flex align-items-center justify-content-between"
      style={{ fontSize: "0.9rem", backgroundColor: "#f8f9fa" }}
    >
      <span className="fw-semibold text-start flex-grow-1 text-truncate pe-3">
        {left}
      </span>
      <span className="badge bg-white border text-secondary rounded-pill">GF {right}</span>
    </button>
  );

  const filtradas = (coberturas || []).filter(
    (c) => c?.grupo_familiar?.estado_actual_catalogo?.estado_nombre === "Grupo Familiar"
  );

  return (
    <div className={`card ${className}`}>
      <div className="card-body">
        <h6 className="text-center fw-semibold mb-3">Productos</h6>
        {filtradas.length ? (
          <div className="row g-2">
            {filtradas.map((c) => (
              <div className="col-md-12" key={c.id}>
                <Btn
                  left={c.cobertura_tipo || "Sin tipo"}
                  right={c.grupo_familiar?.id ?? c.grupo_familiar_id ?? "-"}
                  onClick={() => onSelectCobertura(c)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted small">Sin productos (Grupo Familiar)</div>
        )}
      </div>
    </div>
  );
}
