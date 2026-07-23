// src/components/GrupoFamiliar/RenovacionCoberturasBorrador.jsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchCompanies } from "../../services/companies";

/**
 * Paso 2 del flujo de renovación:
 * - Edita los datos de la póliza NUEVA por cobertura (codigo_poliza obligatorio).
 * - Permite omitir miembros (renovar: false) con retiro si la cobertura está activa.
 */
const TIPO_PAGO_OPTIONS = [
  { value: "DEBITO AUTOMATICO", label: "DEBITO AUTOMATICO" },
  { value: "CTE PAGA", label: "CTE PAGA" },
  { value: "MES A MES", label: "MES A MES" },
];

const MOTIVOS_RETIRO_NO_RENOVACION = [
  "CAMBIO DE AGENTE",
  "MS CANCELO POR FALTA DE DOCUMENTOS",
  "TOMO MEDICAID",
  "TOMO MEDICARE (65 AÑOS)",
  "TOMO SEGURO POR EMPLEADOR/OTRO",
  "CLIENTE CANCELO POR PRECIO",
  "SE MUDO A OTRO ESTADO/PAIS",
  "YA NO NECESITA EL SEGURO",
  "SE CANCELO POR FALTA DE PAGO (MORA)",
  "NO REALIZO EL PAGO INICIAL",
  "TAXES POR SEPARADO",
  "OTRO",
];

const toDateInput = (value) => {
  if (!value) return "";
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
};

const nombreMiembro = (it) =>
  it.actual?.cliente_nombre || `Cobertura #${it.cobertura_id || "?"}`;

const RenovacionCoberturasBorrador = ({
  borrador,
  loadingConfirm,
  onBack,
  onClose,
  onConfirm,
  error,
}) => {
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchCompanies();
        if (mounted) setCompanies(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error al cargar compañías", err);
        if (mounted) setCompanies([]);
      } finally {
        if (mounted) setCompaniesLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (borrador?.items) {
      const mapped = borrador.items.map((item) => ({
        renovar: item?.borrador?.renovar ?? true,
        cobertura_id: item?.actual?.cobertura_id,
        fecha_retiro: "",
        motivo_retiro: "",
        borrador: {
          ...(item.borrador || {}),
          fecha_activacion: toDateInput(
            item?.borrador?.fecha_activacion || item?.borrador?.fecha_inicio
          ),
        },
        actual: item.actual || {},
      }));
      setItems(mapped);
      setAttemptedSubmit(false);
    } else {
      setItems([]);
    }
  }, [borrador]);

  const updateItem = (index, patch) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it))
    );
  };

  const updateBorradorField = (index, field, value) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              borrador: {
                ...(it.borrador || {}),
                [field]: value,
              },
            }
          : it
      )
    );
  };

  const requiereRetiro = (it) =>
    !it.renovar && Boolean(it.actual?.activo);

  const miembrosSinCodigo = useMemo(
    () =>
      items
        .filter(
          (it) =>
            it.renovar &&
            !String(it?.borrador?.codigo_poliza ?? "").trim()
        )
        .map(nombreMiembro),
    [items]
  );

  const miembrosSinRetiro = useMemo(
    () =>
      items
        .filter(
          (it) =>
            requiereRetiro(it) &&
            (!String(it.fecha_retiro ?? "").trim() ||
              !String(it.motivo_retiro ?? "").trim())
        )
        .map(nombreMiembro),
    [items]
  );

  const canConfirm =
    items.length > 0 &&
    miembrosSinCodigo.length === 0 &&
    miembrosSinRetiro.length === 0 &&
    !loadingConfirm;

  const handleSubmit = (e) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (
      !onConfirm ||
      miembrosSinCodigo.length > 0 ||
      miembrosSinRetiro.length > 0
    ) {
      return;
    }
    onConfirm(items);
  };

  if (!borrador) {
    return (
      <div className="modal-body">
        <div className="alert alert-warning mb-0">
          No se encontró información de pre-renovación.
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const { anio_origen, anio_destino } = borrador;
  const totalCoberturas = items.length;

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        <div className="mb-2">
          <strong>
            Renovación de coberturas del año {anio_origen} al año {anio_destino}
          </strong>
          <div className="text-muted small mt-1">
            Se encontraron <strong>{totalCoberturas}</strong> coberturas
            activas para este grupo familiar. Completa el número de póliza
            nuevo de cada miembro que renovarás.
          </div>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="alert alert-info">
          <p className="mb-1 fw-semibold">¿Qué hará este proceso?</p>
          <ul className="mb-0">
            <li>
              Se actualizará la póliza de cada miembro renovado con los datos
              del año <strong>{anio_destino}</strong> (nuevo número de póliza),
              conservando su historial de pagos y documentos. La póliza del
              año <strong>{anio_origen}</strong> quedará cerrada en el
              histórico del período.
            </li>
            <li>
              Los datos que completes aquí (compañía, plan, precio, etc.) se
              usarán para actualizar la cobertura al año{" "}
              <strong>{anio_destino}</strong>.
            </li>
            <li>
              Si desmarcas “Renovar a este miembro”, quedará omitido en el lote
              (resultado Omitida) y no se actualizará su póliza.
            </li>
          </ul>
        </div>

        {attemptedSubmit && miembrosSinCodigo.length > 0 && (
          <div className="alert alert-warning">
            Completa el <strong>número de póliza</strong> de:{" "}
            {miembrosSinCodigo.join(", ")}.
          </div>
        )}

        {attemptedSubmit && miembrosSinRetiro.length > 0 && (
          <div className="alert alert-warning">
            Completa la <strong>fecha</strong> y el <strong>motivo de
            retiro</strong> de: {miembrosSinRetiro.join(", ")}.
          </div>
        )}

        <div className="d-flex flex-column gap-3 mt-3">
          {items.map((item, index) => {
            const actual = item.actual || {};
            const b = item.borrador || {};
            const nombre = nombreMiembro(item);
            const codigoVacio =
              item.renovar && !String(b.codigo_poliza ?? "").trim();
            const showCodigoError = attemptedSubmit && codigoVacio;
            const mostrarRetiro = requiereRetiro(item);
            const retiroIncompleto =
              mostrarRetiro &&
              (!String(item.fecha_retiro ?? "").trim() ||
                !String(item.motivo_retiro ?? "").trim());
            const showRetiroError = attemptedSubmit && retiroIncompleto;

            return (
              <div key={item.cobertura_id || index} className="card shadow-sm">
                <div className="card-header bg-light">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                    <div>
                      <div className="fw-semibold">{nombre}</div>
                      <div className="small text-muted">
                        Póliza actual:{" "}
                        <strong>{actual.codigo_poliza || "—"}</strong>
                        {" · "}
                        Plan: <strong>{actual.plan || "—"}</strong>
                        {" · "}
                        Precio:{" "}
                        <strong>
                          {actual.precio != null && actual.precio !== ""
                            ? `$${actual.precio}`
                            : "—"}
                        </strong>
                      </div>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`renovar-${item.cobertura_id || index}`}
                        checked={Boolean(item.renovar)}
                        onChange={(e) =>
                          updateItem(index, { renovar: e.target.checked })
                        }
                        disabled={loadingConfirm}
                      />
                      <label
                        className="form-check-label"
                        htmlFor={`renovar-${item.cobertura_id || index}`}
                      >
                        Renovar a este miembro
                      </label>
                    </div>
                  </div>
                </div>

                {mostrarRetiro && (
                  <div className="card-body border-bottom">
                    <p className="small text-muted mb-3">
                      Este miembro no se renovará. Indica los datos del retiro
                      (cobertura vigente).
                    </p>
                    <div className="row g-2">
                      <div className="col-md-4">
                        <label className="form-label form-label-sm mb-1">
                          Fecha de retiro{" "}
                          <span className="text-danger">*</span>
                        </label>
                        <input
                          type="date"
                          className={`form-control form-control-sm${
                            showRetiroError &&
                            !String(item.fecha_retiro ?? "").trim()
                              ? " is-invalid border-danger"
                              : ""
                          }`}
                          value={toDateInput(item.fecha_retiro)}
                          onChange={(e) =>
                            updateItem(index, {
                              fecha_retiro: e.target.value,
                            })
                          }
                          disabled={loadingConfirm}
                        />
                      </div>
                      <div className="col-md-8">
                        <label className="form-label form-label-sm mb-1">
                          Motivo de retiro{" "}
                          <span className="text-danger">*</span>
                        </label>
                        <select
                          className={`form-select form-select-sm${
                            showRetiroError &&
                            !String(item.motivo_retiro ?? "").trim()
                              ? " is-invalid border-danger"
                              : ""
                          }`}
                          value={item.motivo_retiro || ""}
                          onChange={(e) =>
                            updateItem(index, {
                              motivo_retiro: e.target.value,
                            })
                          }
                          disabled={loadingConfirm}
                        >
                          <option value="">Seleccione…</option>
                          {MOTIVOS_RETIRO_NO_RENOVACION.map((motivo) => (
                            <option key={motivo} value={motivo}>
                              {motivo}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {showRetiroError && (
                      <div className="invalid-feedback d-block mt-1">
                        Fecha y motivo de retiro son obligatorios.
                      </div>
                    )}
                  </div>
                )}

                {item.renovar && (
                  <div className="card-body">
                    <p className="small text-muted mb-3">
                      Datos de la póliza del año {anio_destino}
                    </p>
                    <div className="row g-2">
                      <div className="col-md-4">
                        <label className="form-label form-label-sm mb-1">
                          Código de póliza <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className={`form-control form-control-sm${
                            showCodigoError ? " is-invalid border-danger" : ""
                          }`}
                          value={b.codigo_poliza ?? ""}
                          onChange={(e) =>
                            updateBorradorField(
                              index,
                              "codigo_poliza",
                              e.target.value
                            )
                          }
                          disabled={loadingConfirm}
                          required
                        />
                        {showCodigoError && (
                          <div className="invalid-feedback d-block">
                            Obligatoria para renovar.
                          </div>
                        )}
                      </div>

                      <div className="col-md-4">
                        <label className="form-label form-label-sm mb-1">
                          Compañía
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={b.compania_id ?? ""}
                          onChange={(e) =>
                            updateBorradorField(
                              index,
                              "compania_id",
                              e.target.value
                                ? Number(e.target.value)
                                : null
                            )
                          }
                          disabled={loadingConfirm || companiesLoading}
                        >
                          <option value="">
                            {companiesLoading
                              ? "Cargando…"
                              : "Seleccione…"}
                          </option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label form-label-sm mb-1">
                          Fecha de activación
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={toDateInput(b.fecha_activacion)}
                          onChange={(e) =>
                            updateBorradorField(
                              index,
                              "fecha_activacion",
                              e.target.value
                            )
                          }
                          disabled={loadingConfirm}
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label form-label-sm mb-1">
                          Plan
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={b.plan ?? ""}
                          onChange={(e) =>
                            updateBorradorField(index, "plan", e.target.value)
                          }
                          disabled={loadingConfirm}
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label form-label-sm mb-1">
                          Metal
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={b.metal ?? ""}
                          onChange={(e) =>
                            updateBorradorField(index, "metal", e.target.value)
                          }
                          disabled={loadingConfirm}
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label form-label-sm mb-1">
                          Red
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={b.red ?? ""}
                          onChange={(e) =>
                            updateBorradorField(index, "red", e.target.value)
                          }
                          disabled={loadingConfirm}
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label form-label-sm mb-1">
                          Elegibilidad
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={b.elegibilidad ?? ""}
                          onChange={(e) =>
                            updateBorradorField(
                              index,
                              "elegibilidad",
                              e.target.value
                            )
                          }
                          disabled={loadingConfirm}
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label form-label-sm mb-1">
                          Precio
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control form-control-sm"
                          value={b.precio ?? ""}
                          onChange={(e) =>
                            updateBorradorField(
                              index,
                              "precio",
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                          disabled={loadingConfirm}
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label form-label-sm mb-1">
                          Día de pago
                        </label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={b.dia_pago ?? ""}
                          onChange={(e) =>
                            updateBorradorField(
                              index,
                              "dia_pago",
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                          disabled={loadingConfirm}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label form-label-sm mb-1">
                          Tipo de pago
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={b.tipo_pago || ""}
                          onChange={(e) =>
                            updateBorradorField(
                              index,
                              "tipo_pago",
                              e.target.value || null
                            )
                          }
                          disabled={loadingConfirm}
                        >
                          <option value="">Seleccione…</option>
                          {TIPO_PAGO_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="alert alert-warning mt-3 mb-0">
            No hay coberturas activas candidatas a renovación.
          </div>
        )}

        <div className="alert alert-warning mt-3 small mb-0">
          <i className="bi bi-exclamation-triangle me-2" />
          Revisa que el año destino sea el correcto. Cada miembro renovado
          actualizará su misma cobertura (mismo historial) hacia {anio_destino}.
        </div>
      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onBack}
          disabled={loadingConfirm}
        >
          Volver
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          disabled={loadingConfirm}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!canConfirm}
          title={
            miembrosSinCodigo.length > 0
              ? `Falta código de póliza: ${miembrosSinCodigo.join(", ")}`
              : miembrosSinRetiro.length > 0
                ? `Falta fecha/motivo de retiro: ${miembrosSinRetiro.join(", ")}`
                : undefined
          }
        >
          {loadingConfirm ? "Procesando..." : "Confirmar renovación"}
        </button>
      </div>
    </form>
  );
};

export default RenovacionCoberturasBorrador;
