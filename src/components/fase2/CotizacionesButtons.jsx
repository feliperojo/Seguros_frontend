// CotizacionesButtons.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import CoberturaEstadoGfBadges from "./CoberturaEstadoGfBadges";

/** CotizacionesButtons
 *  Muestra coberturas en estados de cotización y abre la ficha al hacer click.
 */
export default function CotizacionesButtons({
  className = "",
  coberturas = [],
  resolveCobertura,
  onSelectCobertura = () => {},
  prefetch = true,                              // 👈 GET antes de navegar (opcional)
  toFichaPath = (gfId) => `/grupo_familiar/${gfId}`, // 👈 ruta destino
}) {
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState(null);

  const ESTADOS_COTIZACION = [
    "Prospecto",
    "Cotización",
    "Seguimiento",
    "Toma de Datos",
    "Inscripción Inicial",
  ];

  const Btn = ({ title, subtitle, cobertura, gfId, onClick, loading }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="btn btn-light border w-100 text-dark py-2 rounded-1 shadow-sm d-flex align-items-center justify-content-between text-start"
      style={{ fontSize: "0.9rem", backgroundColor: "#f8f9fa" }}
    >
      <span className="flex-grow-1 pe-3">
        <div className="fw-semibold text-truncate">{title}</div>
        {subtitle ? (
          <div className="small text-muted text-truncate">{subtitle}</div>
        ) : null}
      </span>
      <CoberturaEstadoGfBadges cobertura={cobertura} gfId={gfId} loading={loading} />
    </button>
  );

  const filtradas = (coberturas || []).filter((c) => {
    const estado = c?.grupo_familiar?.estado_actual_catalogo?.estado_nombre;
    return estado && ESTADOS_COTIZACION.includes(estado);
  });

  const handleOpenFicha = async (c) => {
    onSelectCobertura?.(c); // conserva tu flujo actual
    const gfId = c?.grupo_familiar?.id ?? c?.grupo_familiar_id;
    if (!gfId) return;

    try {
      setLoadingId(gfId);
      if (prefetch) {
        await GrupoFamiliarService.getFullById(gfId); // idempotente
      }
    } catch (e) {
      console.warn("Prefetch GF falló:", e?.message || e);
    } finally {
      setLoadingId(null);
      navigate(toFichaPath(gfId)); // 👉 redirección
    }
  };

  return (
    <div className={`card ${className}`}>
      <div className="card-body">
        <h6 className="text-center fw-semibold mb-3">Cotizaciones</h6>
        {filtradas.length ? (
          <div className="row g-2">
            {filtradas.map((c) => {
              const estado = c?.grupo_familiar?.estado_actual_catalogo?.estado_nombre ?? "-";
              const gfId = c?.grupo_familiar?.id ?? c?.grupo_familiar_id ?? "-";
              const loading = loadingId === gfId;
              const coberturaEstado = resolveCobertura?.(c) ?? c;
              return (
                <div className="col-md-6" key={c.id}>
                  <Btn
                    title={estado}
                    subtitle={c.cobertura_tipo || ""}
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
            Sin coberturas en estados de cotización
          </div>
        )}
      </div>
    </div>
  );
}
