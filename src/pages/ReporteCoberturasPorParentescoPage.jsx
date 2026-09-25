import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import {
  FaChevronDown,
  FaChevronUp,
  FaExclamationTriangle,
  FaFilter,
  FaSearch,
  FaSync,
  FaTable,
  FaUserFriends,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import Select from "react-select";
import Pagination from "../components/Pagination";
import GrupoFamiliarClasificadoDetalle from "../components/GrupoFamiliar/GrupoFamiliarClasificadoDetalle";
import {
  FILTRO_PRODUCTO_LISTADO_OPCIONES,
  normalizarFiltroProductoListado,
} from "../constants/estadosGrupoFamiliar";
import {
  claseBadgeProductoCobertura,
  etiquetaProductoCobertura,
} from "../constants/coberturaTipos";
import { getReporteCoberturasPorParentesco } from "../services/reportesService";
import { fetchCompanies } from "../services/companies";
import { formatDateMMDDYYYY } from "../utils/formatters";
import { badgeCoberturaDefinida, COBERTURA_DEFINIDA } from "../utils/coberturaDefinida";
import "../styles/HistorialCoberturasCanceladas.css";
import "../styles/ReporteCoberturasCanceladasRetiradas.css";

const DEFAULT_FILTERS = {
  page: 1,
  per_page: 25,
  parentesco: [],
  producto: [],
  search: "",
  compania_id: [],
  grupo_familiar_id: [],
  estado_cobertura: [],
  incluir_inactivos: false,
  incluir_anuladas: false,
  sort_by: "grupo_familiar_id",
  sort_dir: "asc",
};

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderRadius: 8,
    borderColor: state.isFocused ? "#1a365d" : "#cbd5e1",
    boxShadow: state.isFocused ? "0 0 0 0.2rem rgba(26, 54, 93, 0.12)" : "none",
    fontSize: "0.875rem",
  }),
  menu: (base) => ({ ...base, zIndex: 20, fontSize: "0.875rem" }),
  multiValue: (base) => ({ ...base, borderRadius: 999 }),
};

const COBERTURAS_OPCIONES = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "medicare", label: "Medicare" },
  { value: "medicaid", label: "Medicaid" },
];

const PARENTESCOS_BASE = [
  { value: "todos", label: "Todos los parentescos" },
  { value: "TOMADOR", label: "Tomador (cabeza)" },
  { value: "CONYUGE", label: "Cónyuge" },
  { value: "HIJO", label: "Hijo" },
  { value: "HERMANO", label: "Hermano" },
  { value: "PADRE", label: "Padre" },
  { value: "MADRE", label: "Madre" },
  { value: "NIETO/A", label: "Nieto/a" },
  { value: "ABUELO/A", label: "Abuelo/a" },
  { value: "SUEGRO/A", label: "Suegro/a" },
  { value: "TIO/A", label: "Tío/a" },
  { value: "SOBRINO/A", label: "Sobrino/a" },
  { value: "AMIGO", label: "Amigo" },
];

const CLIENTE_FICHA_PATH = (id) => `/clientes/${id}/ficha`;
const GRUPO_FICHA_PATH = (id) => `/grupo_familiar/${id}`;

const formatDate = (value) => {
  if (!value) return "—";
  const formatted = formatDateMMDDYYYY(value);
  return formatted || "—";
};

const badgeParentesco = (row) => {
  const canon = String(row?.parentesco_canonico || row?.parentesco || "")
    .trim()
    .toUpperCase();
  const text = row?.parentesco || canon || "Sin parentesco";

  if (canon === "TOMADOR") {
    return { text, bg: "warning", textColor: "dark" };
  }
  if (canon === "CONYUGE") {
    return { text, bg: "info", textColor: undefined };
  }
  return { text, bg: "secondary", textColor: undefined };
};

const badgeTipoCobertura = (value) => {
  const raw = String(value || "").trim();
  const token = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (token === "si" || token === "yes") {
    return { text: "Sí", bg: "success", textColor: undefined };
  }
  if (token === "no") {
    return { text: "No", bg: "secondary", textColor: undefined };
  }
  if (token === "medicare") {
    return { text: "Medicare", bg: "primary", textColor: undefined };
  }
  if (token === "medicaid") {
    return { text: "Medicaid", bg: "info", textColor: undefined };
  }
  if (!raw) {
    return { text: "—", bg: "light", textColor: "dark" };
  }
  return { text: raw, bg: "light", textColor: "dark" };
};

const badgeEstadoReporte = (estado) => {
  const label = String(estado || "").trim() || "Sin estado";
  if (Object.values(COBERTURA_DEFINIDA).includes(label)) {
    return { text: label, bg: badgeCoberturaDefinida(label), textColor: undefined };
  }

  const lower = label.toLowerCase();
  if (lower === "vigente" || lower === "sí" || lower === "si" || lower === "yes") {
    return { text: label, bg: "success", textColor: undefined };
  }
  if (lower.startsWith("cancel")) {
    return { text: label, bg: "danger", textColor: undefined };
  }
  if (lower.startsWith("anul")) {
    return { text: label, bg: "warning", textColor: "dark" };
  }
  return { text: label, bg: "secondary", textColor: undefined };
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
    <span className={`hcc-badge-producto ${claseBadgeProductoCobertura(tipo)}`} title={label}>
      {label}
    </span>
  );
};

const ReporteCoberturasPorParentescoPage = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ page: 1, per_page: 25, total: 0, last_page: 1 });
  const [resumen, setResumen] = useState({
    total: 0,
    grupos: 0,
    coberturas: 0,
    tomadores: 0,
    conyuges: 0,
    otros: 0,
  });
  const [parentescosApi, setParentescosApi] = useState([]);
  const [gruposApi, setGruposApi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [gruposAbiertos, setGruposAbiertos] = useState(() => new Set());
  const abortRef = useRef(null);

  const opcionesParentesco = useMemo(() => {
    const conocidos = new Set(PARENTESCOS_BASE.map((opcion) => opcion.value));
    const extras = (Array.isArray(parentescosApi) ? parentescosApi : [])
      .filter((valor) => valor && !conocidos.has(valor))
      .map((valor) => ({ value: valor, label: valor }));
    return [...PARENTESCOS_BASE, ...extras];
  }, [parentescosApi]);

  const queryParams = useMemo(() => {
    const params = { ...filters };
    if (!params.search) delete params.search;
    if (!Array.isArray(params.compania_id) || params.compania_id.length === 0) {
      delete params.compania_id;
    }
    if (!Array.isArray(params.producto) || params.producto.length === 0) {
      delete params.producto;
    }
    if (!Array.isArray(params.parentesco) || params.parentesco.length === 0) {
      delete params.parentesco;
    }
    if (!Array.isArray(params.grupo_familiar_id) || params.grupo_familiar_id.length === 0) {
      delete params.grupo_familiar_id;
    }
    if (!Array.isArray(params.estado_cobertura) || params.estado_cobertura.length === 0) {
      delete params.estado_cobertura;
    }
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
      const response = await getReporteCoberturasPorParentesco(queryParams, controller.signal);
      setData(Array.isArray(response?.data) ? response.data : []);
      setMeta(response?.meta || DEFAULT_FILTERS);
      setResumen(
        response?.resumen || {
          total: 0,
          grupos: 0,
          coberturas: 0,
          tomadores: 0,
          conyuges: 0,
          otros: 0,
        }
      );
      setParentescosApi(Array.isArray(response?.parentescos) ? response.parentescos : []);
      setGruposApi(Array.isArray(response?.grupos) ? response.grupos : []);
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

  const filasAgrupadas = useMemo(() => {
    let banda = 0;
    return data.map((row, index) => {
      const id = String(row.grupo_familiar_id ?? "");
      const anterior = index > 0 ? String(data[index - 1].grupo_familiar_id ?? "") : null;
      const inicio = anterior !== id;
      const siguiente =
        index < data.length - 1 ? String(data[index + 1].grupo_familiar_id ?? "") : null;
      const ultima = siguiente !== id;
      const tieneTomador = data.some(
        (item) =>
          String(item.grupo_familiar_id ?? "") === id &&
          String(item.parentesco_canonico || "").toUpperCase() === "TOMADOR"
      );
      if (inicio && index > 0) banda += 1;
      let span = 1;
      if (inicio) {
        span = 0;
        for (let i = index; i < data.length; i += 1) {
          if (String(data[i].grupo_familiar_id ?? "") !== id) break;
          span += 1;
        }
      }
      return { row, inicio, ultima, span, tieneTomador, banda: banda % 2 };
    });
  }, [data]);

  const toggleGrupo = (grupoId) => {
    const id = String(grupoId);
    setGruposAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const limpiarFiltros = () => {
    setSearchInput("");
    setFilters({ ...DEFAULT_FILTERS });
  };

  return (
    <div className="container-fluid ccr-report-container">
      <Helmet>
        <title>Directorio de grupos</title>
      </Helmet>

      <div className="ccr-report">
        <div className="ccr-report__header">
          <div className="ccr-report__header-main">
            <div className="ccr-report__header-icon" aria-hidden="true">
              <FaUserFriends />
            </div>
            <div>
              <h1 className="ccr-report__title">Directorio de grupos</h1>
              <p className="ccr-report__subtitle mb-0">
                Consulta los miembros de los grupos familiares: solo cabezas (tomadores), solo
                cónyuges, un parentesco concreto o todos. Las coberturas retiradas se consultan en
                Canceladas y retiradas.{" "}
                <Link to="/">Volver al panel principal</Link>
              </p>
            </div>
          </div>
          <div className="ccr-report__header-actions">
            <span className="ccr-report__chip-resumen">
              {resumen.grupos ?? 0} grupos · {resumen.coberturas ?? resumen.total ?? 0} coberturas
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
                <div className="ccr-report__label">Parentesco</div>
                <Select
                  isMulti
                  closeMenuOnSelect={false}
                  options={opcionesParentesco.filter((opcion) => opcion.value !== "todos")}
                  value={opcionesParentesco.filter((opcion) =>
                    filters.parentesco.includes(opcion.value)
                  )}
                  onChange={(selected) =>
                    handleFilterChange(
                      "parentesco",
                      (selected || []).map((opcion) => opcion.value)
                    )
                  }
                  placeholder="Todos los parentescos"
                  noOptionsMessage={() => "Sin opciones"}
                  styles={selectStyles}
                  aria-label="Filtrar por parentesco"
                />
              </Col>
              <Col md={6} lg={3}>
                <div className="ccr-report__label">Producto</div>
                <Select
                  isMulti
                  closeMenuOnSelect={false}
                  options={FILTRO_PRODUCTO_LISTADO_OPCIONES.filter(
                    (opcion) => opcion.value !== "todos"
                  )}
                  value={FILTRO_PRODUCTO_LISTADO_OPCIONES.filter((opcion) =>
                    filters.producto.includes(opcion.value)
                  )}
                  onChange={(selected) =>
                    handleFilterChange(
                      "producto",
                      (selected || []).map((opcion) =>
                        normalizarFiltroProductoListado(opcion.value)
                      )
                    )
                  }
                  placeholder="Todos los productos"
                  noOptionsMessage={() => "Sin opciones"}
                  styles={selectStyles}
                  aria-label="Filtrar por producto"
                />
              </Col>
              <Col md={6} lg={3}>
                <div className="ccr-report__label">Cobertura</div>
                <Select
                  isMulti
                  closeMenuOnSelect={false}
                  options={COBERTURAS_OPCIONES}
                  value={COBERTURAS_OPCIONES.filter((opcion) =>
                    filters.estado_cobertura.includes(opcion.value)
                  )}
                  onChange={(selected) =>
                    handleFilterChange(
                      "estado_cobertura",
                      (selected || []).map((opcion) => opcion.value)
                    )
                  }
                  placeholder="Todas las coberturas"
                  noOptionsMessage={() => "Sin opciones"}
                  styles={selectStyles}
                  aria-label="Filtrar por cobertura"
                />
              </Col>
              <Col md={6} lg={3}>
                <div className="ccr-report__label">Compañía</div>
                <Select
                  isMulti
                  closeMenuOnSelect={false}
                  options={companies.map((comp) => ({
                    value: String(comp.id),
                    label: comp.nombre,
                  }))}
                  value={companies
                    .filter((comp) => filters.compania_id.includes(String(comp.id)))
                    .map((comp) => ({ value: String(comp.id), label: comp.nombre }))}
                  onChange={(selected) =>
                    handleFilterChange(
                      "compania_id",
                      (selected || []).map((opcion) => opcion.value)
                    )
                  }
                  placeholder="Todas"
                  noOptionsMessage={() => "Sin compañías"}
                  styles={selectStyles}
                  aria-label="Filtrar por compañía"
                />
              </Col>
              <Col md={6} lg={3}>
                <div className="ccr-report__label">ID de grupo</div>
                <Select
                  isMulti
                  closeMenuOnSelect={false}
                  options={gruposApi.map((id) => ({
                    value: String(id),
                    label: String(id),
                  }))}
                  value={gruposApi
                    .filter((id) => filters.grupo_familiar_id.includes(String(id)))
                    .map((id) => ({ value: String(id), label: String(id) }))}
                  onChange={(selected) =>
                    handleFilterChange(
                      "grupo_familiar_id",
                      (selected || []).map((opcion) => opcion.value)
                    )
                  }
                  placeholder="Todos los grupos"
                  noOptionsMessage={() => "Sin grupos"}
                  styles={selectStyles}
                  aria-label="Filtrar por id de grupo"
                />
              </Col>
              <Col md={6} lg={3} className="d-flex align-items-center">
                <Form.Check
                  type="switch"
                  id="incluir-inactivos"
                  className="mb-0"
                  label="Incluir retirados y cancelados"
                  checked={filters.incluir_inactivos}
                  onChange={(event) =>
                    handleFilterChange("incluir_inactivos", event.target.checked)
                  }
                />
              </Col>
              <Col md={6} lg={3} className="d-flex align-items-center">
                <Form.Check
                  type="switch"
                  id="incluir-anuladas"
                  className="mb-0"
                  label="Incluir anuladas"
                  checked={filters.incluir_anuladas}
                  onChange={(event) =>
                    handleFilterChange("incluir_anuladas", event.target.checked)
                  }
                />
              </Col>
              <Col md={6} lg={3}>
                <Form onSubmit={handleSearch}>
                  <div className="ccr-report__label">Buscar por nombre</div>
                  <div className="d-flex gap-2">
                    <Form.Control
                      placeholder="Nombre del cliente"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      aria-label="Buscar por nombre del cliente"
                    />
                    <Button type="submit" variant="primary" aria-label="Buscar">
                      <FaSearch />
                    </Button>
                  </div>
                </Form>
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
            <strong>{resumen.grupos ?? 0}</strong> grupos ·{" "}
            <strong>{resumen.coberturas ?? resumen.total ?? 0}</strong> coberturas
            {" · "}
            {resumen.tomadores} tomadores · {resumen.conyuges} cónyuges · {resumen.otros} otros
            {" · "}
            mostrando <strong>{data.length}</strong> de <strong>{meta.total ?? 0}</strong> en esta página
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
                    <th style={{ width: "2.5rem" }} aria-label="Abrir grupo" />
                    <th
                      className="ccr-report__sortable"
                      onClick={() => handleSort("grupo_familiar_id")}
                    >
                      GF{sortIcon("grupo_familiar_id")}
                    </th>
                    <th className="ccr-report__sortable" onClick={() => handleSort("nombre")}>
                      Nombre{sortIcon("nombre")}
                    </th>
                    <th className="ccr-report__sortable" onClick={() => handleSort("parentesco")}>
                      Parentesco{sortIcon("parentesco")}
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
                      onClick={() => handleSort("estado_cobertura")}
                    >
                      Cobertura{sortIcon("estado_cobertura")}
                    </th>
                    <th
                      className="text-end ccr-report__sortable"
                      onClick={() => handleSort("estado")}
                    >
                      Estado{sortIcon("estado")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-5">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Cargando informe...
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="ccr-report__empty">
                        No hay coberturas para los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    filasAgrupadas.map(({ row, inicio, ultima, span, tieneTomador, banda }) => {
                      const parentesco = badgeParentesco(row);
                      const tipoCobertura = badgeTipoCobertura(row.estado_cobertura);
                      const estado = badgeEstadoReporte(row.estado);
                      const grupoId = String(row.grupo_familiar_id ?? "");
                      const abierto = gruposAbiertos.has(grupoId);
                      return (
                        <Fragment key={row.id}>
                        <tr
                          className={`${inicio ? "ccr-gf-inicio" : ""} ${banda ? "ccr-gf-band" : ""}`.trim()}
                        >
                          {inicio && (
                            <td rowSpan={span} className="text-center align-middle">
                              {tieneTomador && (
                                <button
                                  type="button"
                                  className="ccr-report__acordeon"
                                  aria-expanded={abierto}
                                  aria-label={
                                    abierto
                                      ? `Cerrar grupo ${grupoId}`
                                      : `Abrir grupo ${grupoId}`
                                  }
                                  onClick={() => toggleGrupo(grupoId)}
                                >
                                  {abierto ? <FaChevronUp /> : <FaChevronDown />}
                                </button>
                              )}
                            </td>
                          )}
                          {inicio && (
                            <td rowSpan={span} className="ccr-report__gf-cell">
                              {renderGrupoLink(row.grupo_familiar_id)}
                            </td>
                          )}
                          <td>{renderClienteLink(row.cliente_id, row.nombre)}</td>
                          <td>
                            <Badge bg={parentesco.bg} text={parentesco.textColor} pill>
                              {parentesco.text}
                            </Badge>
                          </td>
                          <td>{renderProducto(row)}</td>
                          <td>{row.compania || "—"}</td>
                          <td>{row.codigo_poliza || "—"}</td>
                          <td>{formatDate(row.fecha_activacion)}</td>
                          <td>
                            <Badge bg={tipoCobertura.bg} text={tipoCobertura.textColor} pill>
                              {tipoCobertura.text}
                            </Badge>
                          </td>
                          <td className="text-end">
                            <Badge bg={estado.bg} text={estado.textColor} pill>
                              {estado.text}
                            </Badge>
                          </td>
                        </tr>
                        {ultima && tieneTomador && abierto && (
                          <tr className="ccr-report__acordeon-detalle">
                            <td colSpan={10} className="bg-white border-bottom p-3">
                              <GrupoFamiliarClasificadoDetalle
                                grupoId={row.grupo_familiar_id}
                                detallePath={`/grupo_familiar/${row.grupo_familiar_id}`}
                              />
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })
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

export default ReporteCoberturasPorParentescoPage;
