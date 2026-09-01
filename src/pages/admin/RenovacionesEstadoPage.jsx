import { useCallback, useEffect, useState } from "react";
import {
  Container,
  Table,
  Badge,
  Button,
  Form,
  InputGroup,
  Dropdown,
  Row,
  Col,
  Alert,
} from "react-bootstrap";
import {
  FaSearch,
  FaEllipsisV,
  FaSync,
  FaFilter,
  FaClipboardList,
  FaTable,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import apiRequest from "../../services/api";
import PreRenovacionModal from "../../components/GrupoFamiliar/PreRenovacionModal";
import ConsolidarTodosModal from "../../components/GrupoFamiliar/ConsolidarTodosModal";
import {
  estadoGestionBadge,
  estadoRenovacionBadge,
  ESTADOS_GESTION_OPTIONS,
} from "../../utils/renovacionEstadoGestion";
import "../../styles/GruposFamiliaresListado.css";

const ITEMS_PER_PAGE = 50;
const ANIO_DEFAULT = new Date().getFullYear() + 1;

const ESTADOS_FILTRO = [
  { key: "", label: "Todos" },
  { key: "pendiente", label: "Pendiente" },
  { key: "borrador", label: "En pre-renovación" },
  { key: "consolidado", label: "Consolidado" },
  { key: "sin_cobertura_activa", label: "Grupo inactivo" },
];

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
  const [error, setError] = useState(null);
  const [hasConsultado, setHasConsultado] = useState(false);
  const [anioDestino, setAnioDestino] = useState(ANIO_DEFAULT);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [estadoGestionFiltro, setEstadoGestionFiltro] = useState("");
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
  }, [debouncedSearch, estadoFiltro, estadoGestionFiltro, anioDestino, responsableFiltro]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("per_page", String(ITEMS_PER_PAGE));
      params.set("anio_destino", String(anioDestino));

      if (estadoFiltro) {
        params.set("estado", estadoFiltro);
      }
      if (estadoGestionFiltro) {
        params.set("estado_gestion", estadoGestionFiltro);
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
    } catch (requestError) {
      console.error("Error al cargar estado de renovaciones:", requestError);
      const message =
        requestError?.response?.data?.message ||
        "Error al cargar el estado de renovaciones. Intente nuevamente.";
      setError(message);
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [
    anioDestino,
    currentPage,
    debouncedSearch,
    estadoFiltro,
    estadoGestionFiltro,
    responsableFiltro,
  ]);

  useEffect(() => {
    if (!hasConsultado) return;
    fetchData();
  }, [hasConsultado, fetchData]);

  const handleConsultar = () => {
    if (!hasConsultado) {
      setHasConsultado(true);
      return;
    }
    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }
    fetchData();
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
    } catch (requestError) {
      console.error("Error al eliminar la pre-renovación:", requestError);
      alert(
        requestError?.response?.data?.message ||
          "No se pudo eliminar la pre-renovación."
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
    <Container fluid className="gf-listado-container py-3">
      <Helmet>
        <title>Vantun / Renovaciones</title>
      </Helmet>

      <div className="gf-listado">
        <div className="gf-listado__header gf-listado__header--split">
          <div className="gf-listado__header-main">
            <div className="gf-listado__header-icon" aria-hidden="true">
              <FaClipboardList />
            </div>
            <div>
              <h1 className="gf-listado__title">Estado de renovaciones</h1>
              <p className="gf-listado__subtitle">
                Vista administrativa del estado de renovación de cada grupo
                familiar para el año destino seleccionado.
              </p>
            </div>
          </div>
          <div className="gf-listado__header-actions">
            {hasConsultado && (
              <span className="gf-listado__chip">
                {loading ? "Consultando…" : `${totalFiltered} grupo${totalFiltered !== 1 ? "s" : ""}`}
              </span>
            )}
            <Button
              size="sm"
              className="gf-listado__btn-ghost"
              onClick={handleConsultar}
              disabled={loading}
            >
              <FaSync className={loading ? "fa-spin me-1" : "me-1"} />
              {hasConsultado ? "Actualizar" : "Consultar"}
            </Button>
            <Button
              size="sm"
              className="gf-listado__btn-header gf-listado__btn-header--danger"
              onClick={() => setShowConsolidarTodos(true)}
            >
              Consolidar todas
            </Button>
          </div>
        </div>

        <div className="gf-listado__body">
          <div className="gf-listado__section">
            <div className="gf-listado__section-title">
              <FaFilter aria-hidden="true" />
              Filtros
            </div>

            <Row className="g-3 align-items-end">
              <Col xs={12} lg={5}>
                <div className="gf-listado__label">Buscar</div>
                <InputGroup>
                  <Form.Control
                    placeholder="Buscar por ID, responsable, contacto o nombre de miembro…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleConsultar();
                      }
                    }}
                  />
                  <Button
                    variant="outline-secondary"
                    className="gf-listado__btn-icon"
                    onClick={handleConsultar}
                    disabled={loading}
                    aria-label="Consultar"
                  >
                    <FaSearch />
                  </Button>
                </InputGroup>
              </Col>
              <Col xs={12} sm={6} lg={3}>
                <div className="gf-listado__label">Responsable</div>
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
              </Col>
              <Col xs={12} sm={6} lg={2}>
                <div className="gf-listado__label">Año destino</div>
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
              </Col>
              <Col xs={12} lg={2}>
                <Button
                  className="w-100 gf-listado__btn-primary"
                  onClick={handleConsultar}
                  disabled={loading}
                >
                  {loading ? "Consultando…" : "Consultar"}
                </Button>
              </Col>
            </Row>

            <div className="mt-3">
              <div className="gf-listado__label mb-2">Estado de renovación</div>
              <div className="gf-listado__filter-pills">
                {ESTADOS_FILTRO.map((opt) => (
                  <button
                    key={opt.key || "todos"}
                    type="button"
                    className={`gf-listado__filter-pill${
                      estadoFiltro === opt.key ? " is-active" : ""
                    }`}
                    onClick={() => setEstadoFiltro(opt.key)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="gf-listado__label mb-2">Estado de gestión</div>
              <div className="gf-listado__filter-pills">
                <button
                  type="button"
                  className={`gf-listado__filter-pill${
                    estadoGestionFiltro === "" ? " is-active" : ""
                  }`}
                  onClick={() => setEstadoGestionFiltro("")}
                >
                  Todos
                </button>
                {ESTADOS_GESTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`gf-listado__filter-pill${
                      estadoGestionFiltro === opt.value ? " is-active" : ""
                    }`}
                    onClick={() => setEstadoGestionFiltro(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="gf-listado__section gf-listado__section--table">
            <div className="gf-listado__section-title">
              <FaTable aria-hidden="true" />
              Resultados
            </div>

            {error && (
              <Alert variant="danger" className="mb-3">
                {error}
              </Alert>
            )}

            {!hasConsultado ? (
              <div className="gf-listado__intro">
                <p className="mb-2">
                  Seleccione el <strong>año destino</strong> y los filtros que
                  necesite, luego pulse <strong>Consultar</strong>.
                </p>
                <p className="mb-0 small">
                  Así evitamos consultas automáticas al entrar a la vista. Una
                  vez cargada, los cambios de filtro y paginación actualizarán
                  los resultados.
                </p>
              </div>
            ) : loading ? (
              <div className="text-center py-5">
                <div
                  className="spinner-border"
                  style={{ color: "#1a365d" }}
                  role="status"
                >
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-3 text-muted small mb-0">
                  Cargando renovaciones…
                </p>
              </div>
            ) : filas.length === 0 ? (
              <div className="gf-listado__empty">
                No se encontraron grupos para el año {anioDestino}
              </div>
            ) : (
              <>
                <div className="d-flex justify-content-between align-items-center gf-listado__summary">
                  <span>
                    Mostrando <strong>{rangeStart}–{rangeEnd}</strong> de{" "}
                    <strong>{totalFiltered}</strong> grupo
                    {totalFiltered !== 1 ? "s" : ""}
                  </span>
                  <span>
                    Página <strong>{safeCurrentPage}</strong> de{" "}
                    <strong>{totalPages}</strong>
                  </span>
                </div>

                <div className="gf-listado__table-wrap table-responsive">
                  <Table hover className="align-middle gf-listado__table mb-0">
                    <thead>
                      <tr>
                        <th>Grupo</th>
                        <th>Responsable</th>
                        <th>Producto</th>
                        <th>Miembros activos</th>
                        <th>Estado</th>
                        <th>Estado de gestión</th>
                        <th>Detalle</th>
                        <th className="text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((fila) => {
                        const badge = estadoRenovacionBadge(
                          fila.estado_renovacion
                        );
                        const badgeGestion = estadoGestionBadge(
                          fila.estado_gestion
                        );
                        const sinCoberturaActiva =
                          (fila.miembros_activos ?? 0) === 0;
                        const grupoInactivo = sinCoberturaActiva;

                        return (
                          <tr
                            key={fila.id}
                            className={
                              grupoInactivo ? "table-warning" : undefined
                            }
                          >
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
                              <span className="gf-listado__producto">
                                {fila.producto || "—"}
                              </span>
                            </td>
                            <td>
                              <span className="badge rounded-circle bg-info text-white me-1">
                                {fila.miembros_activos ?? 0}
                              </span>
                              <span className="text-muted small">activos</span>
                              {grupoInactivo && (
                                <>
                                  <Badge
                                    bg="warning"
                                    text="dark"
                                    className="ms-1"
                                  >
                                    Grupo inactivo
                                  </Badge>
                                  {fila.ultima_ano_cobertura != null && (
                                    <div className="text-muted small mt-1">
                                      Última cobertura:{" "}
                                      {fila.ultima_ano_cobertura}
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                            <td>
                              <Badge pill bg={badge.bg}>
                                {badge.label}
                              </Badge>
                            </td>
                            <td>
                              <Badge pill bg={badgeGestion.bg}>
                                {badgeGestion.label}
                              </Badge>
                            </td>
                            <td>
                              {fila.estado_renovacion === "borrador" ? (
                                <div className="small">
                                  <div>
                                    {fila.items_renovar ?? 0} a renovar /{" "}
                                    {fila.items_omitir ?? 0}{" "}
                                    {(fila.items_omitir ?? 0) === 1
                                      ? "retirado"
                                      : "retirados"}
                                  </div>
                                  <div className="text-muted">
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
                            <td className="text-center gf-listado__actions">
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
                                      onClick={() =>
                                        handleEliminarBorrador(fila)
                                      }
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
                      className="gf-listado__btn-icon"
                      disabled={safeCurrentPage <= 1 || loading}
                      onClick={() =>
                        setCurrentPage((p) => Math.max(1, p - 1))
                      }
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="gf-listado__btn-icon"
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
          </div>
        </div>
      </div>

      <PreRenovacionModal
        show={!!grupoSeleccionado}
        onHide={() => setGrupoSeleccionado(null)}
        grupoFamiliarId={grupoSeleccionado?.id}
        anioDestino={anioDestino}
        onAfterConsolidar={async () => {
          setGrupoSeleccionado(null);
          if (hasConsultado) await fetchData();
        }}
      />

      <ConsolidarTodosModal
        show={showConsolidarTodos}
        onHide={() => setShowConsolidarTodos(false)}
        anioDestino={anioDestino}
        onAfterConsolidar={async () => {
          setShowConsolidarTodos(false);
          if (hasConsultado) await fetchData();
        }}
      />
    </Container>
  );
};

export default RenovacionesEstadoPage;
