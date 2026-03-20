// src/components/coberturas/ReactivacionCoberturasModal.jsx
import React, { useState, useEffect, useRef } from "react";
import { Modal, Button, Form, Table, Alert, Spinner, Badge } from "react-bootstrap";
import apiRequest from "../../services/api";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";

/**
 * ReactivacionCoberturasModal
 * 
 * Modal para reactivar coberturas (retiradas y canceladas) de un grupo familiar.
 * 
 * Props:
 * - show (boolean): Controla la visibilidad del modal
 * - onClose (func): Se llama para cerrar el modal sin guardar
 * - onSuccess (func): Se llama cuando la operación se completa exitosamente
 * - grupoFamiliarId (number|string): ID del grupo familiar
 * 
 * El componente:
 * - Carga coberturas retiradas (y también canceladas) según su estado y fechas
 * - Permite seleccionar una o varias coberturas mediante checkboxes
 * - Valida que haya al menos una cobertura seleccionada
 * - Envía peticiones PUT a /api/cobertura/{id} para reactivar cada cobertura seleccionada
 * - Actualiza: activo: true, vigente: true, fecha_retiro: null, fecha_cancelacion: null, motivo_cancelacion: null, nota_cancel: null
 * - Muestra estados de loading, éxito y error
 */
const ReactivacionCoberturasModal = ({
  show,
  onClose,
  onSuccess,
  grupoFamiliarId,
}) => {
  const [coberturas, setCoberturas] = useState([]);
  const [coberturasSeleccionadas, setCoberturasSeleccionadas] = useState(new Set());
  // Nuevo flujo: permitir seleccionar/reactivar coberturas "Cancelada"
  // para no romper el comportamiento existente (por defecto solo "Retirada").
  const [reactivarCanceladas, setReactivarCanceladas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCoberturas, setLoadingCoberturas] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [validandoSeleccion, setValidandoSeleccion] = useState(false);
  // Cache simple para evitar repetir el endpoint por cliente/producto en cada click
  const conflictoCacheRef = useRef(new Map()); // Map<string, any|null>
  // Mensaje estético de validación al intentar seleccionar una cobertura
  const [seleccionError, setSeleccionError] = useState("");
  const seleccionErrorTimerRef = useRef(null);

  const isFechaValida = (v) => {
    if (v === null || v === undefined) return false;
    const s = String(v).trim();
    return s !== "" && s.toLowerCase() !== "null";
  };

  const esActivoFalse = (v) => v === false || v === "false" || v === 0 || v === "0";
  const esActivoTrue = (v) => v === true || v === "true" || v === 1 || v === "1";
  const esVigenteFalse = (v) => v === false || v === "false" || v === 0 || v === "0";

  // Nota: para evitar inconsistencias de datos, priorizamos por fechas:
  // - Cancelada: vigente === false y tiene fecha_cancelacion, pero NO tiene fecha_retiro
  // - Retirada: vigente === false y (activo === false o tiene fecha_retiro)
  const esCoberturaRetirada = (c = {}) =>
    esVigenteFalse(c.vigente) &&
    (esActivoFalse(c.activo) || isFechaValida(c.fecha_retiro));

  const esCoberturaCancelada = (c = {}) =>
    esVigenteFalse(c.vigente) &&
    isFechaValida(c.fecha_cancelacion) &&
    !isFechaValida(c.fecha_retiro);

  const getEstadoActualEtiqueta = (c = {}) => {
    if (esCoberturaCancelada(c)) return "Cancelada";
    if (esCoberturaRetirada(c)) return "Retirada";
    return "—";
  };

  // Cargar coberturas retiradas cuando se abre el modal
  useEffect(() => {
    if (show && grupoFamiliarId) {
      cargarCoberturas();
      resetFormulario();
    }
  }, [show, grupoFamiliarId]);

  const resetFormulario = () => {
    setCoberturasSeleccionadas(new Set());
    setError("");
    setSuccess(false);
    setReactivarCanceladas(false);
    conflictoCacheRef.current = new Map();
    setSeleccionError("");
    if (seleccionErrorTimerRef.current) {
      clearTimeout(seleccionErrorTimerRef.current);
      seleccionErrorTimerRef.current = null;
    }
  };

  const mostrarSeleccionError = (msg) => {
    setSeleccionError(msg);
    if (seleccionErrorTimerRef.current) clearTimeout(seleccionErrorTimerRef.current);
    seleccionErrorTimerRef.current = setTimeout(() => {
      setSeleccionError("");
      seleccionErrorTimerRef.current = null;
    }, 4500);
  };

  const cargarCoberturas = async () => {
    if (!grupoFamiliarId) return;

    setLoadingCoberturas(true);
    setError("");

    try {
      // Obtener el grupo familiar completo
      const grupoData = await GrupoFamiliarService.getFullById(grupoFamiliarId);
      
      const lista = grupoData?.coberturas || [];

      // Extraer coberturas retiradas (vigente === false y retiro)
      // Excluimos las que sean canceladas para evitar duplicados en la tabla.
      const coberturasRetiradas = lista.filter((c) => esCoberturaRetirada(c) && !esCoberturaCancelada(c));

      // Extraer coberturas canceladas (activo: true y vigente: false + fecha_cancelacion)
      const coberturasCanceladas = lista.filter((c) => esCoberturaCancelada(c));

      // Mostramos ambas en la tabla; la selección de canceladas depende de reactivarCanceladas
      setCoberturas([...coberturasRetiradas, ...coberturasCanceladas]);
    } catch (err) {
      console.error("Error al cargar coberturas retiradas/canceladas:", err);
      setError("No se pudieron cargar las coberturas para reactivar. Intente nuevamente.");
    } finally {
      setLoadingCoberturas(false);
    }
  };

  const idsSeleccionables = coberturas
    .filter((c) => c && c.id)
    .filter((c) => !esCoberturaCancelada(c) || reactivarCanceladas)
    .map((c) => c.id)
    .filter(Boolean);

  // Si el usuario desactiva el nuevo flujo, limpiamos selección de canceladas.
  useEffect(() => {
    if (reactivarCanceladas) return;
    setCoberturasSeleccionadas((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        const cobertura = coberturas.find((c) => String(c.id) === String(id));
        if (!cobertura) return;
        if (esCoberturaCancelada(cobertura)) return; // no se permite reactivar canceladas
        next.add(id);
      });
      return next;
    });
  }, [reactivarCanceladas, coberturas]);

  // Manejar selección/deselección de coberturas
  // Reglas:
  // - Si la cobertura es cancelada y el usuario NO activó reactivarCanceladas => no permitir
  // - Si al intentar seleccionar (agregar) la cobertura hay conflicto: cliente ya activo en otro grupo familiar
  //   con el mismo producto => no permitir
  const toggleCobertura = async (coberturaId) => {
    if (!coberturaId) return;

    const cobertura = coberturas.find((c) => String(c.id) === String(coberturaId));
    const seleccionPrevia = coberturasSeleccionadas.has(coberturaId);

    if (import.meta.env.DEV) {
      console.log("🧩 toggleCobertura click:", {
        coberturaId,
        esCancelada: cobertura ? esCoberturaCancelada(cobertura) : null,
        reactivarCanceladas,
        seleccionPrevia,
        idsSeleccionablesCount: idsSeleccionables.length,
      });
    }

    // Siempre permitir des-seleccionar
    if (seleccionPrevia) {
      setCoberturasSeleccionadas((prev) => {
        const nuevo = new Set(prev);
        nuevo.delete(coberturaId);
        return nuevo;
      });
      return;
    }

    // Validación de canceladas (antes del conflicto)
    if (cobertura && esCoberturaCancelada(cobertura) && !reactivarCanceladas) {
      mostrarSeleccionError(
        "Para seleccionar coberturas canceladas, activa la opción 'Reactivar también coberturas canceladas'."
      );
      return;
    }

    // Validación de conflicto (solo cuando se intenta seleccionar/agregar)
    const clienteId =
      cobertura?.cliente?.id ??
      cobertura?.cliente_id ??
      cobertura?.cliente?.cliente_id ??
      null;

    const coberturaTipo = cobertura?.cobertura_tipo ?? cobertura?.tipoProducto ?? null;
    const msg =
      "El cliente ya está activo en otro grupo familiar con el mismo producto. No se puede reactivar esta cobertura.";

    if (clienteId && coberturaTipo) {
      const cacheKey = `${Number(clienteId)}::${String(coberturaTipo).trim().toUpperCase()}`;
      if (conflictoCacheRef.current.has(cacheKey)) {
        const conflicto = conflictoCacheRef.current.get(cacheKey);
        if (conflicto) {
          mostrarSeleccionError(msg);
          return;
        }
      } else {
        try {
          const conflicto = await GrupoFamiliarService.findActiveCoverageConflictByActivoAndTipo(
            clienteId,
            coberturaTipo,
            grupoFamiliarId
          );
          conflictoCacheRef.current.set(cacheKey, conflicto);
          if (conflicto) {
            mostrarSeleccionError(msg);
            return;
          }
        } catch (err) {
          // No romper flujo: si falla la validación, permitimos la selección
          if (import.meta.env.DEV) {
            console.warn("⚠️ Error validando conflicto de cliente para reactivación:", err);
          }
        }
      }
    }

    setCoberturasSeleccionadas((prev) => {
      const nuevo = new Set(prev);
      nuevo.add(coberturaId);
      return nuevo;
    });
    setSeleccionError("");
  };

  // Seleccionar todas / Deseleccionar todas
  const toggleTodas = () => {
    if (idsSeleccionables.length === 0) return;
    if (coberturasSeleccionadas.size === idsSeleccionables.length) {
      setSeleccionError("");
      setCoberturasSeleccionadas(new Set());
      return;
    }
    setSeleccionError("");
    setValidandoSeleccion(true);

    void (async () => {
      try {
        const nuevo = new Set();
        const msg =
          "El cliente ya está activo en otro grupo familiar con el mismo producto. No se puede reactivar esta cobertura.";
        let mostroMsg = false;

        for (const id of idsSeleccionables) {
          const cobertura = coberturas.find((c) => String(c.id) === String(id));
          if (!cobertura) continue;

          const clienteId =
            cobertura?.cliente?.id ??
            cobertura?.cliente_id ??
            cobertura?.cliente?.cliente_id ??
            null;
          const coberturaTipo = cobertura?.cobertura_tipo ?? cobertura?.tipoProducto ?? null;

          // Si no tenemos datos suficientes, no bloqueamos para no romper el flujo.
          if (!clienteId || !coberturaTipo) {
            nuevo.add(id);
            continue;
          }

          const cacheKey = `${Number(clienteId)}::${String(coberturaTipo).trim().toUpperCase()}`;
          let conflicto = null;

          if (conflictoCacheRef.current.has(cacheKey)) {
            conflicto = conflictoCacheRef.current.get(cacheKey);
          } else {
            try {
              conflicto = await GrupoFamiliarService.findActiveCoverageConflictByActivoAndTipo(
                clienteId,
                coberturaTipo,
                grupoFamiliarId
              );
              conflictoCacheRef.current.set(cacheKey, conflicto);
            } catch (err) {
              if (import.meta.env.DEV) {
                console.warn("⚠️ Error validando conflicto (seleccionar todas):", err);
              }
              // Si falla la validación, permitimos.
              conflicto = null;
            }
          }

          if (conflicto) {
            if (!mostroMsg) {
              mostrarSeleccionError(msg);
              mostroMsg = true;
            }
            continue;
          }

          nuevo.add(id);
        }

        setCoberturasSeleccionadas(nuevo);
      } finally {
        setValidandoSeleccion(false);
      }
    })();
  };

  // Validar formulario
  const validarFormulario = () => {
    const idsAReactivar = Array.from(coberturasSeleccionadas).filter((id) => idsSeleccionables.includes(id));
    if (idsAReactivar.length === 0) {
      setError("Debe seleccionar al menos una cobertura para activar nuevamente.");
      return false;
    }
    return true;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validarFormulario()) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const idsAReactivar = Array.from(coberturasSeleccionadas).filter((id) => idsSeleccionables.includes(id));

      // Reactivar cada cobertura seleccionada
      const promesas = idsAReactivar.map(async (id) => {
        const payload = {
          activo: true,
          vigente: true,
          fecha_retiro: null,
          fecha_cancelacion: null,
          motivo_cancelacion: null,
          nota_cancel: null,
        };

        // DEBUG: Verificar payload antes de enviar
        console.log(`📤 Reactivando cobertura ${id}:`, payload);

        return await apiRequest(`cobertura/${id}`, "PUT", payload);
      });

      // Ejecutar todas las reactivaciones en paralelo
      await Promise.all(promesas);

      setSuccess(true);
      
      // Llamar onSuccess después de un breve delay para mostrar el mensaje
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Error al reactivar coberturas:", err);
      
      // Manejar errores de validación del backend
      if (err.message) {
        setError(err.message);
      } else {
        setError("Ocurrió un error al reactivar las coberturas. Intente nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Calcular estadísticas
  const totalSeleccionadas = coberturasSeleccionadas.size;

  return (
    <Modal show={show} onHide={onClose} size="xl" centered>
      <Modal.Header closeButton className="bg-light border-bottom">
        <div className="w-100">
          <Modal.Title className="mb-1">
            <i className="fas fa-redo me-2 text-primary"></i>
            Reactivación de Coberturas
          </Modal.Title>
          <small className="text-muted">
            Activar nuevamente coberturas retiradas y/o canceladas del grupo familiar
          </small>
        </div>
      </Modal.Header>
      <Modal.Body className="p-4">
        {loadingCoberturas ? (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Cargando coberturas retiradas y canceladas...</p>
          </div>
        ) : coberturas.length === 0 ? (
          <Alert variant="info">
            <i className="fas fa-info-circle me-2"></i>
            No hay coberturas retiradas o canceladas disponibles para reactivar en este grupo familiar.
          </Alert>
        ) : (
          <>
            {/* Resumen ejecutivo */}
            {totalSeleccionadas > 0 && (
              <div className="card border-0 shadow-sm mb-4" style={{ backgroundColor: "#f8f9fa" }}>
                <div className="card-body py-3">
                  <div className="row text-center">
                    <div className="col-12">
                      <div className="text-muted small mb-1">Coberturas Seleccionadas para Reactivar</div>
                      <div className="h4 mb-0 text-primary fw-bold">{totalSeleccionadas}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Paso 1: Selección de coberturas */}
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="mb-1 fw-semibold">
                    <span className="badge bg-primary me-2">1</span>
                    Selección de Coberturas para Reactivar
                  </h5>
                  <small className="text-muted">
                    Seleccione las coberturas que entrarán nuevamente en activación (canceladas requieren activar la opción).
                  </small>
                </div>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={toggleTodas}
                  className="d-flex align-items-center"
                >
                  <i className={`fas ${coberturasSeleccionadas.size === idsSeleccionables.length ? "fa-square-check" : "fa-square"} me-2`}></i>
                  {coberturasSeleccionadas.size === idsSeleccionables.length
                    ? "Deseleccionar todas"
                    : "Seleccionar todas"}
                </Button>
              </div>

              <div className="mb-3">
                <Form.Check
                  type="checkbox"
                  id="reactivar-canceladas"
                  checked={reactivarCanceladas}
                  onChange={(e) => setReactivarCanceladas(e.target.checked)}
                  label="Reactivar también coberturas canceladas"
                />
                <div className="text-muted small mt-1">
                  Cuando está desactivado, las coberturas canceladas se muestran pero no se pueden seleccionar.
                </div>
              </div>

              {seleccionError && (
                <Alert variant="danger" className="mb-3">
                  <div className="d-flex align-items-start gap-2">
                    <i className="fas fa-exclamation-triangle mt-1" />
                    <div>
                      <strong>Validación:</strong> {seleccionError}
                    </div>
                  </div>
                </Alert>
              )}

              <div className="table-responsive border rounded" style={{ maxHeight: "450px", overflowY: "auto" }}>
                <Table hover size="sm" className="mb-0 table-striped">
                  <thead className="table-dark sticky-top">
                    <tr>
                      <th width="50" className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={coberturasSeleccionadas.size === idsSeleccionables.length && idsSeleccionables.length > 0}
                          onChange={toggleTodas}
                          disabled={validandoSeleccion}
                        />
                      </th>
                      <th className="fw-semibold">Cliente / Parentesco</th>
                      <th className="fw-semibold">Numero ID</th>
                      <th className="fw-semibold">Plan / Cobertura</th>
                      <th width="150" className="text-center fw-semibold">Fecha Retiro</th>
                      <th width="150" className="text-center fw-semibold">Fecha Cancelación</th>
                      <th width="100" className="text-center fw-semibold">Estado Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coberturas.filter(c => c && c.id).map((cobertura) => {
                      const coberturaId = cobertura.id;
                      const isSelected = coberturasSeleccionadas.has(coberturaId);
                      const esTomador = cobertura.parentesco?.toUpperCase() === "TOMADOR";
                      const esCancelada = esCoberturaCancelada(cobertura);
                      const esSelectable = !esCancelada || reactivarCanceladas;
                      const estadoActual = getEstadoActualEtiqueta(cobertura);
                      
                      return (
                        <tr
                          key={coberturaId}
                          className={isSelected ? "table-primary" : ""}
                          style={isSelected ? { backgroundColor: '#e7f3ff' } : esTomador ? { backgroundColor: '#fff9e6' } : {}}
                        >
                          <td className="text-center align-middle">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={isSelected}
                              title={
                                !esSelectable
                                  ? "Activa la opción para reactivar coberturas canceladas"
                                  : undefined
                              }
                              onChange={() => toggleCobertura(coberturaId)}
                              disabled={validandoSeleccion}
                            />
                          </td>
                          <td className="align-middle">
                            <div>
                              <div className="fw-semibold">{cobertura.cliente?.nombre_completo || "-"}</div>
                              <div className="d-flex align-items-center gap-2 mt-1">
                                <span className="text-muted small">{cobertura.parentesco || "-"}</span>
                                {esTomador && (
                                  <Badge bg="secondary" style={{ fontSize: "0.65rem", fontWeight: "600" }}>
                                    TOMADOR
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="align-middle">
                            <code className="text-primary fw-bold" style={{ fontSize: "0.9rem" }}>
                              {cobertura.codigo_poliza || "-"}
                            </code>
                          </td>
                          <td className="align-middle">
                            <div>
                              <div className="fw-semibold small">{cobertura.plan || "-"}</div>
                              <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                {cobertura.metal || "-"} • {cobertura.red || "-"}
                              </div>
                            </div>
                          </td>
                          <td className="align-middle text-center">
                            <span className="text-muted small">
                              {cobertura.fecha_retiro 
                                ? new Date(cobertura.fecha_retiro).toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                  })
                                : "-"}
                            </span>
                          </td>
                          <td className="align-middle text-center">
                            <span className="text-muted small">
                              {cobertura.fecha_cancelacion 
                                ? new Date(cobertura.fecha_cancelacion).toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                  })
                                : "-"}
                            </span>
                          </td>
                          <td className="align-middle text-center">
                            <Badge 
                              bg="secondary" 
                              className="small"
                              style={{ fontWeight: "600" }}
                            >
                              {estadoActual}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </div>

            {/* Paso 2: Confirmación */}
            {coberturasSeleccionadas.size > 0 && (
              <div className="border-top pt-4 mt-4">
                <h5 className="mb-3 fw-semibold">
                  <span className="badge bg-primary me-2">2</span>
                  Confirmar Reactivación
                </h5>
                <Form onSubmit={handleSubmit}>
                  <Alert variant="info" className="mb-3" style={{ backgroundColor: '#e7f3ff', borderColor: '#b3d9ff' }}>
                    <div className="d-flex align-items-start">
                      <i className="fas fa-exclamation-circle me-2 mt-1" style={{ color: '#0066cc' }}></i>
                      <div className="flex-grow-1">
                        <strong style={{ color: '#0066cc' }}>Importante: Acción Administrativa Requerida</strong>
                        <div className="mt-2 mb-2" style={{ color: '#333' }}>
                          <p className="mb-2">
                            Al confirmar la reactivación, las coberturas seleccionadas <strong>entrarán nuevamente en activación</strong> y quedarán disponibles en el grupo familiar.
                          </p>
                          <p className="mb-2 fw-semibold" style={{ color: '#0066cc' }}>
                            Debe completar los siguientes pasos después de reactivar:
                          </p>
                          <ol className="mb-0">
                            <li className="mb-1">
                              <strong>Actualizar información de la póliza:</strong> Debe diligenciar los campos de la cobertura con la información de la <strong>nueva póliza</strong> (código de póliza, plan, metal, red, fechas, etc.)
                            </li>
                            <li className="mb-1">
                              <strong>Verificar datos del cliente:</strong> Confirme que la información del cliente esté actualizada
                            </li>
                            <li>
                              <strong>Validar cobertura activa:</strong> Una vez completados los datos, la cobertura quedará activa y vigente en el sistema
                            </li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </Alert>

                  {/* Información sobre coberturas que se reactivarán */}
                  <div className="mb-3 p-3 bg-light rounded border">
                    <strong className="d-block mb-2" style={{ color: '#333' }}>
                      <i className="fas fa-list-check me-2" style={{ color: '#0066cc' }}></i>
                      Coberturas que entrarán en activación:
                    </strong>
                    <ul className="mb-0">
                      {Array.from(coberturasSeleccionadas).map(id => {
                        const cobertura = coberturas.find(c => c.id === id);
                        return (
                          <li key={id} className="mb-1">
                            <strong>{cobertura?.cliente?.nombre_completo || `ID ${id}`}</strong>
                            {cobertura?.codigo_poliza && (
                              <span className="text-muted ms-2">(Póliza anterior: {cobertura.codigo_poliza})</span>
                            )}
                            <span className="text-muted ms-2 small">
                              <i className="fas fa-info-circle me-1"></i>
                              Requiere actualización con nueva póliza
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {error && (
                    <Alert variant="danger" className="mt-3 mb-0">
                      <div className="d-flex align-items-center">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        <div>
                          <strong>Error:</strong> {error}
                        </div>
                      </div>
                    </Alert>
                  )}

                  {success && (
                    <Alert variant="info" className="mt-3 mb-0" style={{ backgroundColor: '#e7f3ff', borderColor: '#b3d9ff' }}>
                      <div className="d-flex align-items-start">
                        <i className="fas fa-check-circle me-2 mt-1" style={{ color: '#0066cc' }}></i>
                        <div>
                          <strong style={{ color: '#0066cc' }}>Coberturas reactivadas exitosamente</strong>
                          <div className="mt-2" style={{ color: '#333' }}>
                            <p className="mb-1">
                              Las coberturas seleccionadas han entrado nuevamente en activación.
                            </p>
                            <p className="mb-0 fw-semibold">
                              Recuerde: Debe actualizar la información de cada cobertura con los datos de la nueva póliza.
                            </p>
                          </div>
                        </div>
                      </div>
                    </Alert>
                  )}

                  <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                    <div className="text-muted small">
                      <i className="fas fa-shield-alt me-1"></i>
                      La reactivación será registrada en el historial. Recuerde actualizar los datos de la nueva póliza.
                    </div>
                    <div className="d-flex gap-2">
                      <Button 
                        variant="outline-secondary" 
                        onClick={onClose} 
                        disabled={loading}
                        className="px-4"
                      >
                        <i className="fas fa-times me-2"></i>
                        Cancelar
                      </Button>
                      <Button
                        variant="primary"
                        type="submit"
                        disabled={
                          loading ||
                          coberturasSeleccionadas.size === 0
                        }
                        className="px-4"
                      >
                        {loading ? (
                          <>
                            <Spinner
                              animation="border"
                              size="sm"
                              className="me-2"
                            />
                            Reactivando...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-redo me-2"></i>
                            Activar Coberturas
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </Form>
              </div>
            )}
          </>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default ReactivacionCoberturasModal;

