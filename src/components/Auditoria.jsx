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
import DetalleModalAuditori from "./DetalleModalAuditori"; // Modal actualizado para mostrar todo el historial
import { formatDateTimeForDisplay } from "../utils/formatters";

const Auditoria = () => {
  const [modelo, setModelo] = useState("GrupoFamiliar");
  const [modeloId, setModeloId] = useState("");
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

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

  const abrirModalHistorial = () => {
    if (historial.length > 0) {
      setShowModal(true);
    }
  };

  return (
    <Container>
      <h3 className="my-4">Auditoría de Cambios</h3>

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

      {loading && <Spinner animation="border" />}
      {error && <Alert variant="danger">{error}</Alert>}

      {historial.length > 0 ? (
        <>
          <Table bordered hover responsive>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Modelo</th>
                <th>ID</th>
                <th>Acción</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTimeForDisplay(item.created_at)}</td>
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
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="text-end mt-3">
            <Button variant="primary" onClick={abrirModalHistorial}>
              Ver historial completo
            </Button>
          </div>
        </>
      ) : (
        !loading && !error && <p>No hay resultados.</p>
      )}

      <DetalleModalAuditori
        show={showModal}
        onHide={() => setShowModal(false)}
        historial={historial}
      />
    </Container>
  );
};

export default Auditoria;
