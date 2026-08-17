import { useCallback, useEffect, useMemo, useState } from "react";
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
import { FaBan, FaSearch, FaSync } from "react-icons/fa";
import { Link } from "react-router-dom";
import DateInputWithCalendar from "../components/common/DateInputWithCalendar";
import Pagination from "../components/Pagination";
import {
  MOTIVOS_DESCARTE_GRUPO,
  labelMotivoDescarte,
} from "../constants/motivosDescarteGrupo";
import apiRequest from "../services/api";
import { formatDateMMDDYYYY } from "../utils/formatters";

const DEFAULT_FILTERS = {
  page: 1,
  per_page: 25,
  search: "",
  motivo_codigo: "",
  date_from: "",
  date_to: "",
};

const GRUPO_PATH = (id) => `/grupo_familiar/${id}`;

const formatFecha = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    const fallback = formatDateMMDDYYYY(value);
    return fallback || "—";
  }
};

const resolveMotivo = (row) =>
  row?.motivo_label ||
  labelMotivoDescarte(row?.motivo_codigo) ||
  row?.motivo ||
  "Sin motivo registrado";

const resolveObservacion = (row) => {
  const nota = String(row?.observacion || "").trim();
  if (nota) return nota;
  return null;
};

export default function ReporteGruposDescartadosPage() {
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
      if (filters.motivo_codigo) params.set("motivo_codigo", filters.motivo_codigo);
      if (filters.date_from) params.set("date_from", filters.date_from);
      if (filters.date_to) params.set("date_to", filters.date_to);

      const res = await apiRequest(
        `grupo_familiar/reporte-descartados?${params.toString()}`,
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
      setError(e?.message || "No se pudo cargar el reporte de grupos descartados.");
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

  const motivosOptions = useMemo(() => MOTIVOS_DESCARTE_GRUPO, []);

  return (
    <>
      <Helmet>
        <title>Vantun / Grupos descartados</title>
      </Helmet>

      <div className="container-fluid py-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h4 className="mb-1 d-flex align-items-center gap-2">
              <FaBan className="text-danger" />
              Reporte de grupos descartados
            </h4>
            <div className="text-muted small">
              Motivo y observación del descarte para revisar por qué se cerró el proceso.
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Badge bg="danger" className="fs-6 px-3 py-2">
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
                      placeholder="ID, tomador, responsable o motivo…"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                    <Button type="submit" variant="primary">
                      <FaSearch />
                    </Button>
                  </InputGroup>
                </Col>
                <Col md={3}>
                  <Form.Label className="small text-muted mb-1">Motivo</Form.Label>
                  <Form.Select
                    value={filters.motivo_codigo}
                    onChange={(e) => onChangeFilter("motivo_codigo", e.target.value)}
                  >
                    <option value="">Todos los motivos</option>
                    {motivosOptions.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
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
                Cargando grupos descartados…
              </div>
            ) : data.length === 0 ? (
              <div className="text-center text-muted py-5">
                No hay grupos familiares descartados con los filtros actuales.
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>GF</th>
                      <th>Tomador</th>
                      <th>Responsable</th>
                      <th>Motivo</th>
                      <th>Observación</th>
                      <th>Descartado por</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
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
                        <td>
                          <span className="fw-semibold">{resolveMotivo(row)}</span>
                        </td>
                        <td style={{ maxWidth: 320, whiteSpace: "pre-wrap" }}>
                          {resolveObservacion(row) || (
                            <span className="text-muted">Sin observación</span>
                          )}
                        </td>
                        <td>{row.descartado_por || "—"}</td>
                        <td className="text-nowrap">{formatFecha(row.fecha_descarte)}</td>
                      </tr>
                    ))}
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
