import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import { FaExclamationTriangle, FaShieldAlt, FaSearch, FaSync } from "react-icons/fa";
import { Link, useSearchParams } from "react-router-dom";
import Pagination from "../components/Pagination";
import { getReporteEstadoCoberturas } from "../services/reportesService";
import { formatDateMMDDYYYY } from "../utils/formatters";

const DEFAULT_FILTERS = {
  page: 1,
  per_page: 25,
  search: "",
  estado_cobertura: "todos",
  sort_by: "grupo_familiar_id",
  sort_dir: "desc",
};

const CLIENTE_FICHA_PATH = (id) => `/clientes/${id}/ficha`;
const GRUPO_FICHA_PATH = (id) => `/grupo_familiar/${id}`;

const formatDate = (value) => {
  if (!value) return "—";
  const formatted = formatDateMMDDYYYY(value);
  return formatted || "—";
};

const renderGrupoLink = (grupoId) => {
  if (!grupoId) return "—";
  return (
    <Link
      to={GRUPO_FICHA_PATH(grupoId)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-decoration-none fw-semibold"
      title={`Ver grupo familiar #${grupoId}`}
    >
      {grupoId}
    </Link>
  );
};

const renderClienteLink = (clienteId, label) => {
  if (!clienteId) return label || "—";
  return (
    <Link
      to={CLIENTE_FICHA_PATH(clienteId)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-decoration-none"
      title="Ver ficha del cliente"
    >
      {label || "—"}
    </Link>
  );
};

const ReporteEstadoCoberturasPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    search: searchParams.get("search") || "",
    estado_cobertura: searchParams.get("estado_cobertura") || "todos",
  }));
  const [searchInput, setSearchInput] = useState(filters.search);
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ page: 1, per_page: 25, total: 0, last_page: 1 });
  const [resumen, setResumen] = useState({ total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  const queryParams = useMemo(
    () => ({
      page: filters.page,
      per_page: filters.per_page,
      search: filters.search || undefined,
      estado_cobertura:
        filters.estado_cobertura !== "todos" ? filters.estado_cobertura : undefined,
      sort_by: filters.sort_by,
      sort_dir: filters.sort_dir,
    }),
    [filters]
  );

  const loadData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");
    try {
      const response = await getReporteEstadoCoberturas(queryParams, controller.signal);
      setData(Array.isArray(response?.data) ? response.data : []);
      setMeta({
        page: response?.meta?.page || 1,
        per_page: response?.meta?.per_page || 25,
        total: response?.meta?.total || 0,
        last_page: response?.meta?.last_page || 1,
      });
      setResumen({
        total: response?.resumen?.total || response?.meta?.total || 0,
      });
    } catch (err) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "No se pudo cargar el informe.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    loadData();
    return () => abortRef.current?.abort();
  }, [loadData]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.search) next.set("search", filters.search);
    if (filters.estado_cobertura && filters.estado_cobertura !== "todos") {
      next.set("estado_cobertura", filters.estado_cobertura);
    }
    setSearchParams(next, { replace: true });
  }, [filters.search, filters.estado_cobertura, setSearchParams]);

  const handleSort = (column) => {
    setFilters((prev) => {
      if (prev.sort_by === column) {
        return { ...prev, sort_dir: prev.sort_dir === "asc" ? "desc" : "asc", page: 1 };
      }
      return { ...prev, sort_by: column, sort_dir: "asc", page: 1 };
    });
  };

  const sortIcon = (column) => {
    if (filters.sort_by !== column) return "";
    return filters.sort_dir === "asc" ? " ↑" : " ↓";
  };

  const aplicarBusqueda = (e) => {
    e?.preventDefault?.();
    setFilters((prev) => ({ ...prev, search: searchInput.trim(), page: 1 }));
  };

  return (
    <div className="container-fluid py-3">
      <Helmet>
        <title>Estado de coberturas</title>
      </Helmet>

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h3 className="mb-1 d-flex align-items-center gap-2">
            <FaShieldAlt className="text-primary" />
            Estado de coberturas
          </h3>
          <p className="text-muted mb-0 small">
            Solo productos en <strong>Terminado</strong> y coberturas vivas
            (activas, sin cancelación ni retiro).{" "}
            <Link to="/">Volver al panel principal</Link>
          </p>
        </div>
        <Button variant="outline-primary" size="sm" onClick={loadData} disabled={loading}>
          <FaSync className={loading ? "fa-spin me-1" : "me-1"} />
          Actualizar
        </Button>
      </div>

      <Card className="mb-3">
        <Card.Body>
          <Form onSubmit={aplicarBusqueda}>
            <Row className="g-2 align-items-end">
              <Col xs={12} md={3}>
                <Form.Label className="small mb-1">Estado cobertura</Form.Label>
                <Form.Select
                  value={filters.estado_cobertura}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      estado_cobertura: e.target.value,
                      page: 1,
                    }))
                  }
                >
                  <option value="todos">Todos</option>
                  <option value="Sí">Sí</option>
                  <option value="No">No</option>
                  <option value="Medicare">Medicare</option>
                  <option value="Medicaid">Medicaid</option>
                </Form.Select>
              </Col>
              <Col xs={12} md={6}>
                <Form.Label className="small mb-1">Buscar</Form.Label>
                <Form.Control
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Nombre del cliente o ID de GF"
                />
              </Col>
              <Col xs={12} md={3}>
                <Button type="submit" variant="primary" className="w-100">
                  <FaSearch className="me-1" />
                  Buscar
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" className="d-flex align-items-center gap-2">
          <FaExclamationTriangle />
          {error}
        </Alert>
      )}

      <div className="mb-2 small text-muted">
        Total: <strong>{resumen.total}</strong> registros
      </div>

      <Card>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th role="button" onClick={() => handleSort("grupo_familiar_id")}>
                    GF{sortIcon("grupo_familiar_id")}
                  </th>
                  <th role="button" onClick={() => handleSort("cliente")}>
                    Cliente{sortIcon("cliente")}
                  </th>
                  <th role="button" onClick={() => handleSort("estado_cobertura")}>
                    Estado cobertura{sortIcon("estado_cobertura")}
                  </th>
                  <th role="button" onClick={() => handleSort("producto")}>
                    Producto{sortIcon("producto")}
                  </th>
                  <th role="button" onClick={() => handleSort("fecha_activacion")}>
                    Fecha de activación{sortIcon("fecha_activacion")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-5">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Cargando informe...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-5">
                      No hay coberturas para los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  data.map((row) => (
                    <tr key={row.id}>
                      <td>{renderGrupoLink(row.grupo_familiar_id)}</td>
                      <td>{renderClienteLink(row.cliente_id, row.cliente)}</td>
                      <td>{row.estado_cobertura || "—"}</td>
                      <td>{row.producto || "—"}</td>
                      <td>{formatDate(row.fecha_activacion)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {!loading && meta.total > 0 && (
        <div className="mt-3">
          <Pagination
            currentPage={meta.page}
            totalPages={meta.last_page}
            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
            totalItems={meta.total}
            itemsPerPage={meta.per_page}
          />
        </div>
      )}
    </div>
  );
};

export default ReporteEstadoCoberturasPage;
