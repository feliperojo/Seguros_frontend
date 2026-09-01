import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Container,
  Form,
  InputGroup,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import { FaSearch, FaSyncAlt, FaUserSlash, FaFilter, FaTable } from "react-icons/fa";
import { Link } from "react-router-dom";
import DateInputWithCalendar from "../components/common/DateInputWithCalendar";
import Pagination from "../components/Pagination";
import apiRequest from "../services/api";
import { formatDateMMDDYYYY } from "../utils/formatters";
import "../styles/GruposFamiliaresListado.css";
import "../styles/ReporteGruposInactivos.css";

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

const formatFecha = (value) => formatDateMMDDYYYY(value) || "—";

const badgeTipo = (tipo) => {
  switch (tipo) {
    case "todos_cancelados":
      return { text: "Todos cancelados", className: "rgi-report__tipo--cancelados" };
    case "todos_retirados":
      return { text: "Todos retirados", className: "rgi-report__tipo--retirados" };
    case "mixtos":
      return { text: "Cancelados y retirados", className: "rgi-report__tipo--mixtos" };
    default:
      return { text: tipo || "—", className: "rgi-report__tipo--default" };
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

  const limpiarFiltros = () => {
    setSearchInput("");
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <Container fluid className="gf-listado-container py-3 rgi-report">
      <Helmet>
        <title>Vantun / Grupos inactivos</title>
      </Helmet>

      <div className="gf-listado">
        <div className="gf-listado__header gf-listado__header--split">
          <div className="gf-listado__header-main">
            <div className="gf-listado__header-icon" aria-hidden="true">
              <FaUserSlash />
            </div>
            <div>
              <h1 className="gf-listado__title">Reporte de grupos inactivos</h1>
              <p className="gf-listado__subtitle">
                Grupos donde todas las coberturas están canceladas y/o retiradas (sin pólizas
                vigentes).
              </p>
            </div>
          </div>
          <div className="gf-listado__header-actions">
            <span className="gf-listado__chip">
              Total: {resumen.total ?? 0}
            </span>
            <Button
              size="sm"
              className="gf-listado__btn-ghost"
              onClick={loadData}
              disabled={loading}
            >
              <FaSyncAlt className={loading ? "fa-spin me-1" : "me-1"} />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="gf-listado__body">
          {error && (
            <Alert variant="danger" className="rgi-report__alert">
              {error}
            </Alert>
          )}

          <div className="gf-listado__section">
            <div className="gf-listado__section-title">
              <FaFilter aria-hidden="true" />
              Filtros
            </div>

            <Form onSubmit={applySearch}>
              <Row className="g-3 align-items-end">
                <Col xs={12} lg={4}>
                  <div className="gf-listado__label">Buscar</div>
                  <InputGroup>
                    <Form.Control
                      placeholder="ID, tomador o responsable…"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                    <Button
                      type="submit"
                      variant="outline-secondary"
                      className="gf-listado__btn-icon"
                      aria-label="Buscar"
                    >
                      <FaSearch />
                    </Button>
                  </InputGroup>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                  <div className="gf-listado__label">Tipo</div>
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
                <Col xs={12} sm={6} md={4} lg={2}>
                  <div className="gf-listado__label">Desde</div>
                  <DateInputWithCalendar
                    valueIso={filters.date_from}
                    onChangeIso={(iso) => onChangeFilter("date_from", iso || "")}
                  />
                </Col>
                <Col xs={12} sm={6} md={4} lg={2}>
                  <div className="gf-listado__label">Hasta</div>
                  <DateInputWithCalendar
                    valueIso={filters.date_to}
                    onChangeIso={(iso) => onChangeFilter("date_to", iso || "")}
                    minIso={filters.date_from || undefined}
                  />
                </Col>
                <Col xs={12} sm={6} md={4} lg={1} className="ms-lg-auto">
                  <div className="rgi-report__filters-actions">
                    <Button
                      type="button"
                      variant="outline-secondary"
                      className="gf-listado__btn-icon w-100"
                      onClick={limpiarFiltros}
                    >
                      Limpiar
                    </Button>
                  </div>
                </Col>
              </Row>
            </Form>
          </div>

          <div className="gf-listado__section gf-listado__section--table">
            <div className="gf-listado__section-title">
              <FaTable aria-hidden="true" />
              Resultados
            </div>

            {!loading && meta.total > 0 && (
              <div className="gf-listado__summary">
                Mostrando <strong>{data.length}</strong> de{" "}
                <strong>{meta.total ?? 0}</strong> registros
              </div>
            )}

            {loading ? (
              <div className="rgi-report__loading">
                <Spinner animation="border" size="sm" role="status" />
                Cargando grupos inactivos…
              </div>
            ) : data.length === 0 ? (
              <div className="gf-listado__empty">
                No hay grupos familiares inactivos con los filtros actuales.
              </div>
            ) : (
              <div className="gf-listado__table-wrap">
                <Table hover className="gf-listado__table mb-0 align-middle">
                  <thead>
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
                          <td className="rgi-report__estado-proceso">
                            {row.estado || "—"}
                          </td>
                          <td>
                            <span className={`rgi-report__tipo ${badge.className}`}>
                              {row.tipo_label || badge.text}
                            </span>
                          </td>
                          <td>
                            <span
                              className="rgi-report__coberturas"
                              title="Total / canceladas / retiradas"
                            >
                              <span className="rgi-report__coberturas-total">
                                {row.total_coberturas ?? 0}
                              </span>
                              <span className="text-muted"> · </span>
                              <span className="rgi-report__coberturas-canc">
                                {row.total_canceladas ?? 0} canc.
                              </span>
                              <span className="text-muted"> · </span>
                              <span className="rgi-report__coberturas-ret">
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
          </div>

          {!loading && meta.total > 0 && (
            <div className="rgi-report__pagination">
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
    </Container>
  );
}
