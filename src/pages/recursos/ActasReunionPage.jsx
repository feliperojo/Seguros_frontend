import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Col,
  Form,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { FaArchive, FaEdit, FaPlus } from "react-icons/fa";
import { actasService, ACTA_ESTADOS } from "../../services/actasService";
import { highlightMentions } from "../../utils/mentions";
import "../../styles/Recursos.css";

const estadoBadge = (estado) => {
  const map = {
    borrador: "secondary",
    publicada: "success",
    archivada: "dark",
  };
  return <Badge bg={map[estado] || "light"}>{estado || "—"}</Badge>;
};

const stripHtmlPreview = (html) => {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = (div.textContent || "").trim();
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
};

const ActasReunionPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filtroEstado) params.estado = filtroEstado;
      if (busqueda.trim()) params.q = busqueda.trim();
      const { items: lista } = await actasService.list(params);
      setItems(lista);
    } catch (e) {
      const msg = e?.message || "No se pudieron cargar las actas";
      const is404 = e?.response?.status === 404;
      setError(
        is404
          ? "El módulo de actas aún no está disponible en el servidor. Solicita al equipo backend los endpoints bajo recursos/actas."
          : msg
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, busqueda]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const archivar = async (id) => {
    if (!window.confirm("¿Archivar esta acta?")) return;
    try {
      await actasService.archivar(id);
      cargar();
    } catch (e) {
      alert(e?.message || "No se pudo archivar");
    }
  };

  return (
    <div className="recursos-page">
      <div className="recursos-page-header">
        <div>
          <h2 className="mb-1">Actas de reunión</h2>
          <p className="text-muted mb-0">
            Registro de reuniones con el equipo, menciones a colaboradores y archivo histórico.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate("/recursos/actas/nueva")}
        >
          <FaPlus className="me-1" /> Nueva acta
        </Button>
      </div>

      <Row className="mb-3 g-2">
        <Col md={4}>
          <Form.Control
            placeholder="Buscar por título..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </Col>
        <Col md={3}>
          <Form.Select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value={ACTA_ESTADOS.BORRADOR}>Borrador</option>
            <option value={ACTA_ESTADOS.PUBLICADA}>Publicada</option>
            <option value={ACTA_ESTADOS.ARCHIVADA}>Archivada</option>
          </Form.Select>
        </Col>
        <Col md="auto">
          <Button variant="outline-secondary" onClick={cargar}>
            Actualizar
          </Button>
        </Col>
      </Row>

      {error && (
        <Alert variant="warning" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <Alert variant="info">
          No hay actas registradas. Crea la primera acta de reunión con el botón superior.
        </Alert>
      ) : (
        <Table responsive hover bordered className="bg-white">
          <thead>
            <tr>
              <th>Fecha reunión</th>
              <th>Título</th>
              <th>Estado</th>
              <th>Resumen</th>
              <th style={{ width: 140 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((acta) => (
              <tr key={acta.id}>
                <td>{acta.fecha_reunion || acta.meeting_date || "—"}</td>
                <td>{acta.titulo || acta.title || "Sin título"}</td>
                <td>{estadoBadge(acta.estado)}</td>
                <td className="acta-contenido-preview small text-muted">
                  {acta.contenido ? (
                    <span
                      dangerouslySetInnerHTML={{
                        __html: highlightMentions(
                          stripHtmlPreview(acta.contenido)
                        ),
                      }}
                    />
                  ) : (
                    stripHtmlPreview(acta.contenido)
                  )}
                </td>
                <td>
                  <Button
                    as={Link}
                    to={`/recursos/actas/${acta.id}`}
                    variant="outline-primary"
                    size="sm"
                    className="me-1"
                    title="Editar"
                  >
                    <FaEdit />
                  </Button>
                  {acta.estado !== ACTA_ESTADOS.ARCHIVADA && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      title="Archivar"
                      onClick={() => archivar(acta.id)}
                    >
                      <FaArchive />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default ActasReunionPage;
