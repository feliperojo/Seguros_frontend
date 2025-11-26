// src/components/Historial/HistorialCambiosModal.jsx
import React, { useEffect, useState } from "react";
import apiRequest from "../../services/api";

// Nombres bonitos de campos
const FIELD_LABELS = {
  ingreso_familiar_anual: "Ingreso familiar anual",
  personas_cobertura: "Personas en cobertura",
  personas_taxes: "Personas en Taxes",
  zip_code: "ZIP Code",
  estado_cobertura: "Estado cobertura",
  elegibilidad: "Elegibilidad",
  grupo: "Grupo",
  plan: "Plan",
  metal: "Metal",
  red: "Red",
  coberturas: "Coberturas y miembros",
  codigo_poliza: "Código de póliza",
};

const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
};

const formatValue = (val) => {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return "[objeto]";
    }
  }
  return String(val);
};

// ---------- Helpers para COBERTURAS ----------

const normalizeCoberturas = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;

  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const buildCobKey = (cob, index) => {
  if (cob.id) return `id-${cob.id}`;
  if (cob.cliente_id) return `cli-${cob.cliente_id}-${cob.parentesco || ""}`;
  return `idx-${index}`;
};

// Campos internos que nos interesan comparar en cada cobertura
const COB_FIELDS = [
  "plan",
  "metal",
  "red",
  "grupo",
  "estado_cobertura",
  "cobertura_tipo",
  "codigo_poliza",
  "precio",
  "ano_cobertura",
  "fecha_activacion",
  "fecha_cancelacion",
  "fecha_retiro",
  "elegibilidad",
];

// Detecta cambios entre dos listas de coberturas (campo "coberturas" completo)
const computeCoberturasDiff = (anteriorVal, nuevoVal) => {
  const prevList = normalizeCoberturas(anteriorVal);
  const newList = normalizeCoberturas(nuevoVal);

  const prevMap = new Map();
  prevList.forEach((c, idx) => {
    prevMap.set(buildCobKey(c, idx), c);
  });

  const result = [];

  newList.forEach((cNuevo, idx) => {
    const key = buildCobKey(cNuevo, idx);
    const cPrev = prevMap.get(key) || null;

    const clientePrev = cPrev?.cliente || {};
    const clienteNuevo = cNuevo?.cliente || {};

    const nombrePrev =
      clientePrev.nombre_completo ||
      [clientePrev.primer_nombre, clientePrev.segundo_nombre, clientePrev.apellidos]
        .filter(Boolean)
        .join(" ");

    const nombreNuevo =
      clienteNuevo.nombre_completo ||
      [clienteNuevo.primer_nombre, clienteNuevo.segundo_nombre, clienteNuevo.apellidos]
        .filter(Boolean)
        .join(" ");

    const parentesco = cNuevo.parentesco || cPrev?.parentesco || "";

    const cambios = {};

    // Cambio en nombre del cliente
    if (JSON.stringify(nombrePrev || "") !== JSON.stringify(nombreNuevo || "")) {
      cambios.nombre = {
        label: "Nombre",
        anterior: nombrePrev || "—",
        nuevo: nombreNuevo || "—",
      };
    }

    // Cambio en compañía (por nombre)
    const compPrevNombre = cPrev?.compania?.nombre || "";
    const compNuevaNombre = cNuevo?.compania?.nombre || "";
    if (JSON.stringify(compPrevNombre) !== JSON.stringify(compNuevaNombre)) {
      cambios.compania = {
        label: "Compañía",
        anterior: compPrevNombre || "—",
        nuevo: compNuevaNombre || "—",
      };
    }

    // Otros campos planos de la cobertura
    COB_FIELDS.forEach((field) => {
      const vPrev = cPrev ? cPrev[field] : undefined;
      const vNuevo = cNuevo[field];

      if (JSON.stringify(vPrev) !== JSON.stringify(vNuevo)) {
        cambios[field] = {
          label: FIELD_LABELS[field] || field,
          anterior: vPrev ?? "—",
          nuevo: vNuevo ?? "—",
        };
      }
    });

    // Si no hay cambios en esta cobertura, no la mostramos
    if (Object.keys(cambios).length === 0) return;

    result.push({
      key,
      parentesco,
      nombreNuevo: nombreNuevo || nombrePrev || "Sin nombre",
      cambios,
    });
  });

  return result;
};

const renderCoberturasDiffCell = (anteriorVal, nuevoVal) => {
  const diff = computeCoberturasDiff(anteriorVal, nuevoVal);
  if (!diff.length) return <span className="text-muted">—</span>;

  return (
    <ul className="list-unstyled mb-0 small">
      {diff.map((item) => (
        <li key={item.key} className="mb-2">
          {item.parentesco && (
            <span className="text-muted">{item.parentesco}: </span>
          )}
          <strong>{item.nombreNuevo}</strong>
          <ul className="list-unstyled mb-0 ms-3">
            {Object.values(item.cambios).map((c) => (
              <li key={c.label}>
                {c.label}:{" "}
                <span className="text-danger">{formatValue(c.anterior)}</span>{" "}
                → <span className="text-success">{formatValue(c.nuevo)}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
};

// ---------- Componente principal ----------

export default function HistorialCambiosModal({
  show,
  onClose,
  modelo = "GrupoFamiliar",
  modeloId,
}) {
  const [historial, setHistorial] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Modo de vista (solo tiene sentido para GrupoFamiliar)
  const [viewMode, setViewMode] = useState("grupo"); // "grupo" | "clientes"

  const isGrupo = modelo === "GrupoFamiliar";


  // Cargar historial cuando se abre el modal
  useEffect(() => {
    if (!show || !modeloId) return;

    const fetchHistorial = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await apiRequest(`/historial/${modelo}/${modeloId}`, "GET");
        const rows = Array.isArray(res.data) ? res.data : [];
        setHistorial(rows);
        setSelected(rows.length > 0 ? rows[0] : null);
      } catch (e) {
        console.error("Error cargando historial:", e);
        setError("No se pudo cargar el historial de cambios.");
        setSelected(null);
      } finally {
        setLoading(false);
      }
    };

    fetchHistorial();
  }, [show, modelo, modeloId]);

  if (!show) return null;

  const renderDetalleCambios = () => {
    if (!selected) {
      return (
        <div className="text-muted">
          Selecciona un registro del historial para ver los detalles.
        </div>
      );
    }

    const cambios = selected.cambios || {};
    const keys = Object.keys(cambios);

    if (keys.length === 0) {
      return (
        <div className="text-muted">
          Esta versión no tiene cambios detectados en los campos monitoreados.
        </div>
      );
    }

    // Cabecera común (fecha, usuario, acción)
    const header = (
      <div className="mb-2 small text-muted">
        <strong>Fecha:</strong> {formatDateTime(selected.created_at)}
        <br />
        <strong>Usuario:</strong> {selected.usuario}
        <br />
        <strong>Acción:</strong>{" "}
        <span className="badge bg-secondary">{selected.accion}</span>
        {selected.total_cambios !== undefined && (
          <>
            <br />
            <strong>Total cambios:</strong> {selected.total_cambios}
          </>
        )}
      </div>
    );

    // ==========================
    // CASO 1: Modelo NO GrupoFamiliar
    // ==========================
    if (!isGrupo) {
      // Historial de Cliente (u otros modelos planos)
      return (
        <>
          <div className="mb-2 small text-muted">
            <strong>Fecha:</strong> {formatDateTime(selected.created_at)}<br />
            <strong>Usuario:</strong> {selected.usuario}<br />
            <strong>Acción:</strong>{" "}
            <span className="badge bg-secondary">{selected.accion}</span><br />
            <strong>Total cambios:</strong> {Object.keys(cambios).length}
          </div>
    
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Anterior</th>
                  <th>Nuevo</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(cambios).map((campo) => {
                  const info = cambios[campo];
                  const label = FIELD_LABELS[campo] || campo;
                  return (
                    <tr key={campo}>
                      <td>{label}</td>
                      <td>{formatValue(info.anterior)}</td>
                      <td>{formatValue(info.nuevo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      );
    }
    
    // ==========================
    // CASO 2: GrupoFamiliar (lógica especial coberturas + toggle)
    // ==========================

    // Agrupar campos tipo "cobertura_63.plan"
    const coverageGroups = {};
    const normalFields = [];

    keys.forEach((campo) => {
      const match = campo.match(/^cobertura_(\d+)\.(.+)$/);
      if (match) {
        const [, coberturaId, fieldKey] = match;
        if (!coverageGroups[coberturaId]) coverageGroups[coberturaId] = [];
        coverageGroups[coberturaId].push({ campo, fieldKey });
      } else {
        normalFields.push(campo);
      }
    });

    const coberturaClientes = selected.cobertura_clientes || {};

    return (
      <>
        {header}

        {/* Toggle de vista solo para GrupoFamiliar */}
        <div className="mb-2">
          <div className="btn-group btn-group-sm" role="group">
            <button
              type="button"
              className={
                "btn btn-outline-secondary" +
                (viewMode === "grupo" ? " active" : "")
              }
              onClick={() => setViewMode("grupo")}
            >
              Grupo / Coberturas
            </button>
            <button
              type="button"
              className={
                "btn btn-outline-secondary" +
                (viewMode === "clientes" ? " active" : "")
              }
              onClick={() => setViewMode("clientes")}
            >
              Clientes
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Campo</th>
                <th>Anterior</th>
                <th>Nuevo</th>
              </tr>
            </thead>
            <tbody>
              {/* Campos "normales" (no por cobertura) */}
              {normalFields.map((campo) => {
                const info = cambios[campo] || {};
                const label = FIELD_LABELS[campo] || campo;

                const isClienteField = campo.startsWith("cliente.");

                // En modo GRUPO ocultamos campos de cliente
                if (viewMode === "grupo" && isClienteField) return null;

                // En modo CLIENTES solo queremos cliente.*
                if (viewMode === "clientes") {
                  if (!isClienteField) return null;

                  const same =
                    JSON.stringify(info.anterior) ===
                    JSON.stringify(info.nuevo);
                  if (same) return null;
                }

                if (campo === "coberturas") {
                  if (viewMode === "clientes") return null;
                  return (
                    <tr key={campo}>
                      <td>{label}</td>
                      <td colSpan={2}>
                        {renderCoberturasDiffCell(
                          info.anterior,
                          info.nuevo
                        )}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={campo}>
                    <td>{label}</td>
                    <td>{formatValue(info.anterior)}</td>
                    <td>{formatValue(info.nuevo)}</td>
                  </tr>
                );
              })}

              {/* Bloques agrupados por cobertura_XY.* */}
              {Object.keys(coverageGroups)
                .sort((a, b) => Number(a) - Number(b))
                .map((coberturaId) => {
                  const fieldsForCoverage = coverageGroups[coberturaId];

                  const hasClientFields = fieldsForCoverage.some((f) =>
                    f.fieldKey.startsWith("cliente.")
                  );
                  const hasNonClientFields = fieldsForCoverage.some(
                    (f) => !f.fieldKey.startsWith("cliente.")
                  );

                  if (viewMode === "grupo" && !hasNonClientFields) {
                    return null;
                  }
                  if (viewMode === "clientes" && !hasClientFields) {
                    return null;
                  }

                  let clienteNombre = "";
                  const clienteField = fieldsForCoverage.find(
                    ({ fieldKey }) => fieldKey === "cliente.nombre_completo"
                  );

                  if (clienteField) {
                    const infoCliente =
                      cambios[clienteField.campo] || {};
                    clienteNombre =
                      infoCliente.nuevo || infoCliente.anterior || "";
                  }

                  const nombreHeader =
                    (coberturaClientes &&
                      coberturaClientes[coberturaId]) ||
                    clienteNombre ||
                    "";

                  return (
                    <React.Fragment key={`cov-${coberturaId}`}>
                      <tr className="table-light">
                        <td colSpan={3}>
                          <strong>
                            Cobertura #{coberturaId}
                            {nombreHeader ? ` – ${nombreHeader}` : ""}
                          </strong>
                        </td>
                      </tr>

                      {fieldsForCoverage.map(({ campo, fieldKey }) => {
                        const isClienteField =
                          fieldKey.startsWith("cliente.");

                        if (viewMode === "grupo" && isClienteField) {
                          return null;
                        }
                        if (viewMode === "clientes") {
                          if (!isClienteField) return null;

                          const infoTmp = cambios[campo] || {};
                          const same =
                            JSON.stringify(infoTmp.anterior) ===
                            JSON.stringify(infoTmp.nuevo);
                          if (same) return null;
                        }

                        if (
                          fieldKey === "cliente.nombre_completo" &&
                          nombreHeader
                        ) {
                          return null;
                        }

                        const info = cambios[campo] || {};
                        const niceLabel =
                          FIELD_LABELS[fieldKey] || fieldKey;

                        return (
                          <tr key={campo}>
                            <td>{niceLabel}</td>
                            <td>{formatValue(info.anterior)}</td>
                            <td>{formatValue(info.nuevo)}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <>
      {/* Modal principal */}
      <div
        className="modal fade show"
        tabIndex="-1"
        role="dialog"
        style={{ display: "block", zIndex: 1060 }}
      >
        <div
          className="modal-dialog modal-xl modal-dialog-centered"
          role="document"
          style={{
            maxWidth: "1200px",
            width: "95vw",
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Historial de cambios este</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>

            <div className="modal-body">
              {loading && (
                <div className="d-flex justify-content-center py-4">
                  <div className="spinner-border" role="status">
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="alert alert-danger">{error}</div>
              )}

              {!loading && !error && historial.length === 0 && (
                <div className="text-muted text-center py-3">
                  No hay cambios registrados para este grupo familiar.
                </div>
              )}

              {!loading && !error && historial.length > 0 && (
                <div className="row">
                  {/* Lista de versiones */}
                  <div className="col-12 col-xl-5 mb-3">
                    <table className="table table-sm table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Fecha</th>
                          <th>Usuario</th>
                          <th>Acción</th>
                          <th>Cambios</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historial.map((row) => {
                          const totalCambios =
                            row.total_cambios ??
                            Object.keys(row.cambios || {}).length;
                          const isActive =
                            selected && selected.id === row.id;

                          return (
                            <tr
                              key={row.id}
                              className={
                                isActive ? "table-primary" : ""
                              }
                              style={{ cursor: "pointer" }}
                              onClick={() => setSelected(row)}
                            >
                              <td>{formatDateTime(row.created_at)}</td>
                              <td>{row.usuario}</td>
                              <td>
                                <span className="badge bg-secondary">
                                  {row.accion}
                                </span>
                              </td>
                              <td>
                                {totalCambios > 0
                                  ? `${totalCambios} cambio(s)`
                                  : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <small className="text-muted">
                      Haz clic en una fila para ver el detalle de los campos
                      modificados.
                    </small>
                  </div>

                  {/* Detalle de la versión seleccionada */}
                  <div className="col-12 col-xl-7">
                    {renderDetalleCambios()}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        style={{ cursor: "pointer", zIndex: 1050 }}
      />
    </>
  );
}
