import React, { useEffect, useState } from "react";
import { Modal, Spinner, Badge, Button, Form, Card } from "react-bootstrap";
import apiRequest from "../../services/api";

const HistorialClienteModal = ({ show, onHide, clienteId, clienteNombre }) => {
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [filteredHistorial, setFilteredHistorial] = useState([]);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const statusBadge = (status) => {
    switch (status) {
      case "pending":
        return <Badge bg="warning">Pendiente</Badge>;
      case "in_progress":
        return <Badge bg="info">En Progreso</Badge>;
      case "completed":
        return <Badge bg="success">Completada</Badge>;
      default:
        return null;
    }
  };

  const fetchHistorial = async () => {
    if (!clienteId) return;
    setLoading(true);
    try {
      const response = await apiRequest(`cliente/${clienteId}/historial`, "GET");
      const historialData = Array.isArray(response.data) ? response.data : [];
      setHistorial(historialData);
      setFilteredHistorial(historialData);
    } catch (error) {
      console.error("Error cargando historial:", error);
      setHistorial([]);
      setFilteredHistorial([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchHistorial();
      setFechaInicio("");
      setFechaFin("");
      setSearchTerm("");
    }
  }, [show, clienteId]);

  useEffect(() => {
    let filtered = [...historial];
    if (fechaInicio) filtered = filtered.filter((item) => new Date(item.fecha) >= new Date(fechaInicio));
    if (fechaFin) filtered = filtered.filter((item) => new Date(item.fecha) <= new Date(fechaFin));
    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.nota?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.concepto?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredHistorial(filtered);
  }, [fechaInicio, fechaFin, searchTerm, historial]);

  const aplicarFiltroRapido = (dias) => {
    const hoy = new Date();
    const inicio = new Date();
    inicio.setDate(hoy.getDate() - dias);
    setFechaInicio(inicio.toISOString().split("T")[0]);
    setFechaFin(hoy.toISOString().split("T")[0]);
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>📜 Historial de {clienteNombre}</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: "600px", overflowY: "auto", backgroundColor: "#f8f9fa" }}>
        {/* Filtros */}
        <div className="mb-3 d-flex flex-wrap gap-2 align-items-end">
          <Form.Group>
            <Form.Label>Desde</Form.Label>
            <Form.Control type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Hasta</Form.Label>
            <Form.Control type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </Form.Group>
          <Form.Group style={{ flex: "1" }}>
            <Form.Label>Búsqueda</Form.Label>
            <Form.Control
              type="text"
              placeholder="Buscar por concepto o nota..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Form.Group>
          <div className="d-flex gap-1">
            <Button variant="outline-primary" size="sm" onClick={() => aplicarFiltroRapido(7)}>
              Últimos 7 días
            </Button>
            <Button variant="outline-primary" size="sm" onClick={() => aplicarFiltroRapido(15)}>
              15 días
            </Button>
            <Button variant="outline-primary" size="sm" onClick={() => aplicarFiltroRapido(30)}>
              30 días
            </Button>
          </div>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2">Cargando historial...</p>
          </div>
        ) : Array.isArray(filteredHistorial) && filteredHistorial.length > 0 ? (
          <div className="d-flex flex-column gap-3">
            {filteredHistorial.map((item, index) => (
              <Card key={index} className="shadow-sm border-0">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-1">
                      {item.tipo === "tarea" ? "📌 Tarea" : "📝 Acción"}:{" "}
                      <span style={{ fontWeight: "bold" }}>{item.concepto}</span>
                    </h6>
                    {item.estado && statusBadge(item.estado)}
                  </div>
                  <p className="mb-1 text-muted">{item.nota || "Sin detalles"}</p>
                  <small className="text-secondary">
                    <b>Usuario:</b> {item.usuario}
                    {item.asignado_a && ` | Asignado a: ${item.asignado_a}`} <br />
                    <b>Fecha:</b> {new Date(item.fecha).toLocaleString()}
                  </small>

                  {/* Comentarios */}
                  {item.tipo === "tarea" && item.comentarios && item.comentarios.length > 0 && (
                    <div className="mt-3 p-2 rounded bg-light border">
                      <strong>💬 Comentarios:</strong>
                      {item.comentarios.map((c, i) => (
                        <div key={i} className="small text-muted border-bottom pb-1 mb-1">
                          <b>{c.user}</b> ({c.fecha}): {c.comment}
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted">No hay historial disponible</p>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default HistorialClienteModal;
