// src/components/coberturas/ReactivacionCoberturasModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Table, Alert, Spinner, Badge } from "react-bootstrap";
import apiRequest from "../../services/api";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";

/**
 * ReactivacionCoberturasModal
 * 
 * Modal para reactivar coberturas retiradas de un grupo familiar.
 * 
 * Props:
 * - show (boolean): Controla la visibilidad del modal
 * - onClose (func): Se llama para cerrar el modal sin guardar
 * - onSuccess (func): Se llama cuando la operación se completa exitosamente
 * - grupoFamiliarId (number|string): ID del grupo familiar
 * 
 * El componente:
 * - Carga las coberturas retiradas del grupo familiar (activo: false, vigente: false)
 * - Permite seleccionar una o varias coberturas mediante checkboxes
 * - Valida que haya al menos una cobertura seleccionada
 * - Envía peticiones PUT a /api/cobertura/{id} para reactivar cada cobertura
 * - Actualiza: activo: true, vigente: true, fecha_retiro: null, fecha_cancelacion: null
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
  const [loading, setLoading] = useState(false);
  const [loadingCoberturas, setLoadingCoberturas] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
  };

  const cargarCoberturas = async () => {
    if (!grupoFamiliarId) return;

    setLoadingCoberturas(true);
    setError("");

    try {
      // Obtener el grupo familiar completo
      const grupoData = await GrupoFamiliarService.getFullById(grupoFamiliarId);
      
      // Extraer coberturas retiradas (activo: false y vigente: false)
      const coberturasRetiradas = (grupoData?.coberturas || []).filter(
        (c) => 
          (c.activo === false || c.activo === "false" || c.activo === 0) &&
          (c.vigente === false || c.vigente === "false" || c.vigente === 0)
      );

      setCoberturas(coberturasRetiradas);
    } catch (err) {
      console.error("Error al cargar coberturas retiradas:", err);
      setError("No se pudieron cargar las coberturas retiradas. Intente nuevamente.");
    } finally {
      setLoadingCoberturas(false);
    }
  };

  // Manejar selección/deselección de coberturas
  const toggleCobertura = (coberturaId) => {
    if (!coberturaId) {
      console.warn("toggleCobertura: coberturaId es undefined o null");
      return;
    }
    
    setCoberturasSeleccionadas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(coberturaId)) {
        nuevo.delete(coberturaId);
      } else {
        nuevo.add(coberturaId);
      }
      return nuevo;
    });
  };

  // Seleccionar todas / Deseleccionar todas
  const toggleTodas = () => {
    if (coberturasSeleccionadas.size === coberturas.length) {
      setCoberturasSeleccionadas(new Set());
    } else {
      const todasLasIds = coberturas.map((c) => c.id).filter(id => id);
      setCoberturasSeleccionadas(new Set(todasLasIds));
    }
  };

  // Validar formulario
  const validarFormulario = () => {
    if (coberturasSeleccionadas.size === 0) {
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
      // Reactivar cada cobertura seleccionada
      const promesas = Array.from(coberturasSeleccionadas).map(async (id) => {
        const payload = {
          activo: true,
          vigente: true,
          fecha_retiro: null,
          fecha_cancelacion: null,
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
            Activar nuevamente coberturas que fueron retiradas del grupo familiar
          </small>
        </div>
      </Modal.Header>
      <Modal.Body className="p-4">
        {loadingCoberturas ? (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Cargando coberturas retiradas...</p>
          </div>
        ) : coberturas.length === 0 ? (
          <Alert variant="info">
            <i className="fas fa-info-circle me-2"></i>
            No hay coberturas retiradas disponibles para reactivar en este grupo familiar.
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
                  <small className="text-muted">Seleccione las coberturas que entrarán nuevamente en activación</small>
                </div>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={toggleTodas}
                  className="d-flex align-items-center"
                >
                  <i className={`fas ${coberturasSeleccionadas.size === coberturas.length ? "fa-square-check" : "fa-square"} me-2`}></i>
                  {coberturasSeleccionadas.size === coberturas.length
                    ? "Deseleccionar todas"
                    : "Seleccionar todas"}
                </Button>
              </div>

              <div className="table-responsive border rounded" style={{ maxHeight: "450px", overflowY: "auto" }}>
                <Table hover size="sm" className="mb-0 table-striped">
                  <thead className="table-dark sticky-top">
                    <tr>
                      <th width="50" className="text-center">
                        <Form.Check
                          type="checkbox"
                          checked={coberturasSeleccionadas.size === coberturas.length && coberturas.length > 0}
                          onChange={toggleTodas}
                          className="text-white"
                        />
                      </th>
                      <th className="fw-semibold">Cliente / Parentesco</th>
                      <th className="fw-semibold">Código Póliza</th>
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
                      
                      return (
                        <tr
                          key={coberturaId}
                          className={isSelected ? "table-primary" : ""}
                          style={isSelected ? { backgroundColor: '#e7f3ff' } : esTomador ? { backgroundColor: '#fff9e6' } : {}}
                        >
                          <td className="text-center align-middle">
                            <Form.Check
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCobertura(coberturaId)}
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
                              Retirada
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

