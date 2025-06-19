import React, { useEffect, useState } from "react";
import { Modal, Button, Form, Table, Badge } from "react-bootstrap";
import apiRequest from "../services/api"; // Asumiendo que usas este servicio para tus requests

const estados = {
  pendiente: "warning",
  enviado: "info",
  aprobado: "success",
  rechazado: "danger",
};

const RequerimientosModal = ({ show, onHide, grupoFamiliarId }) => {
  
  
  
  console.log(grupoFamiliarId);
    const [requerimientos, setRequerimientos] = useState([]);

  const [coberturas, setCoberturas] = useState([]);
  const [nuevo, setNuevo] = useState({
    documento_requerido: "",
    fecha_solicitud: "",
    observaciones: "",
    cobertura_id: "", // Agregar el campo de cobertura
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show && grupoFamiliarId) {
      fetchCoberturas(grupoFamiliarId); // Cargar las coberturas cuando el modal se abre
    }
  }, [show, grupoFamiliarId]);

  // Obtener las coberturas activas asociadas al grupo familiar
  const fetchCoberturas = async (grupoFamiliarId) => {
    try {
      const response = await apiRequest(`cobertura/grupo_familiar/${grupoFamiliarId}/coberturas`, "GET");
      console.log("coberturas", response);
      const activeCoberturas = response.filter(cobertura => cobertura.activo); // Filtrar solo coberturas activas
      setCoberturas(activeCoberturas);

      // Si hay coberturas activas, seleccionar la primera como predeterminada
      if (activeCoberturas.length > 0) {
        setNuevo(prev => ({ ...prev, cobertura_id: activeCoberturas[0].id }));
      }

      fetchRequerimientos(activeCoberturas[0]?.id); // Obtener los requerimientos para la primera cobertura
    } catch (error) {
      console.error("Error al cargar coberturas:", error);
    }
  };

  // Obtener los requerimientos de documentos de la cobertura seleccionada
  const fetchRequerimientos = async (coberturaId) => {
    if (!coberturaId) return;

    const res = await apiRequest(`coberturas/${coberturaId}/documentos`, "GET");
    setRequerimientos(res);
  };

  // Crear un nuevo requerimiento de documento
  const crearRequerimiento = async () => {
    if (!nuevo.documento_requerido || !nuevo.cobertura_id) return;
    setLoading(true);
    await apiRequest(`coberturas/${nuevo.cobertura_id}/documentos`, "POST", nuevo);
    setNuevo({ documento_requerido: "", fecha_solicitud: "", observaciones: "", cobertura_id: "" });
    fetchRequerimientos(nuevo.cobertura_id);
    setLoading(false);
  };

  // Actualizar el estado de un requerimiento
  const actualizarEstado = async (id, estado) => {
    await apiRequest(`/documentos/${id}`, "PUT", { estado });
    fetchRequerimientos(nuevo.cobertura_id); // Actualizar los requerimientos
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Requerimientos de Documentos</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h6>Agregar nuevo requerimiento</h6>
        <Form className="mb-3">
          <Form.Group>
            <Form.Label>Seleccionar Cobertura</Form.Label>
            <Form.Control
              as="select"
              value={nuevo.cobertura_id}
              onChange={(e) =>
                setNuevo({ ...nuevo, cobertura_id: e.target.value })
              }
            >
              {coberturas.map((cobertura) => (
                <option key={cobertura.id} value={cobertura.id}>
                  {cobertura.compania?.nombre || "Sin compañía"} - {cobertura.plan}
                </option>
              ))}
            </Form.Control>
          </Form.Group>

          <Form.Group>
            <Form.Label>Documento requerido</Form.Label>
            <Form.Control
              type="text"
              value={nuevo.documento_requerido}
              onChange={(e) =>
                setNuevo({ ...nuevo, documento_requerido: e.target.value })
              }
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Fecha de solicitud</Form.Label>
            <Form.Control
              type="date"
              value={nuevo.fecha_solicitud}
              onChange={(e) =>
                setNuevo({ ...nuevo, fecha_solicitud: e.target.value })
              }
            />
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
            Guardar
          </Button>
        </Form>

        <h6>Historial de requerimientos</h6>
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Documento</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Observaciones</th>
              <th>Cambiar estado</th>
            </tr>
          </thead>
          <tbody>
            {requerimientos.map((r) => (
              <tr key={r.id}>
                <td>{r.documento_requerido}</td>
                <td>{r.fecha_solicitud || "-"}</td>
                <td>
                  <Badge bg={estados[r.estado] || "secondary"}>
                    {r.estado}
                  </Badge>
                </td>
                <td>{r.observaciones}</td>
                <td>
                  <Form.Select
                    size="sm"
                    value={r.estado}
                    onChange={(e) => actualizarEstado(r.id, e.target.value)}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="enviado">Enviado</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="rechazado">Rechazado</option>
                  </Form.Select>
                </td>
              </tr>
            ))}
            {requerimientos.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center">
                  No hay requerimientos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
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
