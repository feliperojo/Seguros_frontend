import React from "react";


export default function TelefonosInput({ value = [], onChange, readOnly = false }) {
  const list = Array.isArray(value) ? value : [];

  const set = (arr) => onChange?.(arr);

  const add = () => set([...list, { tipo: "Móvil", numero: "", principal: list.length === 0 }]);

  const update = (i, k, v) => {
    const next = list.map((it, idx) => (idx === i ? { ...it, [k]: v } : it));
    // asegura único principal
    if (k === "principal" && v) {
      next.forEach((it, idx) => { if (idx !== i) it.principal = false; });
    }
    set(next);
  };

  const removeAt = (i) => set(list.filter((_, idx) => idx !== i));

  return (
    <div className="border rounded p-2">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <label className="form-label small m-0">Teléfonos</label>
        {!readOnly && (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={add}>
            + Agregar
          </button>
        )}
      </div>

      {list.length === 0 && <div className="text-muted small">Sin teléfonos.</div>}

      {list.map((t, i) => (
        <div key={i} className="row g-2 align-items-end mb-2">
          <div className="col-4">
            <label className="form-label small">Tipo</label>
            <select
              className="form-select form-select-sm"
              value={t.tipo || "Móvil"}
              onChange={(e) => update(i, "tipo", e.target.value)}
              disabled={readOnly}
            >
              <option>Móvil</option>
              <option>Casa</option>
              <option>Trabajo</option>
              <option>Otro</option>
            </select>
          </div>
          <div className="col-6">
            <label className="form-label small">Número</label>
            <input
              className="form-control form-control-sm"
              value={t.numero || ""}
              onChange={(e) => update(i, "numero", e.target.value)}
              disabled={readOnly}
              placeholder="+1 305..."
            />
          </div>
          <div className="col-2 d-flex align-items-center">
            <div className="form-check mt-4">
              <input
                className="form-check-input"
                type="checkbox"
                checked={!!t.principal}
                onChange={(e) => update(i, "principal", !!e.target.checked)}
                disabled={readOnly}
                id={`tel-principal-${i}`}
              />
              <label className="form-check-label small" htmlFor={`tel-principal-${i}`}>
                Principal
              </label>
            </div>
          </div>
          {!readOnly && (
            <div className="col-12">
              <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => removeAt(i)}>
                Eliminar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
