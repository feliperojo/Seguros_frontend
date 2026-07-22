import React, { useEffect, useState } from "react";
import {
  Container,
  Card,
  Table,
  Badge,
  Button,
  Form,
  InputGroup,
  ButtonGroup,
  Dropdown,
} from "react-bootstrap";
import { FaSearch, FaEllipsisV } from "react-icons/fa";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import apiRequest from "../../services/api";
import PreRenovacionModal from "../../components/GrupoFamiliar/PreRenovacionModal";
import ConsolidarTodosModal from "../../components/GrupoFamiliar/ConsolidarTodosModal";
import "../../styles/GruposFamiliaresListado.css";

const ITEMS_PER_PAGE = 50;
const ANIO_DEFAULT = new Date().getFullYear() + 1;

const ESTADOS_FILTRO = [
  { key: "", label: "Todos" },
  { key: "pendiente", label: "Pendiente" },
  { key: "borrador", label: "En pre-renovación" },
  { key: "consolidado", label: "Renovado" },
];

const estadoBadge = (estado) => {
  switch (estado) {
    case "pendiente":
      return { label: "Pendiente", bg: "secondary" };
    case "borrador":
      return { label: "En pre-renovación", bg: "primary" };
    case "consolidado":
      return { label: "Renovado", bg: "success" };
    default:
      return { label: estado || "—", bg: "secondary" };
  }
};

const buildDetallePath = (id, estado, anioDestino) => {
  if (estado === "pendiente") {
    return `/grupo_familiar/${id}`;
  }
  return `/grupo_familiar/${id}?anio=${anioDestino}`;
};

const formatFecha = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const RenovacionesEstadoPage = () => {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [anioDestino, setAnioDestino] = useState(ANIO_DEFAULT);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [responsableFiltro, setResponsableFiltro] = useState("");
  const [responsablesOpciones, setResponsablesOpciones] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState({
    total: 0,
    last_page: 1,
    per_page: ITEMS_PER_PAGE,
    page: 1,
  });
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [showConsolidarTodos, setShowConsolidarTodos] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, estadoFiltro, anioDestino, responsableFiltro]);

  useEffect(() => {
    fetchData();
  }, [debouncedSearch, estadoFiltro, anioDestino, currentPage, responsableFiltro]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("per_page", String(ITEMS_PER_PAGE));
      params.set("anio_destino", String(anioDestino));

      if (estadoFiltro) {
        params.set("estado", estadoFiltro);
      }
      if (responsableFiltro) {
        params.set("responsable", responsableFiltro);
      }
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }

      const response = await apiRequest(
        `grupo_familiar/renovaciones-estado?${params.toString()}`,
        "GET"
      );

      if (response?.status === "success" && Array.isArray(response.data)) {
        setFilas(response.data);
        setResponsablesOpciones(
          Array.isArray(response?.filtros?.responsables)
            ? response.filtros.responsables
            : []
        );
        setPaginationMeta(
          response.meta || {
            total: response.data.length,
            last_page: 1,
            per_page: ITEMS_PER_PAGE,
            page: currentPage,
          }
        );
      } else {
        setFilas([]);
        setResponsablesOpciones([]);
        setPaginationMeta({
          total: 0,
          last_page: 1,
          per_page: ITEMS_PER_PAGE,
          page: 1,
        });
      }
    } catch (error) {
      console.error("Error al cargar estado de renovaciones:", error);
      alert("Error al cargar el estado de renovaciones. Intente nuevamente.");
      setFilas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarBorrador = async (fila) => {
    const confirmado = window.confirm(
      `¿Eliminar la pre-renovación del grupo #${fila.id}? Se perderá todo lo que se haya guardado ahí (no afecta las coberturas reales de ${anioDestino - 1}).`
    );
    if (!confirmado) return;

    try {
      await apiRequest(
        `/grupo_familiar/${fila.id}/pre-renovacion/${fila.lote_id}`,
        "DELETE"
      );
      await fetchData();
    } catch (error) {
      console.error("Error al eliminar la pre-renovación:", error);
      alert(
        error?.response?.data?.message || "No se pudo eliminar la pre-renovación."
      );
    }
  };

  const totalFiltered = paginationMeta.total ?? 0;
  const totalPages = Math.max(1, paginationMeta.last_page ?? 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const rangeStart =
    totalFiltered === 0 ? 0 : (safeCurrentPage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(safeCurrentPage * ITEMS_PER_PAGE, totalFiltered);

  return (
    <Container fluid className="py-4">
      <Helmet>
        <title>Vantun / Renovaciones</title>
      </Helmet>

      <div className="mb-4">
        <h3 className="mb-2 fw-bold text-dark">Estado de renovaciones</h3>
        <p
          className="text-muted mb-0"
          style={{ fontSize: "0.95rem", lineHeight: 1.5 }}
        >
          Vista administrativa del estado de renovación de cada grupo familiar
          para el año destino seleccionado.
        </p>
      </div>

      <Card className="shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex flex-column flex-md-row gap-3 mb-3">
            <div className="flex-grow-1">
              <InputGroup>
                <Form.Control
                  placeholder="Buscar por ID, responsable, contacto o nombre de miembro…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button variant="outline-secondary">
                  <FaSearch />
                </Button>
              </InputGroup>
            </div>
            <div style={{ minWidth: "200px" }}>
              <Form.Select
                value={responsableFiltro}
                onChange={(e) => setResponsableFiltro(e.target.value)}
                aria-label="Filtrar por responsable"
              >
                <option value="">Todos los responsables</option>
                <option value="__sin_responsable__">Sin responsable</option>
                {responsablesOpciones.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </Form.Select>
            </div>
            <div style={{ minWidth: "140px" }}>
              <Form.Control
                type="number"
                min={2000}
                max={2100}
                value={anioDestino}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) setAnioDestino(next);
                }}
                aria-label="Año destino"
              />
            </div>
            <div>
              <Button
                variant="danger"
                onClick={() => setShowConsolidarTodos(true)}
              >
                Consolidar todas las pre-renovaciones
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <ButtonGroup>
              {ESTADOS_FILTRO.map((opt) => (
                <Button
                  key={opt.key || "todos"}
                  variant={
                    estadoFiltro === opt.key ? "primary" : "outline-secondary"
                  }
                  size="sm"
                  onClick={() => setEstadoFiltro(opt.key)}
                >
                  {opt.label}
                </Button>
              ))}
            </ButtonGroup>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="mt-3">Cargando renovaciones...</p>
            </div>
          ) : filas.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted mb-0">
                No se encontraron grupos para el año {anioDestino}
              </p>
            </div>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3 text-muted small">
                <span>
                  Mostrando {rangeStart}–{rangeEnd} de {totalFiltered} grupo
                  {totalFiltered !== 1 ? "s" : ""}
                </span>
                <span>
                  Página {safeCurrentPage} de {totalPages}
                </span>
              </div>

              <div className="table-responsive">
                <Table hover className="align-middle">
                  <thead>
                    <tr>
                      <th>GRUPO</th>
                      <th>RESPONSABLE</th>
                      <th>PRODUCTO</th>
                      <th>MIEMBROS ACTIVOS</th>
                      <th>ESTADO</th>
                      <th>DETALLE</th>
                      <th className="text-center">ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((fila) => {
                      const badge = estadoBadge(fila.estado_renovacion);
                      return (
                        <tr key={fila.id}>
                          <td>
                            <div className="fw-semibold">#{fila.id}</div>
                            <div className="text-muted small">
                              {fila.tomador_nombre &&
                              fila.tomador_nombre !== "Sin asignar"
                                ? fila.tomador_nombre
                                : fila.persona_contacto || "Sin asignar"}
                            </div>
                          </td>
                          <td>
                            <span className="text-muted">
                              {fila.responsable?.trim()
                                ? fila.responsable
                                : "Sin responsable"}
                            </span>
                          </td>
                          <td>
                            <span className="text-muted">
                              {fila.producto || "-"}
                            </span>
                          </td>
                          <td>
                            <span className="badge rounded-circle bg-info text-white me-1">
                              {fila.miembros_activos ?? 0}
                            </span>
                            <span className="text-muted">activos</span>
                          </td>
                          <td>
                            <Badge pill bg={badge.bg}>
                              {badge.label}
                            </Badge>
                          </td>
                          <td>
                            {fila.estado_renovacion === "borrador" ? (
                              <div>
                                <div>
                                  {fila.items_renovar ?? 0} a renovar /{" "}
                                  {fila.items_omitir ?? 0}{" "}
                                  {(fila.items_omitir ?? 0) === 1
                                    ? "retirado"
                                    : "retirados"}
                                </div>
                                <div className="text-muted small">
                                  Actualizado:{" "}
                                  {formatFecha(fila.lote_actualizado_en)}
                                </div>
                              </div>
                            ) : fila.estado_renovacion === "consolidado" ? (
                              <span className="text-muted small">
                                Actualizado:{" "}
                                {formatFecha(fila.lote_actualizado_en)}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="text-center">
                            <Dropdown align="end">
                              <Dropdown.Toggle
                                variant="outline-secondary"
                                size="sm"
                                id={`acciones-grupo-${fila.id}`}
                              >
                                <FaEllipsisV className="me-1" /> Acciones
                              </Dropdown.Toggle>
                              <Dropdown.Menu>
                                <Dropdown.Item
                                  as={Link}
                                  to={buildDetallePath(
                                    fila.id,
                                    fila.estado_renovacion,
                                    anioDestino
                                  )}
                                >
                                  Ver grupo
                                </Dropdown.Item>
                                {fila.estado_renovacion === "pendiente" && (
                                  <Dropdown.Item
                                    onClick={() =>
                                      setGrupoSeleccionado({ id: fila.id })
                                    }
                                  >
                                    Generar pre-renovación
                                  </Dropdown.Item>
                                )}
                                {fila.estado_renovacion === "borrador" && (
                                  <Dropdown.Item
                                    onClick={() =>
                                      setGrupoSeleccionado({ id: fila.id })
                                    }
                                  >
                                    Gestionar pre-renovación
                                  </Dropdown.Item>
                                )}
                                {fila.estado_renovacion === "borrador" && (
                                  <Dropdown.Item
                                    className="text-danger"
                                    onClick={() => handleEliminarBorrador(fila)}
                                  >
                                    Eliminar pre-renovación
                                  </Dropdown.Item>
                                )}
                              </Dropdown.Menu>
                            </Dropdown>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="d-flex justify-content-center gap-2 mt-3">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={safeCurrentPage <= 1 || loading}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={safeCurrentPage >= totalPages || loading}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      <PreRenovacionModal
        show={!!grupoSeleccionado}
        onHide={() => setGrupoSeleccionado(null)}
        grupoFamiliarId={grupoSeleccionado?.id}
        anioDestino={anioDestino}
        onAfterConsolidar={async () => {
          setGrupoSeleccionado(null);
          await fetchData();
        }}
      />

      <ConsolidarTodosModal
        show={showConsolidarTodos}
        onHide={() => setShowConsolidarTodos(false)}
        anioDestino={anioDestino}
        onAfterConsolidar={async () => {
          setShowConsolidarTodos(false);
          await fetchData();
        }}
      />
    </Container>
  );
};

export default RenovacionesEstadoPage;
