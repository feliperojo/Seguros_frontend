import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Form,
  InputGroup,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import { FaBan, FaFilter, FaSearch, FaSync, FaTable } from "react-icons/fa";
import { Link } from "react-router-dom";
import DateInputWithCalendar from "../components/common/DateInputWithCalendar";
import Pagination from "../components/Pagination";
import {
  MOTIVOS_DESCARTE_GRUPO,
  labelMotivoDescarte,
} from "../constants/motivosDescarteGrupo";
import apiRequest from "../services/api";
import { formatDateMMDDYYYY } from "../utils/formatters";
import "../styles/HistorialCoberturasCanceladas.css";
import "../styles/ReporteGruposDescartados.css";

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

  const limpiarFiltros = () => {
    setSearchInput("");
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <div className="container-fluid rgd-report-container">
      <Helmet>
        <title>Vantun / Grupos descartados</title>
      </Helmet>

      <div className="rgd-report">
        <div className="rgd-report__header">
          <div className="rgd-report__header-main">
            <div className="rgd-report__header-icon" aria-hidden="true">
              <FaBan />
            </div>
            <div>
              <h1 className="rgd-report__title">Reporte de grupos descartados</h1>
              <p className="rgd-report__subtitle mb-0">
                Motivo y observación del descarte para revisar por qué se cerró el proceso.{" "}
                <Link to="/">Volver al panel principal</Link>
              </p>
            </div>
          </div>
          <div className="rgd-report__header-actions">
            <span className="rgd-report__chip-resumen">
              Total: {resumen.total ?? 0}
            </span>
            <Button variant="light" size="sm" onClick={loadData} disabled={loading}>
              <FaSync className={loading ? "fa-spin me-1" : "me-1"} />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="rgd-report__body">
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          <div className="rgd-report__section">
            <div className="rgd-report__section-title">
              <FaFilter aria-hidden="true" />
              Filtros
            </div>
            <Form onSubmit={applySearch}>
              <Row className="g-3 align-items-end">
                <Col xs={12} lg={4}>
                  <div className="rgd-report__label">Buscar</div>
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
                <Col xs={12} sm={6} lg={3}>
                  <div className="rgd-report__label">Motivo</div>
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
                <Col xs={12} sm={6} md={4} lg={2}>
                  <div className="rgd-report__label">Desde</div>
                  <DateInputWithCalendar
                    valueIso={filters.date_from}
                    onChangeIso={(iso) => onChangeFilter("date_from", iso || "")}
                  />
                </Col>
                <Col xs={12} sm={6} md={4} lg={2}>
                  <div className="rgd-report__label">Hasta</div>
                  <DateInputWithCalendar
                    valueIso={filters.date_to}
                    onChangeIso={(iso) => onChangeFilter("date_to", iso || "")}
                    minIso={filters.date_from || undefined}
                  />
                </Col>
                <Col xs={12} sm={6} md={4} lg={2} className="ms-lg-auto">
                  <div className="rgd-report__filters-actions">
                    <Button
                      type="button"
                      variant="outline-secondary"
                      className="w-100"
                      onClick={limpiarFiltros}
                    >
                      Limpiar
                    </Button>
                  </div>
                </Col>
              </Row>
            </Form>
          </div>

          <div className="rgd-report__summary">
            Mostrando <strong>{data.length}</strong> de <strong>{meta.total ?? 0}</strong>{" "}
            registros filtrados
          </div>

          <div className="rgd-report__section rgd-report__section--table">
            <div className="rgd-report__section-title px-3 pt-3 mb-0 border-0 pb-2">
              <FaTable aria-hidden="true" />
              Resultados
            </div>

            {loading ? (
              <div className="rgd-report__loading">
                <Spinner animation="border" size="sm" className="me-2" />
                Cargando grupos descartados…
              </div>
            ) : data.length === 0 ? (
              <div className="rgd-report__empty">
                No hay grupos familiares descartados con los filtros actuales.
              </div>
            ) : (
              <div className="rgd-report__table-wrap hcc-table-wrap border-0 rounded-0">
                <Table hover className="hcc-table mb-0 align-middle">
                  <thead>
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
                          <span className="rgd-report__motivo">{resolveMotivo(row)}</span>
                        </td>
                        <td className="rgd-report__observacion">
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
          </div>

          {!loading && meta.total > 0 && (
            <div className="rgd-report__pagination">
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
      </div>
    </div>
  );
}
