import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import {
  FaExclamationTriangle,
  FaFileInvoiceDollar,
  FaFilter,
  FaSearch,
  FaSync,
  FaTable,
} from "react-icons/fa";
import { Link, useSearchParams } from "react-router-dom";
import DateInputWithCalendar from "../components/common/DateInputWithCalendar";
import Pagination from "../components/Pagination";
import {
  FILTRO_PRODUCTO_LISTADO_OPCIONES,
  normalizarFiltroProductoListado,
} from "../constants/estadosGrupoFamiliar";
import {
  claseBadgeProductoCobertura,
  etiquetaProductoCobertura,
} from "../constants/coberturaTipos";
import { getReporteCoberturasCanceladasRetiradas } from "../services/reportesService";
import { fetchCompanies } from "../services/companies";
import { formatDateMMDDYYYY } from "../utils/formatters";
import { badgeCoberturaDefinida, COBERTURA_DEFINIDA } from "../utils/coberturaDefinida";
import "../styles/HistorialCoberturasCanceladas.css";
import "../styles/ReporteCoberturasCanceladasRetiradas.css";

const DEFAULT_FILTERS = {
  page: 1,
  per_page: 25,
  tipo: "todos",
  producto: "todos",
  search: "",
  date_from: "",
  date_to: "",
  compania_id: "",
  mes: "",
  anio: "",
  motivo_cancelacion: "",
  sort_by: "fecha_cancelacion",
  sort_dir: "desc",
};

const MESES_CANCELACION = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

const MOTIVOS_CANCELACION = [
  "CAMBIO DE AGENTE",
  "MS CANCELO POR FALTA DE DOCUMENTOS",
  "TOMO MEDICAID",
  "TOMO MEDICARE (65 AÑOS)",
  "TOMO SEGURO POR EMPLEADOR/OTRO",
  "CLIENTE CANCELO POR PRECIO",
  "SE MUDO A OTRO ESTADO/PAIS",
  "YA NO NECESITA EL SEGURO",
  "SE CANCELO POR FALTA DE PAGO (MORA)",
  "NO REALIZO EL PAGO INICIAL",
  "OTRO",
];

const aniosCancelacion = (() => {
  const actual = new Date().getFullYear();
  const years = [];
  for (let y = actual + 1; y >= actual - 6; y -= 1) {
    years.push(y);
  }
  return years;
})();

const CLIENTE_FICHA_PATH = (id) => `/clientes/${id}/ficha`;
const GRUPO_FICHA_PATH = (id) => `/grupo_familiar/${id}`;

const formatDate = (value) => {
  if (!value) return "—";
  const formatted = formatDateMMDDYYYY(value);
  return formatted || "—";
};

const badgeEstadoReporte = (row) => {
  const label = String(row?.estado || row?.cobertura_definida || "").trim();
  if (!label) {
    return {
      text: row?.tipo === "cancelados" ? "Cancelada" : "Retirada",
      bg: row?.tipo === "cancelados" ? "danger" : "secondary",
      textColor: undefined,
    };
  }

  const conocida = Object.values(COBERTURA_DEFINIDA).includes(label);
  if (conocida) {
    return {
      text: label,
      bg: badgeCoberturaDefinida(label),
      textColor: undefined,
    };
  }

  const lower = label.toLowerCase();
  return {
    text: label,
    bg: lower.startsWith("cancel") ? "danger" : "secondary",
    textColor: undefined,
  };
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
      className="text-decoration-none fw-semibold"
      title="Abrir ficha del cliente en una nueva pestaña"
    >
      {label || clienteId}
    </Link>
  );
};

const renderProducto = (row) => {
  const tipo = row?.cobertura_tipo ?? row?.producto ?? "";
  const label = etiquetaProductoCobertura(tipo);
  return (
    <span
      className={`hcc-badge-producto ${claseBadgeProductoCobertura(tipo)}`}
      title={label}
    >
      {label}
    </span>
  );
};

const ReporteCoberturasCanceladasRetiradasPage = () => {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    tipo: searchParams.get("tipo") || DEFAULT_FILTERS.tipo,
    producto: normalizarFiltroProductoListado(searchParams.get("producto")),
  }));
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ page: 1, per_page: 25, total: 0, last_page: 1 });
  const [resumen, setResumen] = useState({ total: 0, cancelados: 0, retiros: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const abortRef = useRef(null);

  const queryParams = useMemo(() => {
    const params = { ...filters };
    if (!params.search) delete params.search;
    if (!params.date_from) delete params.date_from;
    if (!params.date_to) delete params.date_to;
    if (!params.compania_id) delete params.compania_id;
    if (!params.mes) delete params.mes;
    if (!params.anio) delete params.anio;
    if (!params.motivo_cancelacion) delete params.motivo_cancelacion;
    if (!params.producto || params.producto === "todos") delete params.producto;
    return params;
  }, [filters]);

  const loadReport = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await getReporteCoberturasCanceladasRetiradas(queryParams, controller.signal);
      setData(Array.isArray(response?.data) ? response.data : []);
      setMeta(response?.meta || DEFAULT_FILTERS);
      setResumen(response?.resumen || { total: 0, cancelados: 0, retiros: 0 });
    } catch (err) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "No se pudo cargar el informe.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    loadReport();
    return () => abortRef.current?.abort();
  }, [loadReport]);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const listRaw = await fetchCompanies();
        const list = Array.isArray(listRaw) ? listRaw : [];
        const sorted = [...list].sort((a, b) =>
          String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es", {
            sensitivity: "base",
            numeric: true,
          })
        );
        setCompanies(sorted);
      } catch (err) {
        console.error("Error al cargar compañías:", err);
      }
    };
    loadCompanies();
  }, []);

  const handleSearch = (event) => {
    event.preventDefault();
    setFilters((prev) => ({ ...prev, page: 1, search: searchInput.trim() }));
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, page: 1, [key]: value }));
  };

  const handleProductoChange = (value) => {
    handleFilterChange("producto", normalizarFiltroProductoListado(value));
  };

  const handleSort = (column) => {
    setFilters((prev) => {
      const sameColumn = prev.sort_by === column;
      return {
        ...prev,
        page: 1,
        sort_by: column,
        sort_dir: sameColumn && prev.sort_dir === "asc" ? "desc" : "asc",
      };
    });
  };

  const sortIcon = (column) => {
    if (filters.sort_by !== column) return null;
    return filters.sort_dir === "asc" ? " ↑" : " ↓";
  };

  const limpiarFiltros = () => {
    setSearchInput("");
    setFilters({
      ...DEFAULT_FILTERS,
      tipo: searchParams.get("tipo") || DEFAULT_FILTERS.tipo,
    });
  };

  return (
    <div className="container-fluid ccr-report-container">
      <Helmet>
        <title>Coberturas Canceladas y Retiradas</title>
      </Helmet>

      <div className="ccr-report">
        <div className="ccr-report__header">
          <div className="ccr-report__header-main">
            <div className="ccr-report__header-icon" aria-hidden="true">
              <FaFileInvoiceDollar />
            </div>
            <div>
              <h1 className="ccr-report__title">Coberturas Canceladas y Retiradas</h1>
              <p className="ccr-report__subtitle mb-0">
                Historial completo de cancelaciones y retiros. Cancelados: fecha de cancelación y
                estado Cancelado. Retiros: estado Retirado o Terminado.{" "}
                <Link to="/">Volver al panel principal</Link>
              </p>
            </div>
          </div>
          <div className="ccr-report__header-actions">
            <span className="ccr-report__chip-resumen">
              Total: {resumen.total} · {resumen.cancelados} cancelados · {resumen.retiros} retiros
            </span>
            <Button variant="light" size="sm" onClick={loadReport} disabled={loading}>
              <FaSync className={loading ? "fa-spin me-1" : "me-1"} />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="ccr-report__body">
          {error && (
            <Alert variant="danger" className="d-flex align-items-center mb-3">
              <FaExclamationTriangle className="me-2" />
              {error}
            </Alert>
          )}

          <div className="ccr-report__section">
            <div className="ccr-report__section-title">
              <FaFilter aria-hidden="true" />
              Filtros
            </div>
            <Row className="g-3 align-items-end">
              <Col md={6} lg={3}>
                <div className="ccr-report__label">Tipo</div>
                <Form.Select
                  value={filters.tipo}
                  onChange={(e) => handleFilterChange("tipo", e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="cancelados">Cancelados</option>
                  <option value="retiros">Retiros</option>
                </Form.Select>
              </Col>
              <Col md={6} lg={3}>
                <div className="ccr-report__label">Producto</div>
                <Form.Select
                  value={filters.producto}
                  onChange={(e) => handleProductoChange(e.target.value)}
                  aria-label="Filtrar por producto"
                >
                  {FILTRO_PRODUCTO_LISTADO_OPCIONES.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={6} lg={3}>
                <div className="ccr-report__label">Desde</div>
                <DateInputWithCalendar
                  valueIso={filters.date_from}
                  onChangeIso={(iso) => handleFilterChange("date_from", iso || "")}
                />
              </Col>
              <Col md={6} lg={3}>
                <div className="ccr-report__label">Hasta</div>
                <DateInputWithCalendar
                  valueIso={filters.date_to}
                  onChangeIso={(iso) => handleFilterChange("date_to", iso || "")}
                  minIso={filters.date_from || undefined}
                />
              </Col>
              <Col md={6} lg={4}>
                <Form onSubmit={handleSearch}>
                  <div className="ccr-report__label">Buscar por nombre</div>
                  <div className="d-flex gap-2">
                    <Form.Control
                      placeholder="Nombre del cliente"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                    <Button type="submit" variant="primary">
                      <FaSearch />
                    </Button>
                  </div>
                </Form>
              </Col>
              <Col md={6} lg={3}>
                <div className="ccr-report__label">Compañía</div>
                <Form.Select
                  value={filters.compania_id}
                  onChange={(e) => handleFilterChange("compania_id", e.target.value)}
                >
                  <option value="">Todas</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={6} lg={2}>
                <div className="ccr-report__label">Mes cancelación</div>
                <Form.Select
                  value={filters.mes}
                  onChange={(e) => handleFilterChange("mes", e.target.value)}
                >
                  <option value="">Todos</option>
                  {MESES_CANCELACION.map((mes) => (
                    <option key={mes.value} value={mes.value}>
                      {mes.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={6} lg={2}>
                <div className="ccr-report__label">Año</div>
                <Form.Select
                  value={filters.anio}
                  onChange={(e) => handleFilterChange("anio", e.target.value)}
                >
                  <option value="">Todos</option>
                  {aniosCancelacion.map((anio) => (
                    <option key={anio} value={anio}>
                      {anio}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={12} lg={5}>
                <div className="ccr-report__label">Motivo de cancelación</div>
                <Form.Select
                  value={filters.motivo_cancelacion}
                  onChange={(e) => handleFilterChange("motivo_cancelacion", e.target.value)}
                >
                  <option value="">Todos</option>
                  {MOTIVOS_CANCELACION.map((motivo) => (
                    <option key={motivo} value={motivo}>
                      {motivo}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={12} lg={2} className="ms-lg-auto">
                <Button
                  type="button"
                  variant="outline-secondary"
                  className="w-100"
                  onClick={limpiarFiltros}
                >
                  Limpiar
                </Button>
              </Col>
            </Row>
          </div>

          <div className="ccr-report__summary">
            Mostrando <strong>{data.length}</strong> de <strong>{meta.total ?? 0}</strong>{" "}
            registros filtrados
          </div>

          <div className="ccr-report__section ccr-report__section--table">
            <div className="ccr-report__section-title px-3 pt-3 mb-0 border-0">
              <FaTable aria-hidden="true" />
              Resultados
            </div>
            <div className="ccr-report__table-wrap hcc-table-wrap border-0 rounded-0">
              <Table hover className="hcc-table mb-0 align-middle">
                <thead>
                  <tr>
                    <th
                      className="ccr-report__sortable"
                      onClick={() => handleSort("grupo_familiar_id")}
                    >
                      GF{sortIcon("grupo_familiar_id")}
                    </th>
                    <th className="ccr-report__sortable" onClick={() => handleSort("nombre")}>
                      Nombre{sortIcon("nombre")}
                    </th>
                    <th className="ccr-report__sortable" onClick={() => handleSort("producto")}>
                      Producto{sortIcon("producto")}
                    </th>
                    <th className="ccr-report__sortable" onClick={() => handleSort("compania")}>
                      Compañía{sortIcon("compania")}
                    </th>
                    <th className="ccr-report__sortable" onClick={() => handleSort("codigo_poliza")}>
                      Numero ID{sortIcon("codigo_poliza")}
                    </th>
                    <th
                      className="ccr-report__sortable"
                      onClick={() => handleSort("fecha_activacion")}
                    >
                      Fecha activación{sortIcon("fecha_activacion")}
                    </th>
                    <th
                      className="ccr-report__sortable"
                      onClick={() => handleSort("fecha_cancelacion")}
                    >
                      Fecha expiración{sortIcon("fecha_cancelacion")}
                    </th>
                    <th className="ccr-report__sortable" onClick={() => handleSort("fecha_retiro")}>
                      Fecha retiro{sortIcon("fecha_retiro")}
                    </th>
                    <th className="ccr-report__sortable" onClick={() => handleSort("concepto")}>
                      Concepto{sortIcon("concepto")}
                    </th>
                    <th className="ccr-report__sortable" onClick={() => handleSort("motivo")}>
                      Motivo{sortIcon("motivo")}
                    </th>
                    <th
                      className="text-end ccr-report__sortable"
                      onClick={() => handleSort("tipo")}
                    >
                      Estado{sortIcon("tipo")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="text-center py-5">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Cargando informe...
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="ccr-report__empty">
                        No hay coberturas para los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    data.map((row) => (
                      <tr
                        key={`${row.id}-${row.fecha_cancelacion || ""}-${row.fecha_retiro || ""}-${row.tipo}`}
                      >
                        <td>{renderGrupoLink(row.grupo_familiar_id)}</td>
                        <td>{renderClienteLink(row.cliente_id, row.nombre)}</td>
                        <td>{renderProducto(row)}</td>
                        <td>{row.compania || "—"}</td>
                        <td>{row.codigo_poliza || "—"}</td>
                        <td>{formatDate(row.fecha_activacion)}</td>
                        <td>{formatDate(row.fecha_cancelacion)}</td>
                        <td>{formatDate(row.fecha_retiro)}</td>
                        <td>{row.concepto || "—"}</td>
                        <td>{row.motivo || "—"}</td>
                        <td className="text-end">
                          {(() => {
                            const badge = badgeEstadoReporte(row);
                            return (
                              <Badge bg={badge.bg} text={badge.textColor} pill>
                                {badge.text}
                              </Badge>
                            );
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </div>

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
      </div>
    </div>
  );
};

export default ReporteCoberturasCanceladasRetiradasPage;
