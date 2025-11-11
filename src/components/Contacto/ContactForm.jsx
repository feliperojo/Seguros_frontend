import React from "react";
import TelefonosPro from "../../components/fase2/TelefonosPro";
import LanguageSelect from "../selects/LanguageSelect";

export default function ContactForm({
  // modo y control
  modo,
  setModo,

  // form state
  form,
  update,

  // flags
  readOnly = false,
  saving = false,
  puedeGuardar = false,

  // acciones
  onSave,
  onReset,

  // búsqueda cliente existente
  term,
  setTerm,
  candidatos = [],
  sel,
  setSel,
  loadingPicker = false,

  // combos
  relacionOptions = [],
}) {
  return (
    <div className="row g-2">
      {/* Toggle modo */}
      <div className="col-12 mb-2">
        <div className="btn-group" role="group" aria-label="Modo de contacto">
          <input
            type="radio"
            className="btn-check"
            name="modoContacto"
            id="modoNuevo"
            autoComplete="off"
            checked={modo === "nuevo"}
            onChange={() => setModo("nuevo")}
            disabled={readOnly}
          />
        <label className="btn btn-outline-secondary btn-sm" htmlFor="modoNuevo">
            Cliente nuevo
          </label>

          <input
            type="radio"
            className="btn-check"
            name="modoContacto"
            id="modoExistente"
            autoComplete="off"
            checked={modo === "existente"}
            onChange={() => setModo("existente")}
            disabled={readOnly}
          />
          <label className="btn btn-outline-secondary btn-sm" htmlFor="modoExistente">
            Cliente existente
          </label>
        </div>
      </div>

      {/* Nombre o buscador, según el modo */}
      {modo === "nuevo" ? (
        <div className="col-12">
          <label className="form-label small mb-1">Nombre Completo</label>
          <input
            className="form-control form-control-sm"
            placeholder="Nombre Completo"
            value={form.nombre_completo}
            onChange={(e) => {
              const raw = e.target.value;
              const formatted = raw
                .toLowerCase()
                .replace(/\b\w/g, (ch) => ch.toUpperCase())
                .replace(/\s+/g, " ");
              update("nombre_completo", formatted);
            }}
            disabled={readOnly}
          />
        </div>
      ) : (
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
                  <tr><td colSpan={4} className="text-center text-muted py-2">Buscando…</td></tr>
                ) : candidatos.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-muted py-2">Sin resultados.</td></tr>
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
      )}

      {/* Teléfonos */}
      <div className="col-12">
        <TelefonosPro
          value={form.telefonos}
          onChange={(v) => update("telefonos", v)}
          readOnly={readOnly}
          uiPreset="clean"
          countrySelectWidth={200}
          formatByCountry={true}
        />
      </div>

      {/* Idioma usando tu LanguageSelect */}
      <div className="col-12 col-md-6">
        <label className="form-label small mb-1">Idioma</label>
        <LanguageSelect
          value={form.idioma}
          onChange={(e) => update("idioma", e.target.value)}
          disabled={readOnly}
          includeOther={true}
          includeEmpty={true}
          placeholder="Seleccione..."
          getValue={(l) => l.name}   // mantiene compatibilidad con tu backend
          getLabel={(l) => l.name}
        />
      </div>

      {/* Pertenece GF */}
      <div className="col-12 col-md-6">
        <label className="form-label small mb-1">¿Pertenece al Grupo Familiar?</label>
        <select
          className="form-select form-select-sm"
          value={form.perteneceGF}
          onChange={(e) => update("perteneceGF", e.target.value)}
          disabled={readOnly}
        >
          <option value="Si">Sí</option>
          <option value="No">No</option>
        </select>
      </div>

      {/* Relación */}
      <div className="col-12 col-md-6">
        <label className="form-label small mb-1">Relación</label>
        <select
          className="form-select form-select-sm"
          value={form.relacion}
          onChange={(e) => update("relacion", e.target.value)}
          disabled={readOnly}
        >
          <option value="">Seleccione...</option>
          {relacionOptions.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>

      {/* Nota */}
      <div className="col-12">
        <label className="form-label small mb-1">Nota</label>
        <textarea
          className="form-control form-control-sm"
          rows={3}
          placeholder="Ingrese sus notas aquí..."
          value={form.nota}
          onChange={(e) => update("nota", e.target.value)}
          disabled={readOnly}
        />
      </div>

      {/* Acciones */}
      {!readOnly && (
        <div className="col-12 d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-light btn-sm" onClick={onReset} disabled={saving}>
            Limpiar
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={!puedeGuardar || saving}>
            {saving ? "Guardando..." : "Guardar contacto"}
          </button>
        </div>
      )}
    </div>
  );
}
