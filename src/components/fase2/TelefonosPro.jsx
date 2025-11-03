import React from "react";

/**
 * TelefonosPro
 * Shape esperado: [{ id?:string|number, tipo:string, numero:string, principal:boolean }]
 *
 * Props:
 * - value: array de teléfonos (default: [])
 * - onChange: (arr) => void
 * - readOnly: boolean
 * - types: lista de tipos disponibles
 * - max: máximo de teléfonos permitidos (null = sin límite)
 */
export default function TelefonosPro({
  value = [],
  onChange = () => {},
  readOnly = false,
  types = ["Móvil", "Trabajo", "Casa", "Whatsapp", "Emergencia", "Otro"],
  max = null,
  className = ""
}) {
  const phones = Array.isArray(value) ? value : [];

  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const emit = (next) => {
    // Garantiza que haya como máximo un principal
    const hasPrincipal = next.some((p) => !!p.principal);
    const normalized = next.map((p, i) => ({
      id: p.id ?? `${i}-${p.tipo ?? ""}-${p.numero ?? ""}`,
      tipo: (p.tipo || "").trim() || "Móvil",
      numero: (p.numero || "").trim(),
      principal: !!p.principal
    }));
    // Si hay varios marcados por error, deja sólo el primero
    if (hasPrincipal) {
      let seen = false;
      for (const p of normalized) {
        if (p.principal) {
          if (!seen) seen = true;
          else p.principal = false;
        }
      }
    }
    onChange(normalized);
  };

  const addPhone = () => {
    if (readOnly) return;
    if (max && phones.length >= max) return;
    const newItem = {
      id: uid(),
      tipo: "Móvil",
      numero: "",
      principal: phones.length === 0 // el primero por defecto principal
    };
    emit([...(phones || []), newItem]);
  };

  const removePhone = (idx) => {
    if (readOnly) return;
    const next = phones.filter((_, i) => i !== idx);
    // si quitaste el principal, deja el primero como principal
    if (!next.some((p) => p.principal) && next.length > 0) next[0].principal = true;
    emit(next);
  };

  const updateAt = (idx, patch) => {
    if (readOnly) return;
    const next = phones.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    emit(next);
  };

  const togglePrincipal = (idx) => {
    if (readOnly) return;
    const next = phones.map((p, i) => ({ ...p, principal: i === idx }));
    emit(next);
  };

  return (
    <div className={className}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <label className="form-label mb-0">Teléfonos</label>
        {!readOnly && (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={addPhone}>
            + Agregar
          </button>
        )}
      </div>

      {phones.length === 0 ? (
        <div className="text-muted small">Sin teléfonos.</div>
      ) : (
        <div className="vstack gap-3">
          {phones.map((p, idx) => (
            <div key={p.id ?? idx} className="border rounded p-3">
              <div className="row g-3 align-items-center">
                <div className="col-12 col-md-3">
                  <label className="form-label small mb-1">Tipo</label>
                  <select
                    className="form-select form-select-sm"
                    value={p.tipo || ""}
                    onChange={(e) => updateAt(idx, { tipo: e.target.value })}
                    disabled={readOnly}
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small mb-1">Número</label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="+1 305..."
                    value={p.numero || ""}
                    onChange={(e) => updateAt(idx, { numero: e.target.value })}
                    disabled={readOnly}
                  />
                </div>

                <div className="col-8 col-md-2">
                  <div className="form-check mt-4">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`principal-${idx}`}
                      checked={!!p.principal}
                      onChange={() => togglePrincipal(idx)}
                      disabled={readOnly}
                    />
                    <label className="form-check-label" htmlFor={`principal-${idx}`}>
                      Principal
                    </label>
                  </div>
                </div>

                <div className="col-4 col-md-1 d-flex justify-content-end mt-4">
                  {!readOnly && (
                    <button
                      type="button"
                      className="btn btn-link text-danger p-0"
                      onClick={() => removePhone(idx)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= Helpers opcionales (migración) ================= */

/**
 * Convierte campos “legado” a arreglo estructurado.
 * legacy = { telefono, secundario, whatsapp_num }
 */
export function toStructuredPhones(legacy = {}) {
  const out = [];
  if (legacy.telefono) out.push({ id: "legacy-1", tipo: "Móvil", numero: String(legacy.telefono), principal: true });
  if (legacy.secundario) out.push({ id: "legacy-2", tipo: "Trabajo", numero: String(legacy.secundario), principal: !out.length });
  if (legacy.whatsapp_num) out.push({ id: "legacy-3", tipo: "Whatsapp", numero: String(legacy.whatsapp_num), principal: !out.length });
  // asegura un solo principal
  if (out.filter((p) => p.principal).length > 1) {
    let seen = false;
    out.forEach((p) => {
      if (p.principal) {
        if (!seen) seen = true;
        else p.principal = false;
      }
    });
  }
  return out;
}

/**
 * Extrae valores simples desde el arreglo estructurado (si necesitas mantener compatibilidad).
 * Retorna: { telefono, secundario, whatsapp_num, principal }
 */
export function toLegacyFields(phones = []) {
  const principal = phones.find((p) => p.principal)?.numero || "";
  const movil = phones.find((p) => (p.tipo || "").toLowerCase().includes("móvil"))?.numero || "";
  const trabajo = phones.find((p) => (p.tipo || "").toLowerCase().includes("trabajo"))?.numero || "";
  const whatsapp = phones.find((p) => (p.tipo || "").toLowerCase().includes("whatsapp"))?.numero || "";
  return {
    telefono: movil || principal || "",
    secundario: trabajo || "",
    whatsapp_num: whatsapp || "",
    principal
  };
}
