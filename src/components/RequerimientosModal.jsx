import React, { useEffect, useState } from "react";
import { Modal, Button, Form, Table, Badge, Alert } from "react-bootstrap";
import apiRequest from "../services/api"; // Asumiendo que usas este servicio para tus requests

const estados = {
  Pendiente: "warning",
  "Se pidio": "primary",
  Enviado: "info",
  Insuficiente: "danger",
  Completado: "success",
};

const estadosOptions = [
  { value: "Pendiente", label: "Pendiente" },
  { value: "Se pidio", label: "Se pidio" },
  { value: "Enviado", label: "Enviado" },
  { value: "Insuficiente", label: "Insuficiente" },
  { value: "Completado", label: "Completado" },
];

const documentosDisponibles = [
  "Status",
  "Ingresos",
  "Medicare",
  "Medicaid",
  // Agrega otros documentos necesarios aquí
];

const RequerimientosModal = ({ show, onHide, grupoFamiliarId }) => {
  // Fecha para inputs type="date" en formato YYYY-MM-DD, usando hora local
  const getLocalISODate = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Formato visible para el usuario: MM/DD/AAAA (sin cambiar el valor real guardado)
  const formatMDY = (valor) => {
    if (!valor) return "-";
    const d = new Date(typeof valor === "string" && !valor.includes("T") ? `${valor}T00:00:00` : valor);
    if (isNaN(d.getTime())) return "-";
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const [coberturas, setCoberturas] = useState([]);
  const [nuevo, setNuevo] = useState({
    documento_requerido: "",
    fecha_solicitud: getLocalISODate(),
    observaciones: "",
    cobertura_id: [],  // Asegurarte de que siempre sea un arreglo
    estado: "Pendiente",
    fecha_vencimiento: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");  // Manejo de errores
  const [success, setSuccess] = useState(""); // Mensaje de éxito
  const [editableRequerimiento, setEditableRequerimiento] = useState(null); // For storing the requerimiento being edited
  const [editingId, setEditingId] = useState(null); // ID del requerimiento que se está editando

  useEffect(() => {
    if (show && grupoFamiliarId) {
      fetchCoberturas(grupoFamiliarId); // Cargar las coberturas cuando el modal se abre
    }
  }, [show, grupoFamiliarId]);

  // Cuando se abre el modal para crear un nuevo requerimiento, setear fecha_solicitud a la actual por defecto.
  // Si el usuario la cambia, se respeta hasta que cierre/guarde (no se re-sobrescribe mientras el modal siga abierto).
  useEffect(() => {
    if (!show) return;
    setNuevo({
      documento_requerido: "",
      fecha_solicitud: getLocalISODate(),
      fecha_vencimiento: "",
      observaciones: "",
      cobertura_id: [],
      estado: "Pendiente",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Limpiar mensajes después de unos segundos
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Obtener las coberturas activas asociadas al grupo familiar
  const fetchCoberturas = async (grupoFamiliarId) => {
    try {
      const response = await apiRequest(`cobertura/grupo_familiar/${grupoFamiliarId}/coberturas`, "GET");
      console.log("coberturas con requerimientos", response);
      
      // Filtrar solo coberturas activas
      const activeCoberturas = response.filter(cobertura => cobertura.activo); // Asegurarse de que solo se trabajen con coberturas activas
      setCoberturas(activeCoberturas);
    } catch (error) {
      setError("Error al cargar coberturas: " + error.message);
    }
  };

  const handleEdit = (requerimiento) => {
    setEditingId(requerimiento.id);
    setEditableRequerimiento({
      ...requerimiento,
      fecha_vencimiento: requerimiento.fecha_vencimiento || "",
      estado: requerimiento.estado || "Pendiente",
      codigo_poliza: requerimiento.codigo_poliza || null
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditableRequerimiento(null);
  };

  const saveChanges = async () => {
    if (!editableRequerimiento.fecha_vencimiento || !editableRequerimiento.estado) {
      setError("Debe completar todos los campos obligatorios.");
      return;
    }
  
    setLoading(true);
    try {
      // Buscar la cobertura para obtener el codigo_poliza si no está en editableRequerimiento
      const cobertura = coberturas.find(c => c.id === editableRequerimiento.cobertura_id);
      const codigoPoliza = editableRequerimiento.codigo_poliza || cobertura?.codigo_poliza || null;

      const updatedData = {
        fecha_vencimiento: editableRequerimiento.fecha_vencimiento,
        estado: editableRequerimiento.estado,
        codigo_poliza: codigoPoliza,
      };
  
      // Call the API to update the requerimiento
      await apiRequest(
        `coberturas/${editableRequerimiento.cobertura_id}/documentos/${editableRequerimiento.id}`,
        "PUT",
        updatedData
      );
  
      setSuccess("Requerimiento actualizado exitosamente.");
      setEditableRequerimiento(null);
      setEditingId(null);
      fetchCoberturas(grupoFamiliarId);  // Refresh the data
    } catch (error) {
      setError("Error al actualizar requerimiento: " + error.message);
    }
    setLoading(false);
  };
    
  // Crear un nuevo requerimiento de documento
  const crearRequerimiento = async () => {
    console.log("Coberturas seleccionadas al guardar:", nuevo.cobertura_id);
  
    if (!nuevo.documento_requerido || nuevo.cobertura_id.length === 0) {
      setError("Debe completar todos los campos y seleccionar al menos una cobertura.");
      return;
    }
  
    setLoading(true);
    try {
      // Guardar requerimiento para cada cobertura seleccionada
      for (const coberturaId of nuevo.cobertura_id) {
        // Buscar la cobertura para obtener el codigo_poliza
        const cobertura = coberturas.find(c => c.id === coberturaId);
        const codigoPoliza = cobertura?.codigo_poliza || null;

        const requestData = {
          documento_requerido: nuevo.documento_requerido,
          fecha_solicitud: nuevo.fecha_solicitud,
          observaciones: nuevo.observaciones,
          fecha_vencimiento: nuevo.fecha_vencimiento,
          estado: nuevo.estado,
          codigo_poliza: codigoPoliza,
        };
  
        await apiRequest(`coberturas/${coberturaId}/documentos`, "POST", requestData);
      }
  
      setSuccess("Requerimientos creados exitosamente.");
      setNuevo({
        documento_requerido: "",
        fecha_solicitud: getLocalISODate(),
        fecha_vencimiento: "",
        observaciones: "",
        cobertura_id: [],
        estado: "Pendiente",
      });
      fetchCoberturas(grupoFamiliarId); // Refresh data after creating
    } catch (error) {
      setError("Error al crear requerimiento: " + error.message);
    }
    setLoading(false);
  };

  // Agrupar los requerimientos por cliente
  const groupRequerimientosByCliente = (coberturas) => {
    const grouped = {};

    coberturas.forEach(cobertura => {
      const clienteId = cobertura.cliente?.id;  // Verificar si cliente existe
      if (!clienteId) return;  // Si no tiene cliente, no lo procesamos

      if (!grouped[clienteId]) {
        grouped[clienteId] = {
          cliente: cobertura.cliente,
          requerimientos: [],
          codigo_poliza: cobertura.codigo_poliza // Añadimos el código de la póliza a la agrupación
        };
      }

      // Verificar si los requerimientos están presentes
      if (cobertura.requerimientos && cobertura.requerimientos.length > 0) {
        // Agregar cobertura_id y codigo_poliza a cada requerimiento para poder editarlo
        const requerimientosConCobertura = cobertura.requerimientos.map(req => ({
          ...req,
          cobertura_id: cobertura.id,
          codigo_poliza: cobertura.codigo_poliza || null
        }));
        grouped[clienteId].requerimientos.push(...requerimientosConCobertura);
      }
    });

    return grouped;
  };

  const groupedCoberturas = groupRequerimientosByCliente(coberturas);

  return (
    <Modal show={show} onHide={onHide} size="xl" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Requerimientos de Documentos</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}  {/* Mostrar errores */}
        {success && <Alert variant="success">{success}</Alert>} {/* Mostrar éxito */}

        <h6>Agregar nuevo requerimiento</h6>
        <Form className="mb-3">
          <Form.Group>
            <Form.Label>Seleccionar coberturas a las que se les solicitará el documento</Form.Label>
            <div className="mb-3" style={{ maxHeight: 250, overflowY: "auto", border: "1px solid #dee2e6", borderRadius: 5, padding: 10 }}>
              {coberturas.length === 0 ? (
                <div className="text-muted">No hay coberturas activas</div>
              ) : (
                coberturas.map((cobertura) => (
                  <Form.Check
                    key={cobertura.id}
                    type="checkbox"
                    label={`${cobertura.codigo_poliza} - ${cobertura.cliente?.nombre_completo || "Cliente sin nombre"} - ${cobertura.compania?.nombre || "Sin compañía"}`}
                    checked={nuevo.cobertura_id.includes(cobertura.id)}
                    onChange={(e) => {
                      const id = cobertura.id;
                      const seleccionadas = nuevo.cobertura_id.includes(id)
                        ? nuevo.cobertura_id.filter((c) => c !== id)
                        : [...nuevo.cobertura_id, id];
                      setNuevo({ ...nuevo, cobertura_id: seleccionadas });
                    }}
                  />
                ))
              )}
            </div>
          </Form.Group>

          <Form.Group className="d-flex gap-3">
            <div style={{ flex: 1 }}>
              <Form.Label>Documento requerido</Form.Label>
              <Form.Control
                as="select"
                value={nuevo.documento_requerido}
                onChange={(e) =>
                  setNuevo({ ...nuevo, documento_requerido: e.target.value })
                }
              >
                <option value="">Seleccionar documento</option>
                {documentosDisponibles.map((documento, index) => (
                  <option key={index} value={documento}>
                    {documento}
                  </option>
                ))}
              </Form.Control>
            </div>
          </Form.Group>

          <Form.Group className="d-flex gap-3">
                <div style={{ flex: 1 }}>
                  <Form.Label>Fecha de solicitud</Form.Label>
                  <Form.Control
                    type="date"
                    value={nuevo.fecha_solicitud}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, fecha_solicitud: e.target.value })
                    }
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <Form.Label>Fecha de vencimiento</Form.Label>
                  <Form.Control
                    type="date"
                    value={nuevo.fecha_vencimiento}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, fecha_vencimiento: e.target.value })
                    }
                  />
                </div>
              </Form.Group>

          <Form.Group>
            <Form.Label>Observaciones</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={nuevo.observaciones}
              onChange={(e) =>
                setNuevo({ ...nuevo, observaciones: e.target.value })
              }
            />
          </Form.Group>

          <Button
            variant="primary"
            onClick={crearRequerimiento}
            className="mt-2"
            disabled={loading}
          >
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        </Form>

        
        <h6>Historial de requerimientos</h6>
        {Object.keys(groupedCoberturas).length > 0 ? (
          Object.keys(groupedCoberturas).map((clienteId) => {
            const cliente = groupedCoberturas[clienteId].cliente;
            const requerimientos = groupedCoberturas[clienteId].requerimientos;
            const codigoPoliza = groupedCoberturas[clienteId].codigo_poliza;

            return (
              <div key={clienteId} className="mb-4">
                <h6>{cliente.nombre_completo || "Cliente sin nombre"} - {codigoPoliza}</h6>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Fecha Vencimiento</th>
                      <th>Fecha solicitud</th>
                      <th>Estado</th>
                      <th>Observaciones</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requerimientos.map((r) => (
                      <tr key={r.id}>
                        <td>{r.documento_requerido}</td>
                        <td>
                          {editingId === r.id ? (
                            <Form.Control
                              type="date"
                              value={editableRequerimiento?.fecha_vencimiento || ""}
                              onChange={(e) =>
                                setEditableRequerimiento({
                                  ...editableRequerimiento,
                                  fecha_vencimiento: e.target.value
                                })
                              }
                              size="sm"
                            />
                          ) : (
                            formatMDY(r.fecha_vencimiento)
                          )}
                        </td>
                        <td>{formatMDY(r.fecha_solicitud)}</td>
                        <td>
                          {editingId === r.id ? (
                            <Form.Control
                              as="select"
                              value={editableRequerimiento?.estado || "Pendiente"}
                              onChange={(e) =>
                                setEditableRequerimiento({
                                  ...editableRequerimiento,
                                  estado: e.target.value
                                })
                              }
                              size="sm"
                            >
                              {estadosOptions.map((estado) => (
                                <option key={estado.value} value={estado.value}>
                                  {estado.label}
                                </option>
                              ))}
                            </Form.Control>
                          ) : (
                            <Badge bg={estados[r.estado] || "secondary"}>
                              {r.estado}
                            </Badge>
                          )}
                        </td>
                        <td>{r.observaciones}</td>
                        <td>
                          {editingId === r.id ? (
                            <div className="d-flex gap-1">
                              <Button
                                variant="success"
                                size="sm"
                                onClick={saveChanges}
                                disabled={loading}
                              >
                                {loading ? "..." : "Guardar"}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleCancelEdit}
                                disabled={loading}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEdit(r)}
                            >
                              Modificar
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {requerimientos.length === 0 && (
                      <tr>
                        <td colSpan="6" className="text-center">
                          No hay requerimientos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            );
          })
        ) : (
          <div className="text-muted">No hay requerimientos registrados.</div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RequerimientosModal;