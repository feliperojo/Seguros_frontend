// src/components/coberturas/CambioVidaCancelacionModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Table, Alert, Spinner, Badge } from "react-bootstrap";
import apiRequest from "../../services/api";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";

/**
 * CambioVidaCancelacionModal
 * 
 * Modal para cancelar coberturas de un grupo familiar (cambio de vida).
 * 
 * Props:
 * - show (boolean): Controla la visibilidad del modal
 * - onClose (func): Se llama para cerrar el modal sin guardar
 * - onSuccess (func): Se llama cuando la operación se completa exitosamente
 * - grupoFamiliarId (number|string): ID del grupo familiar
 * 
 * El componente:
 * - Carga las coberturas vigentes del grupo familiar
 * - Permite seleccionar una o varias coberturas mediante checkboxes
 * - Valida que haya al menos una cobertura seleccionada y fecha_cancelacion
 * - Envía la petición POST a /api/coberturas/cancelar
 * - Muestra estados de loading, éxito y error
 */
const CambioVidaCancelacionModal = ({
  show,
  onClose,
  onSuccess,
  grupoFamiliarId,
}) => {
  const [coberturas, setCoberturas] = useState([]);
  const [coberturasSeleccionadas, setCoberturasSeleccionadas] = useState(new Set());
  // Estado para rastrear si cada cobertura se renueva o no (por ID de cobertura)
  const [renovacionCoberturas, setRenovacionCoberturas] = useState(new Map()); // Map<coberturaId, {renovar: boolean}>
  const [loading, setLoading] = useState(false);
  const [loadingCoberturas, setLoadingCoberturas] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Formulario
  const [fechaCancelacion, setFechaCancelacion] = useState("");
  const [fechaRetiro, setFechaRetiro] = useState("");
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [notaCancel, setNotaCancel] = useState("");

  // Opciones predefinidas para motivo_cancelacion
  const motivosCancelacion = [
    "Cambio de ingresos",
    "Renovación anual",
    "Cambio de empleo",
    "Cambio de estado civil",
    "Cambio de residencia",
    "Otro",
  ];

  // Cargar coberturas vigentes cuando se abre el modal
  useEffect(() => {
    if (show && grupoFamiliarId) {
      cargarCoberturas();
      // Resetear formulario
      resetFormulario();
    }
  }, [show, grupoFamiliarId]);

  const resetFormulario = () => {
    setCoberturasSeleccionadas(new Set());
    setRenovacionCoberturas(new Map());
    setFechaCancelacion("");
    setFechaRetiro("");
    setMotivoCancelacion("");
    setNotaCancel("");
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
      
      // Extraer coberturas vigentes (activas)
      const coberturasVigentes = (grupoData?.coberturas || []).filter(
        (c) => c.activo === true || c.activo === "true" || c.activo === 1
      );

      setCoberturas(coberturasVigentes);
    } catch (err) {
      console.error("Error al cargar coberturas:", err);
      setError("No se pudieron cargar las coberturas. Intente nuevamente.");
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
        // Limpiar datos de renovación cuando se deselecciona
        setRenovacionCoberturas((prevRenov) => {
          const nuevoRenov = new Map(prevRenov);
          nuevoRenov.delete(coberturaId);
          return nuevoRenov;
        });
      } else {
        nuevo.add(coberturaId);
        // Inicializar con valor por defecto: no se renueva (activo = false)
        setRenovacionCoberturas((prevRenov) => {
          const nuevoRenov = new Map(prevRenov);
        nuevoRenov.set(coberturaId, {
          renovar: false,
        });
          return nuevoRenov;
        });
      }
      return nuevo;
    });
  };

  // Manejar cambio en la decisión de renovación para una cobertura
  const handleRenovacionChange = (coberturaId, renovar) => {
    if (!coberturaId) {
      console.warn("handleRenovacionChange: coberturaId es undefined o null");
      return;
    }
    
    setRenovacionCoberturas((prev) => {
      const nuevo = new Map(prev);
      nuevo.set(coberturaId, {
        renovar: Boolean(renovar),
      });
      return nuevo;
    });
  };

  // Seleccionar todas / Deseleccionar todas
  const toggleTodas = () => {
    if (coberturasSeleccionadas.size === coberturas.length) {
      setCoberturasSeleccionadas(new Set());
    } else {
      setCoberturasSeleccionadas(new Set(coberturas.map((c) => c.id)));
    }
  };

  // Validar formulario
  const validarFormulario = () => {
    if (coberturasSeleccionadas.size === 0) {
      setError("Debe seleccionar al menos una cobertura.");
      return false;
    }
    if (!fechaCancelacion) {
      setError("La fecha de cancelación es requerida.");
      return false;
    }
    
    // Validar que todas las coberturas seleccionadas tengan una decisión de renovación
    const coberturasSinDecision = Array.from(coberturasSeleccionadas).filter(
      (id) => !renovacionCoberturas.has(id)
    );
    if (coberturasSinDecision.length > 0) {
      setError("Por favor, indica para cada cobertura seleccionada si se renueva o no.");
      return false;
    }
    
    // Validar que se haya ingresado fecha de retiro
    if (!fechaRetiro) {
      setError("La fecha de retiro es requerida.");
      return false;
    }
    
    // Validar que la fecha de retiro no sea menor a la fecha de cancelación
    if (fechaRetiro && fechaCancelacion) {
      if (fechaRetiro < fechaCancelacion) {
        setError("La fecha de retiro no puede ser menor a la fecha de cancelación.");
        return false;
      }
    }
    
    return true;
  };

  // Formatear fecha a YYYY-MM-DD
  // Si ya es un string en formato YYYY-MM-DD, retornarlo directamente
  // Si es un objeto Date, formatearlo usando métodos locales para evitar desfase de zona horaria
  const formatearFecha = (fecha) => {
    if (!fecha) return null;
    
    // Si ya es un string en formato YYYY-MM-DD, retornarlo directamente
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }
    
    // Si es un objeto Date, usar métodos locales para evitar desfase
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(d.getTime())) return null;
    
    // Usar métodos locales (getFullYear, getMonth, getDate) que respetan la zona horaria local
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
      // Preparar datos de renovación por cobertura
      // Para cada cobertura se actualizan:
      // - activo: true si renueva, false si no renueva
      // - fecha_cancelacion: fecha general de cancelación
      // - fecha_retiro: fecha general de retiro
      const datosRenovacion = Array.from(coberturasSeleccionadas).map((id) => {
        const datos = renovacionCoberturas.get(id);
        const renovar = datos?.renovar ?? false;
        
        return {
          cobertura_id: Number(id),
          renovar: renovar,
          // Actualizar activo: true si continúa, false si no continúa (igual que se actualizan las fechas)
          activo: renovar ? true : false,
          // Actualizar fechas de cancelación y retiro para todas las coberturas
          fecha_cancelacion: fechaCancelacion || null,
          fecha_retiro: fechaRetiro || null,
        };
      });

      const payload = {
        cobertura_ids: Array.from(coberturasSeleccionadas).map(Number),
        // Los inputs date ya devuelven strings en formato YYYY-MM-DD, usar directamente
        fecha_cancelacion: fechaCancelacion || null,
        fecha_retiro: fechaRetiro || null, // Mantener para compatibilidad
        motivo_cancelacion: motivoCancelacion || null,
        nota_cancel: notaCancel || null,
        accion_origen: "Cambio de vida",
        // Regla automática: si se cancela una cobertura, estado_cobertura debe ser "No"
        estado_cobertura: "No",
        // Nuevos campos para manejar renovación y activo por cobertura
        datos_renovacion: datosRenovacion,
      };

      // Eliminar campos null del payload (excepto estado_cobertura y datos_renovacion que siempre deben ir)
      Object.keys(payload).forEach((key) => {
        if (key !== 'estado_cobertura' && key !== 'datos_renovacion' && (payload[key] === null || payload[key] === undefined)) {
          delete payload[key];
        }
      });

      await apiRequest("coberturas/cancelar", "POST", payload);

      setSuccess(true);
      
      // Llamar onSuccess después de un breve delay para mostrar el mensaje
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Error al cancelar coberturas:", err);
      
      // Manejar errores de validación del backend
      if (err.message) {
        setError(err.message);
      } else {
        setError("Ocurrió un error al cancelar las coberturas. Intente nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Obtener fecha actual en formato YYYY-MM-DD para el input date
  const getFechaHoy = () => {
    const hoy = new Date();
    return formatearFecha(hoy);
  };

  // Calcular estadísticas
  const totalSeleccionadas = coberturasSeleccionadas.size;
  const totalRenovar = Array.from(coberturasSeleccionadas).filter(id => {
    if (!id) return false;
    const datos = renovacionCoberturas.get(id);
    return datos && datos.renovar === true;
  }).length;
  const totalNoRenovar = totalSeleccionadas - totalRenovar;

  return (
    <Modal show={show} onHide={onClose} size="xl" centered>
      <Modal.Header closeButton className="bg-light border-bottom">
        <div className="w-100">
          <Modal.Title className="mb-1">
            <i className="fas fa-file-contract me-2 text-primary"></i>
            Gestión de Cancelación y Renovación de Coberturas
          </Modal.Title>
          <small className="text-muted">
            Proceso administrativo para cambio de vida y gestión de coberturas
          </small>
        </div>
      </Modal.Header>
      <Modal.Body className="p-4">
        {loadingCoberturas ? (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Cargando coberturas...</p>
          </div>
        ) : coberturas.length === 0 ? (
          <Alert variant="info">
            <i className="fas fa-info-circle me-2"></i>
            No hay coberturas vigentes disponibles para cancelar.
          </Alert>
        ) : (
          <>
            {/* Resumen ejecutivo */}
            {totalSeleccionadas > 0 && (
              <div className="card border-0 shadow-sm mb-4" style={{ backgroundColor: "#f8f9fa" }}>
                <div className="card-body py-3">
                  <div className="row text-center">
                    <div className="col-md-3 border-end">
                      <div className="text-muted small mb-1">Total Seleccionadas</div>
                      <div className="h4 mb-0 text-primary fw-bold">{totalSeleccionadas}</div>
                    </div>
                    <div className="col-md-3 border-end">
                      <div className="text-muted small mb-1">Se Renuevan</div>
                      <div className="h4 mb-0 text-success fw-bold">{totalRenovar}</div>
                    </div>
                    <div className="col-md-3 border-end">
                      <div className="text-muted small mb-1">No Se Renuevan</div>
                      <div className="h4 mb-0 text-secondary fw-bold">{totalNoRenovar}</div>
                    </div>
                    <div className="col-md-3">
                      <div className="text-muted small mb-1">Pendientes</div>
                      <div className="h4 mb-0 text-warning fw-bold">
                        {totalSeleccionadas - (totalRenovar + totalNoRenovar)}
                      </div>
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
                    Selección de Coberturas
                  </h5>
                  <small className="text-muted">Seleccione las coberturas que serán procesadas</small>
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
                      <th width="250" className="text-center fw-semibold">Decisión de Renovación</th>
                      <th width="100" className="text-center fw-semibold">Estado Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coberturas.filter(c => c && c.id).map((cobertura) => {
                      const coberturaId = cobertura.id;
                      const isSelected = coberturasSeleccionadas.has(coberturaId);
                      const esTomador = cobertura.parentesco?.toUpperCase() === "TOMADOR";
                      const datosRenovacion = renovacionCoberturas.get(coberturaId) || {
                        renovar: false,
                      };
                      
                      return (
                        <tr
                          key={coberturaId}
                          className={isSelected ? "table-primary" : esTomador ? "table-warning" : ""}
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
                                  <Badge bg="warning" text="dark" style={{ fontSize: "0.65rem", fontWeight: "600" }}>
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
                          <td className="align-middle">
                            {isSelected ? (
                              <div className="d-flex flex-column gap-2">
                                <Form.Check
                                  type="radio"
                                  id={`renovar-si-${coberturaId}`}
                                  name={`renovar-${coberturaId}`}
                                  label={
                                    <span className="small fw-semibold text-success">✓ Continuará activo en el grupo</span>
                                  }
                                  checked={datosRenovacion.renovar === true}
                                  onChange={() => handleRenovacionChange(coberturaId, true)}
                                />
                                <Form.Check
                                  type="radio"
                                  id={`renovar-no-${coberturaId}`}
                                  name={`renovar-${coberturaId}`}
                                  label={
                                    <span className="small fw-semibold text-danger">✗ No continuará activo en el grupo</span>
                                  }
                                  checked={datosRenovacion.renovar === false}
                                  onChange={() => handleRenovacionChange(coberturaId, false)}
                                />
                              </div>
                            ) : (
                              <span className="text-muted small fst-italic">Seleccione para definir</span>
                            )}
                          </td>
                          <td className="align-middle text-center">
                            <Badge 
                              bg={cobertura.activo ? "success" : "secondary"} 
                              className="small"
                              style={{ fontWeight: "600" }}
                            >
                              {cobertura.activo ? "Activa" : "Inactiva"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

            </div>

            {/* Paso 2: Información de cancelación */}
            {coberturasSeleccionadas.size > 0 && (
              <div className="border-top pt-4 mt-4">
                <h5 className="mb-3 fw-semibold">
                  <span className="badge bg-primary me-2">2</span>
                  Información de Cancelación
                </h5>
                <Form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <Form.Group>
                        <Form.Label className="fw-semibold mb-2">
                          Fecha de Cancelación <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={fechaCancelacion}
                          onChange={(e) => setFechaCancelacion(e.target.value)}
                          required
                          className="border-primary"
                        />
                        <Form.Text className="text-muted small">
                          Fecha efectiva de cancelación de las coberturas seleccionadas
                        </Form.Text>
                      </Form.Group>
                    </div>

                    <div className="col-md-6">
                      <Form.Group>
                        <Form.Label className="fw-semibold mb-2">
                          Fecha de Retiro <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={fechaRetiro}
                          onChange={(e) => setFechaRetiro(e.target.value)}
                          required
                          min={fechaCancelacion || undefined}
                          className="border-primary"
                        />
                        <Form.Text className="text-muted small">
                          Fecha de retiro aplicable a las coberturas seleccionadas
                        </Form.Text>
                      </Form.Group>
                    </div>

                    <div className="col-md-6">
                      <Form.Group>
                        <Form.Label className="fw-semibold mb-2">Motivo de Cancelación</Form.Label>
                        <Form.Select
                          value={motivoCancelacion}
                          onChange={(e) => setMotivoCancelacion(e.target.value)}
                          className="border-secondary"
                        >
                          <option value="">Seleccione un motivo...</option>
                          {motivosCancelacion.map((motivo) => (
                            <option key={motivo} value={motivo}>
                              {motivo}
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Text className="text-muted small">
                          Clasificación del motivo de cancelación
                        </Form.Text>
                      </Form.Group>
                    </div>

                    <div className="col-md-6">
                      <Form.Group>
                        <Form.Label className="fw-semibold mb-2">Observaciones</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          value={notaCancel}
                          onChange={(e) => setNotaCancel(e.target.value)}
                          placeholder="Ingrese observaciones adicionales sobre esta operación..."
                          style={{ resize: "none" }}
                          className="border-secondary"
                        />
                        <Form.Text className="text-muted small">
                          Notas administrativas sobre la cancelación
                        </Form.Text>
                      </Form.Group>
                    </div>
                  </div>

                  {/* Información sobre coberturas que no continuarán */}
                  {Array.from(coberturasSeleccionadas).filter(id => {
                    const datos = renovacionCoberturas.get(id);
                    return datos && datos.renovar === false;
                  }).length > 0 && (
                    <div className="mt-3 mb-3">
                      <Alert variant="warning" className="mb-0">
                        <div className="d-flex align-items-start">
                          <i className="fas fa-exclamation-triangle me-2 mt-1 text-warning"></i>
                          <div className="flex-grow-1">
                            <strong className="text-dark">Miembros que no continuarán activos en el grupo</strong>
                            <div className="text-muted small mt-1 mb-2">
                              Los siguientes miembros del grupo familiar no continuarán activos y pasarán al historial. 
                              Estos miembros quedarán registrados pero ya no estarán activos en el grupo familiar.
                            </div>
                            <div className="small">
                              <strong>Miembros afectados:</strong>
                              <ul className="mb-0 mt-1">
                                {Array.from(coberturasSeleccionadas)
                                  .filter(id => {
                                    const datos = renovacionCoberturas.get(id);
                                    return datos && datos.renovar === false;
                                  })
                                  .map(id => {
                                    const cobertura = coberturas.find(c => c.id === id);
                                    return (
                                      <li key={id}>
                                        <strong>{cobertura?.cliente?.nombre_completo || `ID ${id}`}</strong>
                                        {cobertura?.codigo_poliza && (
                                          <span className="text-muted ms-2">({cobertura.codigo_poliza})</span>
                                        )}
                                      </li>
                                    );
                                  })}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </Alert>
                    </div>
                  )}

                  {error && (
                    <Alert variant="danger" className="mt-3 mb-0">
                      <div className="d-flex align-items-center">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        <div>
                          <strong>Error de validación:</strong> {error}
                        </div>
                      </div>
                    </Alert>
                  )}

                  {success && (
                    <Alert variant="success" className="mt-3 mb-0">
                      <div className="d-flex align-items-center">
                        <i className="fas fa-check-circle me-2"></i>
                        <div>
                          <strong>Operación completada:</strong> Las coberturas han sido procesadas correctamente.
                        </div>
                      </div>
                    </Alert>
                  )}

                  <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                    <div className="text-muted small">
                      <i className="fas fa-shield-alt me-1"></i>
                      Esta operación será registrada en el historial del grupo familiar
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
                          coberturasSeleccionadas.size === 0 ||
                          !fechaCancelacion ||
                          !fechaRetiro
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
                            Procesando...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-check-double me-2"></i>
                            Confirmar Operación
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

export default CambioVidaCancelacionModal;

