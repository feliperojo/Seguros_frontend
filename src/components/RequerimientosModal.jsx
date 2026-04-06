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
  const pad2 = (n) => String(n).padStart(2, "0");

  // Fecha en formato YYYY-MM-DD (hora local), para enviar al backend sin cambiar contrato
  const getLocalISODate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const isoYmd = (valor) => {
    if (valor == null || valor === "") return "";
    const s = String(valor).split("T")[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
  };

  const isoDateToMDY = (iso) => {
    const ymd = isoYmd(iso);
    if (!ymd) return "";
    const [, m, d] = ymd.split("-");
    const y = ymd.slice(0, 4);
    return `${m}/${d}/${y}`;
  };

  /** Acepta MM/DD/AAAA, M/D/AAAA o YYYY-MM-DD; devuelve YYYY-MM-DD o "" si viene vacío, null si es inválido */
  const parseUserDateToISO = (s) => {
    const t = String(s == null ? "" : s).trim();
    if (!t) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const test = new Date(year, month - 1, day);
    if (test.getFullYear() !== year || test.getMonth() !== month - 1 || test.getDate() !== day) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
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

  const [fechaSolicitudInput, setFechaSolicitudInput] = useState(() =>
    isoDateToMDY(getLocalISODate())
  );
  const [fechaVencimientoInput, setFechaVencimientoInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");  // Manejo de errores
  const [success, setSuccess] = useState(""); // Mensaje de éxito
  const [editableRequerimiento, setEditableRequerimiento] = useState(null); // For storing the requerimiento being edited
  const [editingId, setEditingId] = useState(null); // ID del requerimiento que se está editando
  const [editFechaVencimientoInput, setEditFechaVencimientoInput] = useState("");

  useEffect(() => {
    if (show && grupoFamiliarId) {
      fetchCoberturas(grupoFamiliarId); // Cargar las coberturas cuando el modal se abre
    }
  }, [show, grupoFamiliarId]);

  // Cuando se abre el modal para crear un nuevo requerimiento, setear fecha_solicitud a la actual por defecto.
  // Si el usuario la cambia, se respeta hasta que cierre/guarde (no se re-sobrescribe mientras el modal siga abierto).
  useEffect(() => {
    if (!show) return;
    const hoyIso = getLocalISODate();
    setNuevo({
      documento_requerido: "",
      fecha_solicitud: hoyIso,
      fecha_vencimiento: "",
      observaciones: "",
      cobertura_id: [],
      estado: "Pendiente",
    });
    setFechaSolicitudInput(isoDateToMDY(hoyIso));
    setFechaVencimientoInput("");
    setEditFechaVencimientoInput("");
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
    const fvIso = isoYmd(requerimiento.fecha_vencimiento);
    setEditableRequerimiento({
      ...requerimiento,
      fecha_vencimiento: fvIso,
      estado: requerimiento.estado || "Pendiente",
      codigo_poliza: requerimiento.codigo_poliza || null
    });
    setEditFechaVencimientoInput(fvIso ? isoDateToMDY(fvIso) : "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditableRequerimiento(null);
    setEditFechaVencimientoInput("");
  };

  const saveChanges = async () => {
    const isoVenc = parseUserDateToISO(editFechaVencimientoInput);
    if (!editableRequerimiento.estado) {
      setError("Debe completar todos los campos obligatorios.");
      return;
    }
    if (!isoVenc) {
      setError("La fecha de vencimiento es obligatoria. Use MM/DD/AAAA.");
      return;
    }

    setLoading(true);
    try {
      // Buscar la cobertura para obtener el codigo_poliza si no está en editableRequerimiento
      const cobertura = coberturas.find(c => c.id === editableRequerimiento.cobertura_id);
      const codigoPoliza = editableRequerimiento.codigo_poliza || cobertura?.codigo_poliza || null;

      const updatedData = {
        fecha_vencimiento: isoVenc,
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
      setEditFechaVencimientoInput("");
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

    const isoSol = parseUserDateToISO(fechaSolicitudInput);
    if (!isoSol) {
      setError("Fecha de solicitud inválida. Use MM/DD/AAAA.");
      return;
    }
    const venRaw = fechaVencimientoInput.trim();
    const isoVen = venRaw ? parseUserDateToISO(fechaVencimientoInput) : "";
    if (venRaw && !isoVen) {
      setError("Fecha de vencimiento inválida. Use MM/DD/AAAA.");
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
          fecha_solicitud: isoSol,
          observaciones: nuevo.observaciones,
          fecha_vencimiento: isoVen || "",
          estado: nuevo.estado,
          codigo_poliza: codigoPoliza,
        };
  
        await apiRequest(`coberturas/${coberturaId}/documentos`, "POST", requestData);
      }
  
      setSuccess("Requerimientos creados exitosamente.");
      const hoyIso = getLocalISODate();
      setNuevo({
        documento_requerido: "",
        fecha_solicitud: hoyIso,
        fecha_vencimiento: "",
        observaciones: "",
        cobertura_id: [],
        estado: "Pendiente",
      });
      setFechaSolicitudInput(isoDateToMDY(hoyIso));
      setFechaVencimientoInput("");
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
                    type="text"
                    placeholder="MM/DD/AAAA"
                    autoComplete="off"
                    value={fechaSolicitudInput}
                    onChange={(e) => setFechaSolicitudInput(e.target.value)}
                    onBlur={() => {
                      const trimmed = String(fechaSolicitudInput).trim();
                      const iso = parseUserDateToISO(fechaSolicitudInput);
                      if (iso === null && trimmed !== "") {
                        setError("Fecha de solicitud inválida. Use MM/DD/AAAA.");
                        setFechaSolicitudInput(isoDateToMDY(nuevo.fecha_solicitud) || isoDateToMDY(getLocalISODate()));
                        return;
                      }
                      const hoyIso = getLocalISODate();
                      const next = iso || (trimmed === "" ? hoyIso : nuevo.fecha_solicitud);
                      setNuevo((prev) => ({ ...prev, fecha_solicitud: next }));
                      setFechaSolicitudInput(isoDateToMDY(next));
                    }}
                  />
                  <Form.Text className="text-muted">Mes/día/año (ej. 04/06/2026)</Form.Text>
                </div>

                <div style={{ flex: 1 }}>
                  <Form.Label>Fecha de vencimiento</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="MM/DD/AAAA"
                    autoComplete="off"
                    value={fechaVencimientoInput}
                    onChange={(e) => setFechaVencimientoInput(e.target.value)}
                    onBlur={() => {
                      const t = String(fechaVencimientoInput).trim();
                      if (!t) {
                        setNuevo((prev) => ({ ...prev, fecha_vencimiento: "" }));
                        setFechaVencimientoInput("");
                        return;
                      }
                      const iso = parseUserDateToISO(fechaVencimientoInput);
                      if (!iso) {
                        setError("Fecha de vencimiento inválida. Use MM/DD/AAAA.");
                        setFechaVencimientoInput(isoDateToMDY(nuevo.fecha_vencimiento));
                        return;
                      }
                      setNuevo((prev) => ({ ...prev, fecha_vencimiento: iso }));
                      setFechaVencimientoInput(isoDateToMDY(iso));
                    }}
                  />
                  <Form.Text className="text-muted">Opcional · Mes/día/año</Form.Text>
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
                              type="text"
                              placeholder="MM/DD/AAAA"
                              autoComplete="off"
                              value={editFechaVencimientoInput}
                              onChange={(e) => setEditFechaVencimientoInput(e.target.value)}
                              onBlur={() => {
                                const iso = parseUserDateToISO(editFechaVencimientoInput);
                                if (!iso) {
                                  if (String(editFechaVencimientoInput).trim() === "") {
                                    setEditableRequerimiento((prev) =>
                                      prev ? { ...prev, fecha_vencimiento: "" } : prev
                                    );
                                    return;
                                  }
                                  setError("Fecha de vencimiento inválida. Use MM/DD/AAAA.");
                                  setEditFechaVencimientoInput(
                                    isoDateToMDY(editableRequerimiento?.fecha_vencimiento || "")
                                  );
                                  return;
                                }
                                setEditableRequerimiento((prev) =>
                                  prev ? { ...prev, fecha_vencimiento: iso } : prev
                                );
                                setEditFechaVencimientoInput(isoDateToMDY(iso));
                              }}
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