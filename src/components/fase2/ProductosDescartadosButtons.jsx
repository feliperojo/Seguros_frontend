// ProductosDescartadosButtons.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import CoberturaEstadoGfBadges from "./CoberturaEstadoGfBadges";

const normalizarNombreEstado = (c) => {
  const raw = c?.grupo_familiar?.estado_actual_catalogo?.estado_nombre;
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
};

/** ProductosDescartadosButtons
 *  Misma UX que ProductosButtons: coberturas cuyo grupo está en estado Descartado.
 */
export default function ProductosDescartadosButtons({
  className = "",
  coberturas = [],
  resolveCobertura,
  onSelectCobertura = () => {},
  prefetch = true,
  toFichaPath = (gfId) => `/grupo_familiar/${gfId}`,
}) {
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState(null);

  const Btn = ({ left, cobertura, gfId, onClick, loading }) => (
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
      <CoberturaEstadoGfBadges cobertura={cobertura} gfId={gfId} loading={loading} />
    </button>
  );

  const filtradas = (coberturas || []).filter(
    (c) => normalizarNombreEstado(c) === "descartado"
  );

  const handleOpenFicha = async (c) => {
    onSelectCobertura?.(c);
    const gfId = c?.grupo_familiar?.id ?? c?.grupo_familiar_id;
    if (!gfId) return;

    try {
      setLoadingId(gfId);
      if (prefetch) {
        await GrupoFamiliarService.getFullById(gfId);
      }
    } catch (e) {
      console.warn("Prefetch GF falló:", e?.message || e);
    } finally {
      setLoadingId(null);
      navigate(toFichaPath(gfId));
    }
  };

  return (
    <div className={`card ${className}`}>
      <div className="card-body">
        <h6 className="text-center fw-semibold mb-3">Productos descartados</h6>
        {filtradas.length ? (
          <div className="row g-2">
            {filtradas.map((c) => {
              const gfId = c?.grupo_familiar?.id ?? c?.grupo_familiar_id ?? "-";
              const loading = loadingId === gfId;
              const coberturaEstado = resolveCobertura?.(c) ?? c;
              return (
                <div className="col-md-12" key={c.id}>
                  <Btn
                    left={c.cobertura_tipo || "Sin tipo"}
                    cobertura={coberturaEstado}
                    gfId={gfId}
                    loading={loading}
                    onClick={() => handleOpenFicha(c)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-muted small">
            Sin productos descartados
          </div>
        )}
      </div>
    </div>
  );
}
