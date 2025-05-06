import React, { useState } from "react";
import {
  Table,
  Spinner,
  Alert,
  Container,
  Form,
  Row,
  Col,
  Button,
  Card,
  Badge,
} from "react-bootstrap";
import apiRequest from "../services/api";
import DetalleModalAuditori from "./DetalleModalAuditori"; // importa el nuevo modal



const Auditoria = () => {
  const [modelo, setModelo] = useState("GrupoFamiliar");
  const [modeloId, setModeloId] = useState("");
  const [historial, setHistorial] = useState([]); // Siempre array
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detalleAnterior, setDetalleAnterior] = useState({});
  const [detalleNuevo, setDetalleNuevo] = useState({});
  const [showModal, setShowModal] = useState(false);

  const mostrarDetalle = (item) => {
    setDetalleAnterior(item.estado_anterior || {});
    setDetalleNuevo(item.estado_nuevo || {});
    setShowModal(true);
  };

  const buscar = async () => {
    setLoading(true);
    setError("");

    try {
        const res = await apiRequest(`historial/${modelo}/${modeloId}`, "GET");
        console.log("datos de historial", res.data);
        setHistorial(res.data || []);
    } catch (err) {
      console.error("API Error:", err);
      setError("Ocurrió un error al obtener el historial.");
      setHistorial([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <h3 className="my-4">Auditoría de Cambios</h3>

      {/* Formulario de búsqueda */}
      <Card className="mb-4 shadow-sm border-0">
        <Card.Body>
          <Row className="align-items-center">
            <Col md={5}>
              <Form.Select
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              >
                <option value="GrupoFamiliar">Grupo Familiar</option>
                <option value="Cliente">Cliente</option>
              </Form.Select>
            </Col>
            <Col md={5}>
              <Form.Control
                type="number"
                placeholder="ID del registro"
                value={modeloId}
                onChange={(e) => setModeloId(e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Button onClick={buscar} className="w-100">
                Buscar
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Indicadores de carga o error */}
      {loading && <Spinner animation="border" />}
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Tabla de resultados */}
      {historial.length > 0 ? (
        <Table bordered hover responsive>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Modelo</th>
              <th>ID</th>
              <th>Acción</th>
              <th>Usuario</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.created_at).toLocaleString()}</td>
                <td>{item.modelo_afectado}</td>
                <td>{item.modelo_id}</td>
                <td>
                  <Badge
                    bg={
                      item.accion === "delete"
                        ? "danger"
                        : item.accion === "update"
                        ? "warning"
                        : "info"
                    }
                  >
                    {item.accion?.toUpperCase()}
                  </Badge>
                </td>
                <td>{item.usuario}</td>
                <td>
                <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => mostrarDetalle(item)}
                    >
                    Ver detalle
                    </Button>

                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        !loading && !error && <p>No hay resultados.</p>
      )}
      <DetalleModalAuditori
  show={showModal}
  onHide={() => setShowModal(false)}
  anterior={detalleAnterior}
  nuevo={detalleNuevo}
/>

    </Container>
    
  );
};

export default Auditoria;
