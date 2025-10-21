// ProductosButtons.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";

/** ProductosButtons
 *  Muestra coberturas con estado "Grupo Familiar" y abre la ficha al hacer click.
 */
export default function ProductosButtons({
  className = "",
  coberturas = [],
  onSelectCobertura = () => {},
  prefetch = true,                          // 👈 hace GET del grupo antes de navegar
  toFichaPath = (gfId) => `/grupo_familiar/${gfId}`, // 👈 ruta por defecto
}) {
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState(null);

  const Btn = ({ left, right, onClick, loading }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="btn btn-light border w-100 text-dark py-2 rounded-1 shadow-sm d-flex align-items-center justify-content-between"
      style={{ fontSize: "0.9rem", backgroundColor: "#f8f9fa" }}
    >
      <span className="fw-semibold text-start flex-grow-1 text-truncate pe-3">
        {left}
      </span>
      <span className="badge bg-white border text-secondary rounded-pill">
        {loading ? "…" : `GF ${right}`}
      </span>
    </button>
  );

  const filtradas = (coberturas || []).filter(
    (c) => c?.grupo_familiar?.estado_actual_catalogo?.estado_nombre === "Grupo Familiar"
  );

  const handleOpenFicha = async (c) => {
    onSelectCobertura?.(c); // conserva tu flujo actual
    const gfId = c?.grupo_familiar?.id ?? c?.grupo_familiar_id;
    if (!gfId) return;

    try {
      setLoadingId(gfId);
      if (prefetch) {
        // Idempotente: solo asegura que existe/carga; ignora el retorno
        await GrupoFamiliarService.getFullById(gfId);
      }
    } catch (e) {
      // si falla el prefetch igual navegamos; el componente de ficha se encargará
      console.warn("Prefetch GF falló:", e?.message || e);
    } finally {
      setLoadingId(null);
      navigate(toFichaPath(gfId)); // 👉 redirección a la ficha
    }
  };

  return (
    <div className={`card ${className}`}>
      <div className="card-body">
        <h6 className="text-center fw-semibold mb-3">Productos</h6>
        {filtradas.length ? (
          <div className="row g-2">
            {filtradas.map((c) => {
              const gfId = c?.grupo_familiar?.id ?? c?.grupo_familiar_id ?? "-";
              const loading = loadingId === gfId;
              return (
                <div className="col-md-12" key={c.id}>
                  <Btn
                    left={c.cobertura_tipo || "Sin tipo"}
                    right={gfId}
                    loading={loading}
                    onClick={() => handleOpenFicha(c)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-muted small">Sin productos (Grupo Familiar)</div>
        )}
      </div>
    </div>
  );
}
