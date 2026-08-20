import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import { FaSearch, FaSync, FaUserSlash } from "react-icons/fa";
import { Link } from "react-router-dom";
import DateInputWithCalendar from "../components/common/DateInputWithCalendar";
import Pagination from "../components/Pagination";
import apiRequest from "../services/api";
import { formatDateMMDDYYYY } from "../utils/formatters";

const DEFAULT_FILTERS = {
  page: 1,
  per_page: 25,
  search: "",
  tipo: "",
  date_from: "",
  date_to: "",
};

const GRUPO_PATH = (id) => `/grupo_familiar/${id}`;

const TIPO_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "todos_cancelados", label: "Todos cancelados" },
  { value: "todos_retirados", label: "Todos retirados" },
  { value: "mixtos", label: "Cancelados y retirados" },
];

const formatFecha = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("es-CO", { dateStyle: "medium" });
  } catch {
    return formatDateMMDDYYYY(value) || "—";
  }
};

const badgeTipo = (tipo) => {
  switch (tipo) {
    case "todos_cancelados":
      return { bg: "danger", text: "Todos cancelados" };
    case "todos_retirados":
      return { bg: "secondary", text: "Todos retirados" };
    case "mixtos":
      return { bg: "warning", text: "Cancelados y retirados", textColor: "dark" };
    default:
      return { bg: "light", text: tipo || "—", textColor: "dark" };
  }
};

export default function ReporteGruposInactivosPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    last_page: 1,
  });
  const [resumen, setResumen] = useState({ total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(filters.page));
      params.set("per_page", String(filters.per_page));
      if (filters.search) params.set("search", filters.search);
      if (filters.tipo) params.set("tipo", filters.tipo);
      if (filters.date_from) params.set("date_from", filters.date_from);
      if (filters.date_to) params.set("date_to", filters.date_to);

      const res = await apiRequest(
        `grupo_familiar/reporte-inactivos?${params.toString()}`,
        "GET"
      );

      const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setData(rows);
      setMeta({
        page: res?.meta?.page ?? filters.page,
        per_page: res?.meta?.per_page ?? filters.per_page,
        total: res?.meta?.total ?? rows.length,
        last_page: res?.meta?.last_page ?? 1,
      });
      setResumen({ total: res?.resumen?.total ?? res?.meta?.total ?? rows.length });
    } catch (e) {
      console.error(e);
      setError(e?.message || "No se pudo cargar el reporte de grupos inactivos.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const applySearch = (e) => {
    e?.preventDefault?.();
    setFilters((prev) => ({
      ...prev,
      page: 1,
      search: searchInput.trim(),
    }));
  };

  const onChangeFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, page: 1, [key]: value }));
  };

  return (
    <>
      <Helmet>
        <title>Vantun / Grupos inactivos</title>
      </Helmet>

      <div className="container-fluid py-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h4 className="mb-1 d-flex align-items-center gap-2">
              <FaUserSlash className="text-secondary" />
              Reporte de grupos inactivos
            </h4>
            <div className="text-muted small">
              Grupos donde todas las coberturas están canceladas y/o retiradas (sin pólizas
              vigentes).
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Badge bg="secondary" className="fs-6 px-3 py-2">
              Total: {resumen.total ?? 0}
            </Badge>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              <FaSync className={loading ? "fa-spin me-1" : "me-1"} />
              Actualizar
            </Button>
          </div>
        </div>

        <Card className="mb-3 border-0 shadow-sm">
          <Card.Body>
            <Form onSubmit={applySearch}>
              <Row className="g-2 align-items-end">
                <Col md={4}>
                  <Form.Label className="small text-muted mb-1">Buscar</Form.Label>
                  <InputGroup>
                    <Form.Control
                      placeholder="ID, tomador o responsable…"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                    <Button type="submit" variant="primary">
                      <FaSearch />
                    </Button>
                  </InputGroup>
                </Col>
                <Col md={3}>
                  <Form.Label className="small text-muted mb-1">Tipo</Form.Label>
                  <Form.Select
                    value={filters.tipo}
                    onChange={(e) => onChangeFilter("tipo", e.target.value)}
                  >
                    {TIPO_OPTIONS.map((opt) => (
                      <option key={opt.value || "all"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={2}>
                  <Form.Label className="small text-muted mb-1">Desde</Form.Label>
                  <DateInputWithCalendar
                    valueIso={filters.date_from}
                    onChangeIso={(iso) => onChangeFilter("date_from", iso || "")}
                  />
                </Col>
                <Col md={2}>
                  <Form.Label className="small text-muted mb-1">Hasta</Form.Label>
                  <DateInputWithCalendar
                    valueIso={filters.date_to}
                    onChangeIso={(iso) => onChangeFilter("date_to", iso || "")}
                    minIso={filters.date_from || undefined}
                  />
                </Col>
                <Col md={1}>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    className="w-100"
                    onClick={() => {
                      setSearchInput("");
                      setFilters(DEFAULT_FILTERS);
                    }}
                  >
                    Limpiar
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>

        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}

        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" size="sm" className="me-2" />
                Cargando grupos inactivos…
              </div>
            ) : data.length === 0 ? (
              <div className="text-center text-muted py-5">
                No hay grupos familiares inactivos con los filtros actuales.
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>GF</th>
                      <th>Tomador</th>
                      <th>Responsable</th>
                      <th>Estado proceso</th>
                      <th>Tipo</th>
                      <th>Coberturas</th>
                      <th>Última baja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => {
                      const badge = badgeTipo(row.tipo_inactividad);
                      return (
                        <tr key={row.id}>
                          <td>
                            <Link
                              to={GRUPO_PATH(row.id)}
                              className="fw-semibold text-decoration-none"
                              title={`Abrir grupo #${row.id}`}
                            >
                              {row.id}
                            </Link>
                          </td>
                          <td>
                            {row.tomador_nombre &&
                            row.tomador_nombre !== "Sin asignar"
                              ? row.tomador_nombre
                              : row.persona_contacto || "—"}
                          </td>
                          <td>{row.responsable || "—"}</td>
                          <td>{row.estado || "—"}</td>
                          <td>
                            <Badge bg={badge.bg} text={badge.textColor}>
                              {row.tipo_label || badge.text}
                            </Badge>
                          </td>
                          <td className="text-nowrap">
                            <span title="Total / canceladas / retiradas">
                              {row.total_coberturas ?? 0}
                              <span className="text-muted"> · </span>
                              <span className="text-danger">
                                {row.total_canceladas ?? 0} canc.
                              </span>
                              <span className="text-muted"> · </span>
                              <span className="text-secondary">
                                {row.total_retiradas ?? 0} ret.
                              </span>
                            </span>
                          </td>
                          <td className="text-nowrap">
                            {formatFecha(row.fecha_inactividad)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>

        {!loading && meta.total > 0 && (
          <div className="mt-3">
            <Pagination
              currentPage={meta.page}
              totalPages={meta.last_page}
              onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
              totalItems={meta.total}
              itemsPerPage={meta.per_page}
            />
          </div>
        )}
      </div>
    </>
  );
}
