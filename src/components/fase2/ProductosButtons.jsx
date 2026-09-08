// ProductosButtons.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import CoberturaEstadoGfBadges from "./CoberturaEstadoGfBadges";
import {
  isDentalCoberturaTipo,
  isDentalMsCoberturaTipo,
  isProductoSaludMs,
} from "../../constants/coberturaTipos";

/** ProductosButtons
 *  Muestra coberturas con estado "Grupo Familiar" y abre la ficha al hacer click.
 *  Salud + Dental MS del mismo GF se consolidan en una sola fila (logo dental sin label).
 */
export default function ProductosButtons({
  className = "",
  coberturas = [],
  resolveCobertura,
  onSelectCobertura = () => {},
  prefetch = true,
  toFichaPath = (gfId) => `/grupo_familiar/${gfId}`,
}) {
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState(null);

  const Btn = ({
    icons = [],
    label,
    cobertura,
    gfId,
    estadoGrupo,
    onClick,
    loading,
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="btn btn-light border w-100 text-dark py-2 rounded-1 shadow-sm d-flex align-items-center justify-content-between"
      style={{ fontSize: "0.9rem", backgroundColor: "#f8f9fa" }}
    >
      <span className="fw-semibold text-start flex-grow-1 text-truncate pe-3 d-flex align-items-center gap-2">
        <span className="d-inline-flex align-items-center gap-1 flex-shrink-0">
          {icons.map(({ className: iconClass, title }) => (
            <i
              key={`${iconClass}-${title}`}
              className={iconClass}
              aria-hidden="true"
              title={title}
              style={{ color: "#1a365d", width: "1rem", textAlign: "center" }}
            />
          ))}
        </span>
        {label}
      </span>
      <CoberturaEstadoGfBadges
        cobertura={cobertura}
        gfId={gfId}
        loading={loading}
        estadoGrupoFamiliar={estadoGrupo}
      />
    </button>
  );

  const filtradas = useMemo(
    () =>
      (coberturas || []).filter(
        (c) =>
          c?.grupo_familiar?.estado_actual_catalogo?.estado_nombre ===
          "Grupo Familiar"
      ),
    [coberturas]
  );

  /** Una fila por GF para salud+dental; resto de productos en filas propias. */
  const filasProducto = useMemo(() => {
    const byGf = new Map();

    for (const c of filtradas) {
      const gfId = c?.grupo_familiar?.id ?? c?.grupo_familiar_id ?? null;
      const key = gfId != null ? String(gfId) : `cov-${c?.id}`;
      if (!byGf.has(key)) byGf.set(key, { gfId, items: [] });
      byGf.get(key).items.push(c);
    }

    const filas = [];

    for (const { gfId, items } of byGf.values()) {
      const salud = items.find((c) => isProductoSaludMs(c?.cobertura_tipo));
      const dental = items.find((c) => isDentalMsCoberturaTipo(c?.cobertura_tipo));
      const resto = items.filter(
        (c) => c !== salud && c !== dental
      );

      if (salud || dental) {
        const principal = salud ?? dental;
        const icons = [];
        if (salud) {
          icons.push({
            className: "fas fa-heartbeat",
            title: salud.cobertura_tipo || "Plan de salud",
          });
        }
        if (dental) {
          icons.push({ className: "fas fa-tooth", title: "Dental MS" });
        }

        filas.push({
          key: `gf-${gfId ?? principal?.id}-salud-dental`,
          gfId,
          principal,
          coberturaEstadoSource: salud ?? dental,
          estadoGrupo:
            principal?.grupo_familiar?.estado_actual_catalogo?.estado_nombre ??
            "Grupo Familiar",
          icons,
          label: salud
            ? salud.cobertura_tipo || "Plan de salud"
            : dental?.cobertura_tipo || "Dental MS",
        });
      }

      for (const c of resto) {
        const esDental = isDentalCoberturaTipo(c?.cobertura_tipo);
        filas.push({
          key: `gf-${gfId}-cov-${c.id}`,
          gfId,
          principal: c,
          coberturaEstadoSource: c,
          estadoGrupo:
            c?.grupo_familiar?.estado_actual_catalogo?.estado_nombre ??
            "Grupo Familiar",
          icons: [
            {
              className: esDental ? "fas fa-tooth" : "fas fa-heartbeat",
              title: c.cobertura_tipo || "Sin tipo",
            },
          ],
          label: c.cobertura_tipo || "Sin tipo",
        });
      }
    }

    return filas;
  }, [filtradas]);

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
        <h6 className="text-center fw-semibold mb-3">Productos</h6>
        {filasProducto.length ? (
          <div className="row g-2">
            {filasProducto.map((fila) => {
              const loading = fila.gfId != null && loadingId === fila.gfId;
              const coberturaEstado =
                resolveCobertura?.(fila.coberturaEstadoSource) ??
                fila.coberturaEstadoSource;
              return (
                <div className="col-md-12" key={fila.key}>
                  <Btn
                    icons={fila.icons}
                    label={fila.label}
                    cobertura={coberturaEstado}
                    gfId={fila.gfId ?? "-"}
                    estadoGrupo={fila.estadoGrupo}
                    loading={loading}
                    onClick={() => handleOpenFicha(fila.principal)}
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
