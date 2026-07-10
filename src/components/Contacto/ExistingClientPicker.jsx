import React from "react";

export default function ExistingClientPicker({
  term,
  setTerm,
  candidatos = [],
  sel,
  setSel,
  loadingPicker = false,
  readOnly = false,
}) {
  return (
    <div className="col-12">
      <label className="form-label small mb-1">Buscar cliente existente</label>
      <input
        className="form-control form-control-sm"
        placeholder="Escribe al menos 2 letras…"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setSel(null);
        }}
        disabled={readOnly}
      />
      <div className="table-responsive border rounded mt-2" style={{ maxHeight: 220, overflow: "auto" }}>
        <table className="table table-sm align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Nombre</th>
              <th>Idioma</th>
              <th>Teléfono</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {loadingPicker ? (
              <tr>
                <td colSpan={4} className="text-center text-muted py-2">Buscando…</td>
              </tr>
            ) : candidatos.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-muted py-2">Sin resultados.</td>
              </tr>
            ) : (
              candidatos.map((c) => {
                const tel = c.telefono || (Array.isArray(c.telefonos) && c.telefonos[0]?.numero) || "—";
                const isSel = sel?.id === c.id;
                return (
                  <tr key={c.id} className={isSel ? "table-primary" : ""}>
                    <td className="fw-semibold">{c.nombre_completo}</td>
                    <td>{c.idioma || "—"}</td>
                    <td>{tel}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className={`btn btn-sm ${isSel ? "btn-secondary" : "btn-outline-primary"}`}
                        onClick={() => setSel(isSel ? null : c)}
                      >
                        {isSel ? "Quitar" : "Elegir"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {sel?.id && (
        <div className="form-text mt-1">
          Seleccionado: <strong>{sel.nombre_completo}</strong>
        </div>
      )}
    </div>
  );
}
