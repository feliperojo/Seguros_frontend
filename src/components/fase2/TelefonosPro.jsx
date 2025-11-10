import React from "react";
import countryCodes from "../../services/countryCodes";

/**
 * TelefonosPro – responsive, profesional y retro-compatible
 */

const flagEmoji = (iso = "") => {
  const cc = (iso || "").toUpperCase();
  if (cc.length !== 2) return "🏳️";
  const base = 127397;
  return String.fromCodePoint(...[...cc].map((c) => base + c.charCodeAt(0)));
};

function CountryFlagSelect({ valueIso, onChange, disabled, uiPreset = "default" }) {
  return (
    <select
      className="form-select form-select-sm country-select"
      value={valueIso || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label="Seleccionar país del número telefónico"
      title="Seleccionar país"
    >
      <option value="">{uiPreset === "default" ? "—" : "— Seleccione país —"}</option>
      {countryCodes.map(({ iso, country, code }) => (
        <option key={iso} value={iso}>
          {flagEmoji(iso)}{" "}
          {uiPreset === "default" ? `+${String(code)} (${country})` : country}
        </option>
      ))}
    </select>
  );
}

export default function TelefonosPro({
  value = [],
  onChange = () => {},
  readOnly = false,
  types = ["Móvil", "Trabajo", "Casa", "Whatsapp", "Emergencia", "Otro"],
  max = null,
  className = "",
  uiPreset = "default",
  variant = "inline",
}) {
  const phones = Array.isArray(value) ? value : [];
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const effectivePreset = uiPreset === "auto" ? "clean" : uiPreset;

  const emit = (next) => {
    const normalized = next.map((p, i) => ({
      ...p,
      id: p.id ?? `${i}-${p.tipo ?? ""}-${p.numero ?? ""}`,
      tipo: (p.tipo || "Móvil").trim(),
      numero: (p.numero || "").trim(),
      principal: !!p.principal,
      iso: (p.iso || "").toLowerCase() || undefined,
      indicativo: (p.indicativo || "").replace(/\D+/g, ""),
    }));
    let seen = false;
    for (const p of normalized) {
      if (p.principal) {
        if (!seen) seen = true; else p.principal = false;
      }
    }
    onChange(normalized);
  };

  const DEFAULT_ISO = "co";
  const findCountry = (iso) => countryCodes.find((c) => c.iso === iso);

  const addPhone = () => {
    if (readOnly) return;
    if (max && phones.length >= max) return;
    const def = findCountry(DEFAULT_ISO);
    emit([
      ...(phones || []),
      {
        id: uid(),
        tipo: "Móvil",
        numero: "",
        principal: phones.length === 0,
        iso: def?.iso || "",
        indicativo: def ? String(def.code).replace(/\D+/g, "") : "",
      },
    ]);
  };

  const removePhone = (idx) => {
    if (readOnly) return;
    const next = phones.filter((_, i) => i !== idx);
    if (!next.some((p) => p.principal) && next.length > 0) next[0].principal = true;
    emit(next);
  };

  const updateAt = (idx, patch) => {
    if (readOnly) return;
    emit(phones.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const togglePrincipal = (idx) => {
    if (readOnly) return;
    emit(phones.map((p, i) => ({ ...p, principal: i === idx })));
  };

  return (
    <div className={className}>
      {/* ---- estilos locales sutiles ---- */}
      <style>{`
        .phone-card {
          border: 1px solid var(--bs-border-color);
          border-radius: .75rem;
          background: var(--bs-body-bg);
          transition: box-shadow .15s ease-in-out, border-color .15s;
        }
        .phone-card:hover { box-shadow: 0 .25rem .75rem rgba(0,0,0,.05); }

        .country-select { width: 100%; }

        .input-group-sm .input-group-text { 
          min-width: 3.25rem;
          font-size: 0.875rem;
        }

        .actions-slot { min-height: 2rem; }

        /* Toolbar de acciones (Principal + Eliminar) */
        .actions-top {
          display: flex;
          align-items: center;
          gap: .5rem;
          min-height: 28px;
          flex-wrap: wrap;
        }
        .actions-top .form-check {
          margin: 0;
          display: flex;
          align-items: center;
          gap: .375rem;
        }
        .icon-btn-28 {
          width: 28px; height: 28px;
          display: inline-flex;
          align-items: center; justify-content: center;
          padding: 0;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .btn-del {
          --bs-btn-border-radius: .5rem;
        }
        .form-label { 
          font-weight: 500;
          margin-bottom: 0.25rem;
        }

        /* Ajustes para espacios reducidos */
        @media (max-width: 991.98px) {
          .phone-card { padding: 0.75rem !important; }
        }
      `}</style>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <label className="form-label mb-0">Teléfonos</label>
        {!readOnly && (
          <button type="button" className="btn btn-sm btn-primary" onClick={addPhone}>
            + Agregar
          </button>
        )}
      </div>

      {phones.length === 0 ? (
        <div className="text-muted small">Sin teléfonos.</div>
      ) : (
        <div className="vstack gap-3">
          {phones.map((p, idx) => (
            <div key={p.id ?? idx} className="phone-card p-3">
              {variant === "stacked" ? (
                /* ===== Stacked ===== */
                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <label className="form-label small mb-1">Tipo</label>
                    <select
                      className="form-select form-select-sm"
                      value={p.tipo || ""}
                      onChange={(e) => updateAt(idx, { tipo: e.target.value })}
                      disabled={readOnly}
                    >
                      {types.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-8">
                    <label className="form-label small mb-1">Número</label>
                    <div className="row g-2">
                      <div className="col-12 col-sm-6">
                        <CountryFlagSelect
                          valueIso={p.iso || ""}
                          onChange={(iso) => {
                            const found = findCountry(iso);
                            const indicativo = found ? String(found.code).replace(/\D+/g, "") : "";
                            updateAt(idx, { iso: (iso || "").toLowerCase(), indicativo });
                          }}
                          disabled={readOnly}
                          uiPreset={effectivePreset}
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">+{p.indicativo || ""}</span>
                          <input
                            className="form-control"
                            placeholder="333 333 444..."
                            inputMode="tel"
                            value={p.numero || ""}
                            onChange={(e) => updateAt(idx, { numero: e.target.value })}
                            disabled={readOnly}
                            maxLength={22}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="d-flex flex-wrap gap-3 justify-content-between justify-content-md-end align-items-center mt-2 actions-slot">
                      <div className="form-check m-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`principal-${idx}`}
                          checked={!!p.principal}
                          onChange={() => togglePrincipal(idx)}
                          disabled={readOnly}
                        />
                        <label className="form-check-label small" htmlFor={`principal-${idx}`}>
                          Principal
                        </label>
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm btn-del"
                          onClick={() => removePhone(idx)}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ===== Inline (alineación mejorada) ===== */
                
                <div className="row g-2">
                  <div className="actions-top mb-2">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`principal-${idx}`}
                          checked={!!p.principal}
                          onChange={() => togglePrincipal(idx)}
                          disabled={readOnly}
                        />
                        <label className="form-check-label small" htmlFor={`principal-${idx}`}>
                          Principal
                        </label>
                      </div>

                      {!readOnly && (
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm icon-btn-28"
                          onClick={() => removePhone(idx)}
                          title="Eliminar teléfono"
                        >
                          {/* SVG trash (sin dependencias) */}
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  {/* Columna izquierda: acciones + tipo */}
                  <div className="col-12 col-md-3">
                    {/* Barra de acciones alineada */}
                    

                    
                    <select
                      className="form-select form-select-sm"
                      value={p.tipo || ""}
                      onChange={(e) => updateAt(idx, { tipo: e.target.value })}
                      disabled={readOnly}
                    >
                      {types.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Columna derecha: número */}
                  <div className="col-12 col-md-9">
                    
                    <div className="d-flex gap-2 align-items-start">
                      <div style={{ minWidth: "160px", maxWidth: "200px" }}>
                        <CountryFlagSelect
                          valueIso={p.iso || ""}
                          onChange={(iso) => {
                            const found = findCountry(iso);
                            const indicativo = found ? String(found.code).replace(/\D+/g, "") : "";
                            updateAt(idx, { iso: (iso || "").toLowerCase(), indicativo });
                          }}
                          disabled={readOnly}
                          uiPreset={effectivePreset}
                        />
                      </div>
                      <div className="input-group input-group-sm flex-grow-1">
                        <span className="input-group-text">+{p.indicativo || ""}</span>
                        <input
                          className="form-control"
                          placeholder="333 333 444..."
                          inputMode="tel"
                          value={p.numero || ""}
                          onChange={(e) => updateAt(idx, { numero: e.target.value })}
                          disabled={readOnly}
                          maxLength={22}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
