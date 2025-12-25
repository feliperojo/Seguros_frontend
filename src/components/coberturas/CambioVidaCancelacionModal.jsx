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
    // Validar que la fecha de retiro no sea menor a la fecha de cancelación
    if (fechaRetiro && fechaCancelacion) {
      const fechaCancel = new Date(fechaCancelacion);
      const fechaRet = new Date(fechaRetiro);
      if (fechaRet < fechaCancel) {
        setError("La fecha de retiro no puede ser menor a la fecha de cancelación.");
        return false;
      }
    }
    return true;
  };

  // Formatear fecha a YYYY-MM-DD
  const formatearFecha = (fecha) => {
    if (!fecha) return null;
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return null;
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
      const payload = {
        cobertura_ids: Array.from(coberturasSeleccionadas).map(Number),
        fecha_cancelacion: formatearFecha(fechaCancelacion),
        fecha_retiro: fechaRetiro ? formatearFecha(fechaRetiro) : null,
        motivo_cancelacion: motivoCancelacion || null,
        nota_cancel: notaCancel || null,
        accion_origen: "Cambio de vida",
      };

      // Eliminar campos null del payload
      Object.keys(payload).forEach((key) => {
        if (payload[key] === null || payload[key] === undefined) {
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

  return (
    <Modal show={show} onHide={onClose} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="fas fa-exclamation-triangle text-warning me-2"></i>
          Cambio de vida / Cancelar coberturas
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
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
            {/* Lista de coberturas con checkboxes */}
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">Seleccione las coberturas a cancelar</h6>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={toggleTodas}
                >
                  {coberturasSeleccionadas.size === coberturas.length
                    ? "Deseleccionar todas"
                    : "Seleccionar todas"}
                </Button>
              </div>

              <div className="table-responsive" style={{ maxHeight: "300px", overflowY: "auto" }}>
                <Table bordered hover size="sm">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th width="50" className="text-center">
                        <Form.Check
                          type="checkbox"
                          checked={coberturasSeleccionadas.size === coberturas.length && coberturas.length > 0}
                          onChange={toggleTodas}
                        />
                      </th>
                      <th>Código Póliza</th>
                      <th>Cliente</th>
                      <th>Parentesco</th>
                      <th>Plan</th>
                      <th>Metal</th>
                      <th>Red</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coberturas.map((cobertura) => {
                      const isSelected = coberturasSeleccionadas.has(cobertura.id);
                      const esTomador = cobertura.parentesco?.toUpperCase() === "TOMADOR";
                      
                      return (
                        <tr
                          key={cobertura.id}
                          style={{
                            backgroundColor: isSelected ? "#e7f3ff" : esTomador ? "#fff9db" : "transparent",
                            cursor: "pointer",
                          }}
                          onClick={() => toggleCobertura(cobertura.id)}
                        >
                          <td className="text-center">
                            <Form.Check
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCobertura(cobertura.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td>
                            <strong>{cobertura.codigo_poliza || "-"}</strong>
                          </td>
                          <td>
                            {cobertura.cliente?.nombre_completo || "-"}
                            {esTomador && (
                              <Badge bg="warning" text="dark" className="ms-2">
                                TOMADOR
                              </Badge>
                            )}
                          </td>
                          <td>{cobertura.parentesco || "-"}</td>
                          <td>{cobertura.plan || "-"}</td>
                          <td>{cobertura.metal || "-"}</td>
                          <td>{cobertura.red || "-"}</td>
                          <td>
                            <Badge bg={cobertura.activo ? "success" : "secondary"}>
                              {cobertura.activo ? "Activa" : "Inactiva"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {coberturasSeleccionadas.size > 0 && (
                <div className="mt-2">
                  <Badge bg="info">
                    {coberturasSeleccionadas.size} cobertura(s) seleccionada(s)
                  </Badge>
                </div>
              )}
            </div>

            {/* Formulario */}
            <Form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <Form.Group>
                    <Form.Label>
                      Fecha de Cancelación <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="date"
                      value={fechaCancelacion}
                      onChange={(e) => setFechaCancelacion(e.target.value)}
                      required
                    />
                    <Form.Text className="text-muted">
                      Fecha en que se cancela la cobertura
                    </Form.Text>
                  </Form.Group>
                </div>

                <div className="col-md-6 mb-3">
                  <Form.Group>
                    <Form.Label>Fecha de Retiro (Opcional)</Form.Label>
                    <Form.Control
                      type="date"
                      value={fechaRetiro}
                      onChange={(e) => setFechaRetiro(e.target.value)}
                      min={fechaCancelacion || undefined}
                    />
                    <Form.Text className="text-muted">
                      Fecha en que el miembro se retira del grupo
                    </Form.Text>
                  </Form.Group>
                </div>
              </div>

              <div className="mb-3">
                <Form.Group>
                  <Form.Label>Motivo de Cancelación (Opcional)</Form.Label>
                  <Form.Select
                    value={motivoCancelacion}
                    onChange={(e) => setMotivoCancelacion(e.target.value)}
                  >
                    <option value="">Seleccione un motivo...</option>
                    {motivosCancelacion.map((motivo) => (
                      <option key={motivo} value={motivo}>
                        {motivo}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>

              <div className="mb-3">
                <Form.Group>
                  <Form.Label>Nota de Cancelación (Opcional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={notaCancel}
                    onChange={(e) => setNotaCancel(e.target.value)}
                    placeholder="Ingrese cualquier nota adicional sobre la cancelación..."
                  />
                </Form.Group>
              </div>

              {error && (
                <Alert variant="danger" className="mt-3">
                  <i className="fas fa-exclamation-circle me-2"></i>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert variant="success" className="mt-3">
                  <i className="fas fa-check-circle me-2"></i>
                  Coberturas canceladas y archivadas correctamente.
                </Alert>
              )}

              <div className="d-flex justify-content-end gap-2 mt-4">
                <Button variant="secondary" onClick={onClose} disabled={loading}>
                  Cancelar
                </Button>
                <Button
                  variant="warning"
                  type="submit"
                  disabled={
                    loading ||
                    coberturasSeleccionadas.size === 0 ||
                    !fechaCancelacion
                  }
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
                      <i className="fas fa-check me-2"></i>
                      Confirmar Cancelación
                    </>
                  )}
                </Button>
              </div>
            </Form>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default CambioVidaCancelacionModal;

