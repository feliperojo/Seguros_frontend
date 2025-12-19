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
  // ===== helper para formatear número con distribución 3-3-4 =====
  const formatearNumeroTelefono = (numero) => {
    if (!numero) return "";
    // Remover todos los caracteres no numéricos
    const soloDigitos = numero.toString().replace(/\D/g, "");
    // Aplicar formato 3-3-4 si tiene 10 dígitos
    if (soloDigitos.length === 10) {
      return `${soloDigitos.slice(0, 3)}-${soloDigitos.slice(3, 6)}-${soloDigitos.slice(6)}`;
    }
    // Si no tiene 10 dígitos, devolver el número original
    return numero;
  };

  // ===== helper para normalizar telefonos desde la base de datos =====
  const normalizarTelefonos = (telefonos) => {
    if (Array.isArray(telefonos)) {
      return telefonos;
    }
    if (typeof telefonos === "string" && telefonos.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(telefonos);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }
    return [];
  };

  // ===== helper para formatear teléfono completo (indicativo + número) =====
  const formatearTelefonoCompleto = (cliente) => {
    // Normalizar telefonos: puede venir como array, string JSON, o null
    const telefonos = normalizarTelefonos(cliente?.telefonos);
    
    // Priorizar array de telefonos si existe
    if (telefonos.length > 0) {
      const tel = telefonos[0];
      const indicativo = tel?.indicativo ? `+${tel.indicativo} ` : "";
      const numeroFormateado = formatearNumeroTelefono(tel?.numero || "");
      return `${indicativo}${numeroFormateado}`.trim() || "—";
    }
    // Fallback al campo legacy
    if (cliente?.telefono) {
      return formatearNumeroTelefono(cliente.telefono);
    }
    return "—";
  };

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
        <>
          <div className="col-12 col-md-4">
            <label className="form-label small mb-1">
              Primer Nombre <span className="text-danger">*</span>
            </label>
            <input
              className="form-control form-control-sm"
              placeholder="Primer Nombre"
              value={form.primer_nombre || ""}
              onChange={(e) => {
                const raw = e.target.value;
                const formatted = raw
                  .toLowerCase()
                  .replace(/\b\w/g, (ch) => ch.toUpperCase())
                  .replace(/\s+/g, " ");
                update("primer_nombre", formatted);
              }}
              disabled={readOnly}
              required
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small mb-1">Segundo Nombre</label>
            <input
              className="form-control form-control-sm"
              placeholder="Segundo Nombre (opcional)"
              value={form.segundo_nombre || ""}
              onChange={(e) => {
                const raw = e.target.value;
                const formatted = raw
                  .toLowerCase()
                  .replace(/\b\w/g, (ch) => ch.toUpperCase())
                  .replace(/\s+/g, " ");
                update("segundo_nombre", formatted);
              }}
              disabled={readOnly}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small mb-1">
              Apellidos <span className="text-danger">*</span>
            </label>
            <input
              className="form-control form-control-sm"
              placeholder="Apellidos"
              value={form.apellidos || ""}
              onChange={(e) => {
                const raw = e.target.value;
                const formatted = raw
                  .toLowerCase()
                  .replace(/\b\w/g, (ch) => ch.toUpperCase())
                  .replace(/\s+/g, " ");
                update("apellidos", formatted);
              }}
              disabled={readOnly}
              required
            />
          </div>
        </>
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
                    const tel = formatearTelefonoCompleto(c);
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

      {/* Mensaje informativo para cliente existente */}
      {modo === "existente" && sel?.id && (
        <div className="col-12">
          <div className="alert alert-info alert-sm py-2 px-3 mb-2" role="alert">
            <small>
              <i className="bi bi-info-circle me-1"></i>
              <strong>Asociación de contacto:</strong> Solo se creará la relación con este cliente. 
              Los datos del cliente (teléfono, idioma) no serán modificados.
            </small>
          </div>
        </div>
      )}

      {/* Teléfonos */}
      <div className="col-12">
        <label className="form-label small mb-1">
          Teléfonos
          {modo === "existente" && sel?.id && (
            <span className="text-muted ms-1">(Información del cliente, no modificable)</span>
          )}
        </label>
        <TelefonosPro
          value={form.telefonos}
          onChange={(v) => update("telefonos", v)}
          readOnly={readOnly || (modo === "existente" && !!sel?.id)}
          uiPreset="clean"
          countrySelectWidth={200}
          formatByCountry={true}
        />
      </div>

      {/* Idioma usando tu LanguageSelect */}
      <div className="col-12 col-md-6">
        <label className="form-label small mb-1">
          Idioma
          {modo === "existente" && sel?.id && (
            <span className="text-muted ms-1">(Información del cliente, no modificable)</span>
          )}
        </label>
        <LanguageSelect
          value={form.idioma}
          onChange={(e) => update("idioma", e.target.value)}
          disabled={readOnly || (modo === "existente" && !!sel?.id)}
          includeOther={true}
          includeEmpty={true}
          placeholder="Seleccione..."
          getValue={(l) => l.name}   // mantiene compatibilidad con tu backend
          getLabel={(l) => l.name}
        />
      </div>

      {/* Relación - REQUERIDA para asociar contacto */}
      <div className="col-12 col-md-6">
        <label className="form-label small mb-1">
          Relación <span className="text-danger">*</span>
          {modo === "existente" && (
            <span className="text-muted ms-1">(de la asociación)</span>
          )}
        </label>
        <select
          className="form-select form-select-sm"
          value={form.relacion}
          onChange={(e) => update("relacion", e.target.value)}
          disabled={readOnly}
          required
        >
          <option value="">Seleccione...</option>
          {relacionOptions.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
        {modo === "existente" && !form.relacion && (
          <small className="text-muted">Campo requerido para asociar el contacto</small>
        )}
      </div>

      {/* Pertenece GF */}
      <div className="col-12 col-md-6">
        <label className="form-label small mb-1">
          ¿Pertenece al Grupo Familiar?
          {modo === "existente" && (
            <span className="text-muted ms-1">(de la asociación)</span>
          )}
        </label>
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
            {saving ? "Guardando..." : modo === "existente" ? "Asociar contacto" : "Guardar contacto"}
          </button>
        </div>
      )}
    </div>
  );
}
