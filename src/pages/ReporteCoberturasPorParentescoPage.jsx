import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { Alert, Badge, Button, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import {
  FaChevronDown,
  FaChevronUp,
  FaColumns,
  FaExclamationTriangle,
  FaFileExcel,
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
import { METAL_OPTIONS, TIPO_PAGO_OPTIONS } from "../constants/coberturaFields";
import { STATUS_MIGRATORIO_OPTIONS } from "../constants/statusMigratorio";
import {
  FILTRO_PRODUCTO_LISTADO_OPCIONES,
  normalizarFiltroProductoListado,
} from "../constants/estadosGrupoFamiliar";
import {
  claseBadgeProductoCobertura,
  etiquetaProductoCobertura,
} from "../constants/coberturaTipos";
import DirectorioGruposColumnasModal from "../components/Reportes/DirectorioGruposColumnasModal";
import {
  COLUMNAS_DIRECTORIO,
  esVistaInicial,
  guardarColumnas,
  leerColumnasGuardadas,
  tipoFiltroColumna,
} from "./directorioGruposColumnas";
import { getReporteCoberturasPorParentesco } from "../services/reportesService";
import * as XLSX from "xlsx";
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
  responsable: [],
  estado_cobertura: [],
  incluir_inactivos: false,
  incluir_anuladas: false,
  sort_by: "grupo_familiar_id",
  sort_dir: "asc",
};

const PERIODOS_INGRESO = ["HOUR", "WEEKLY P.TIME", "WEEKLY", "BIWEEKLY", "MONTHLY", "ANNUAL"];

const OPCIONES_FILTRO_FIJAS = {
  estado_cobertura: ["Sí", "No", "Medicare", "Medicaid"],
  estado: ["Vigente", "Cancelado", "Retirado", "Terminado", "Anulado"],
  metal: METAL_OPTIONS,
  red: ["HMO", "EPO", "PPO", "POS"],
  tipo_pago: TIPO_PAGO_OPTIONS,
  genero: ["Masculino", "Femenino", "Otro"],
  status_migratorio: STATUS_MIGRATORIO_OPTIONS,
  tipo_ingreso: ["W2", "1099", "SOCIAL SECURITY", "SELF EMPLOYMENT", "SUPPORT", "ALIMONY"],
  periodo_ingreso: PERIODOS_INGRESO,
  periodo_ingreso_ocasional: PERIODOS_INGRESO,
};

const opcionesDeFiltro = (clave, desdeApi) => {
  const fijas = OPCIONES_FILTRO_FIJAS[clave] || [];
  const extras = Array.isArray(desdeApi) ? desdeApi : [];
  return [...new Set([...fijas, ...extras.map((item) => String(item))])]
    .filter((item) => item.trim() !== "")
    .map((item) => ({ value: item, label: item }));
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

const FECHAS = new Set([
  "fecha_activacion",
  "fecha_cancelacion",
  "fecha_retiro",
  "fecha_anulacion",
  "fecha_nacimiento",
  "fecha_emision",
  "fecha_expiracion",
]);

const MONTOS = new Set([
  "precio",
  "ingreso_por_periodo",
  "ingreso_anual",
  "ingreso_por_periodo_ocasional",
  "ingreso_ocasional_anual",
]);

const esVacio = (value) => value === null || value === undefined || String(value).trim() === "";

const formatPrecio = (value) => {
  if (esVacio(value)) return "—";
  const numero = Number(value);
  if (Number.isNaN(numero)) return String(value);
  return numero.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

const valorExportacion = (row, key) => {
  if (key === "producto") {
    return etiquetaProductoCobertura(row?.cobertura_tipo ?? row?.producto ?? "") || "";
  }
  if (key === "estado_cobertura") {
    const tipo = badgeTipoCobertura(row.estado_cobertura);
    return tipo.text === "—" ? "" : tipo.text;
  }
  if (key === "parentesco") return row.parentesco || row.parentesco_canonico || "";
  if (FECHAS.has(key)) {
    const fecha = formatDate(row[key]);
    return fecha === "—" ? "" : fecha;
  }
  if (MONTOS.has(key)) {
    if (esVacio(row[key])) return "";
    const numero = Number(row[key]);
    return Number.isNaN(numero) ? String(row[key]) : numero;
  }
  return esVacio(row[key]) ? "" : row[key];
};

const renderCelda = (row, columna, inicio, span) => {
  const { key } = columna;
  if (key === "grupo_familiar_id") {
    if (!inicio) return null;
    return (
      <td key={key} rowSpan={span} className="ccr-report__gf-cell">
        {renderGrupoLink(row.grupo_familiar_id)}
      </td>
    );
  }

  let content = esVacio(row[key]) ? "—" : row[key];
  if (key === "nombre") content = renderClienteLink(row.cliente_id, row.nombre);
  if (key === "parentesco") {
    const parentesco = badgeParentesco(row);
    content = (
      <Badge bg={parentesco.bg} text={parentesco.textColor} pill>
        {parentesco.text}
      </Badge>
    );
  }
  if (key === "producto") content = renderProducto(row);
  if (key === "estado_cobertura") {
    const tipo = badgeTipoCobertura(row.estado_cobertura);
    content = (
      <Badge bg={tipo.bg} text={tipo.textColor} pill>
        {tipo.text}
      </Badge>
    );
  }
  if (key === "estado") {
    const estado = badgeEstadoReporte(row.estado);
    content = (
      <Badge bg={estado.bg} text={estado.textColor} pill>
        {estado.text}
      </Badge>
    );
  }
  if (MONTOS.has(key)) content = formatPrecio(row[key]);
  if (FECHAS.has(key)) content = formatDate(row[key]);

  return (
    <td key={key} className={key === "estado" ? "text-end" : undefined}>
      {content}
    </td>
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
  const [responsablesApi, setResponsablesApi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [gruposAbiertos, setGruposAbiertos] = useState(() => new Set());
  const [columnasVisibles, setColumnasVisibles] = useState(leerColumnasGuardadas);
  const [showColumnas, setShowColumnas] = useState(false);
  const [filtrosColumna, setFiltrosColumna] = useState({});
  const [opcionesFiltro, setOpcionesFiltro] = useState({});
  const [exportando, setExportando] = useState(false);
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
    if (!Array.isArray(params.responsable) || params.responsable.length === 0) {
      delete params.responsable;
    }
    if (!Array.isArray(params.estado_cobertura) || params.estado_cobertura.length === 0) {
      delete params.estado_cobertura;
    }
    const filtros = {};
    columnasVisibles.forEach((clave) => {
      const tipo = tipoFiltroColumna(clave);
      const valor = filtrosColumna[clave];
      if (!tipo || valor == null) return;
      if (tipo === "texto" && String(valor).trim() !== "") filtros[clave] = String(valor).trim();
      if (tipo === "lista" && Array.isArray(valor) && valor.length) filtros[clave] = valor;
      if ((tipo === "fecha" || tipo === "numero") && (valor.desde || valor.hasta)) {
        filtros[clave] = {
          ...(valor.desde ? { desde: valor.desde } : {}),
          ...(valor.hasta ? { hasta: valor.hasta } : {}),
        };
      }
    });
    if (Object.keys(filtros).length) params.filtros = filtros;
    return params;
  }, [filters, filtrosColumna, columnasVisibles]);

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
      setResponsablesApi(Array.isArray(response?.responsables) ? response.responsables : []);
      setOpcionesFiltro(
        response?.opciones && typeof response.opciones === "object" ? response.opciones : {}
      );
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

  const columnasActivas = useMemo(() => {
    const porClave = new Map(COLUMNAS_DIRECTORIO.map((columna) => [columna.key, columna]));
    return columnasVisibles.map((clave) => porClave.get(clave)).filter(Boolean);
  }, [columnasVisibles]);
  const colSpanTabla = 1 + columnasActivas.length;

  const aplicarColumnas = (claves) => {
    setColumnasVisibles(claves);
    guardarColumnas(claves);
    setFiltrosColumna((prev) => {
      const next = {};
      claves.forEach((clave) => {
        if (prev[clave] != null) next[clave] = prev[clave];
      });
      return next;
    });
    setFilters((prev) => ({ ...prev, page: 1 }));
    setShowColumnas(false);
  };

  const filtrosVisibles = columnasActivas.filter((columna) => tipoFiltroColumna(columna.key));

  const cambiarFiltroColumna = (clave, valor) => {
    setFiltrosColumna((prev) => ({ ...prev, [clave]: valor }));
    setFilters((prev) => ({ ...prev, page: 1 }));
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

  const exportarExcel = async () => {
    setExportando(true);
    setError(null);
    try {
      const response = await getReporteCoberturasPorParentesco({
        ...queryParams,
        page: 1,
        exportar: true,
      });
      const filas = Array.isArray(response?.data) ? response.data : [];
      const encabezados = columnasActivas.map((columna) => columna.label);
      const cuerpo = filas.map((fila) =>
        columnasActivas.map((columna) => valorExportacion(fila, columna.key))
      );
      const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...cuerpo]);
      hoja["!cols"] = encabezados.map((titulo) => ({ wch: Math.max(12, String(titulo).length + 2) }));
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Directorio");
      const buffer = XLSX.write(libro, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const fecha = new Date().toISOString().slice(0, 10);
      saveAs(blob, `directorio-de-grupos-${fecha}.xlsx`);
    } catch (err) {
      setError(err?.message || "No se pudo exportar el directorio.");
    } finally {
      setExportando(false);
    }
  };

  const limpiarFiltros = () => {
    setSearchInput("");
    setFilters({ ...DEFAULT_FILTERS });
    setFiltrosColumna({});
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
            <Button
              variant="light"
              size="sm"
              onClick={exportarExcel}
              disabled={loading || exportando || !(meta.total > 0)}
            >
              <FaFileExcel className="me-1" />
              {exportando ? "Exportando..." : "Excel"}
            </Button>
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
                <div className="ccr-report__label">Responsable</div>
                <Select
                  isMulti
                  closeMenuOnSelect={false}
                  options={responsablesApi.map((nombre) => ({
                    value: nombre,
                    label: nombre,
                  }))}
                  value={responsablesApi
                    .filter((nombre) => filters.responsable.includes(nombre))
                    .map((nombre) => ({ value: nombre, label: nombre }))}
                  onChange={(selected) =>
                    handleFilterChange(
                      "responsable",
                      (selected || []).map((opcion) => opcion.value)
                    )
                  }
                  placeholder="Todos los responsables"
                  noOptionsMessage={() => "Sin responsables"}
                  styles={selectStyles}
                  aria-label="Filtrar por responsable"
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

          {filtrosVisibles.length > 0 && (
            <div className="ccr-report__section">
              <div className="ccr-report__section-title">
                <FaFilter aria-hidden="true" />
                Filtros de las columnas visibles
              </div>
              <Row className="g-3 align-items-end">
                {filtrosVisibles.map((columna) => {
                  const tipo = tipoFiltroColumna(columna.key);
                  const valor = filtrosColumna[columna.key];
                  if (tipo === "lista") {
                    const opciones = opcionesDeFiltro(columna.key, opcionesFiltro[columna.key]);
                    const seleccion = Array.isArray(valor) ? valor : [];
                    return (
                      <Col key={columna.key} md={6} lg={3}>
                        <div className="ccr-report__label">{columna.label}</div>
                        <Select
                          isMulti
                          closeMenuOnSelect={false}
                          options={opciones}
                          value={opciones.filter((opcion) => seleccion.includes(opcion.value))}
                          onChange={(selected) =>
                            cambiarFiltroColumna(
                              columna.key,
                              (selected || []).map((opcion) => opcion.value)
                            )
                          }
                          placeholder="Todos"
                          noOptionsMessage={() => "Sin opciones"}
                          menuPortalTarget={document.body}
                          menuPosition="fixed"
                          styles={{
                            ...selectStyles,
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          }}
                          aria-label={`Filtrar por ${columna.label}`}
                        />
                      </Col>
                    );
                  }
                  if (tipo === "fecha" || tipo === "numero") {
                    const rango = valor && typeof valor === "object" ? valor : {};
                    return (
                      <Col key={columna.key} md={6} lg={3}>
                        <div className="ccr-report__label">{columna.label}</div>
                        <div className="d-flex gap-2">
                          <Form.Control
                            type={tipo === "fecha" ? "date" : "number"}
                            value={rango.desde || ""}
                            placeholder={tipo === "fecha" ? "Desde" : "Mínimo"}
                            aria-label={`${columna.label} desde`}
                            onChange={(event) =>
                              cambiarFiltroColumna(columna.key, {
                                ...rango,
                                desde: event.target.value,
                              })
                            }
                          />
                          <Form.Control
                            type={tipo === "fecha" ? "date" : "number"}
                            value={rango.hasta || ""}
                            placeholder={tipo === "fecha" ? "Hasta" : "Máximo"}
                            aria-label={`${columna.label} hasta`}
                            onChange={(event) =>
                              cambiarFiltroColumna(columna.key, {
                                ...rango,
                                hasta: event.target.value,
                              })
                            }
                          />
                        </div>
                      </Col>
                    );
                  }
                  return (
                    <Col key={columna.key} md={6} lg={3}>
                      <div className="ccr-report__label">{columna.label}</div>
                      <Form.Control
                        value={typeof valor === "string" ? valor : ""}
                        placeholder={`Contiene…`}
                        aria-label={`Filtrar por ${columna.label}`}
                        onChange={(event) => cambiarFiltroColumna(columna.key, event.target.value)}
                      />
                    </Col>
                  );
                })}
              </Row>
            </div>
          )}

          <div className="ccr-report__summary">
            <strong>{resumen.grupos ?? 0}</strong> grupos ·{" "}
            <strong>{resumen.coberturas ?? resumen.total ?? 0}</strong> coberturas
            {" · "}
            {resumen.tomadores} tomadores · {resumen.conyuges} cónyuges · {resumen.otros} otros
            {" · "}
            mostrando <strong>{data.length}</strong> de <strong>{meta.total ?? 0}</strong> en esta página
          </div>

          <div className="ccr-report__section ccr-report__section--table">
            <div className="ccr-report__resultados-head">
              <div className="ccr-report__section-title">
                <FaTable aria-hidden="true" />
                Resultados
              </div>
              <Button
                type="button"
                variant="outline-primary"
                size="sm"
                className="ccr-report__columnas-btn"
                onClick={() => setShowColumnas(true)}
              >
                <FaColumns aria-hidden="true" />
                Columnas
                <span className="ccr-report__columnas-count">{columnasActivas.length}</span>
                {!esVistaInicial(columnasVisibles) && (
                  <span className="visually-hidden">vista personalizada</span>
                )}
              </Button>
            </div>
            <DirectorioGruposColumnasModal
              show={showColumnas}
              seleccion={columnasVisibles}
              onHide={() => setShowColumnas(false)}
              onAplicar={aplicarColumnas}
            />
            <div className="ccr-report__table-wrap hcc-table-wrap border-0 rounded-0">
              <Table hover className="hcc-table mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: "2.5rem" }} aria-label="Abrir grupo" />
                    {columnasActivas.map((columna) => (
                      <th
                        key={columna.key}
                        className={`ccr-report__sortable${columna.key === "estado" ? " text-end" : ""}`}
                        onClick={() => handleSort(columna.key)}
                      >
                        {columna.label}
                        {sortIcon(columna.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={colSpanTabla} className="text-center py-5">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Cargando informe...
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={colSpanTabla} className="ccr-report__empty">
                        No hay coberturas para los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    filasAgrupadas.map(({ row, inicio, ultima, span, tieneTomador, banda }) => {
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
                          {columnasActivas.map((columna) =>
                            renderCelda(row, columna, inicio, span)
                          )}
                        </tr>
                        {ultima && tieneTomador && abierto && (
                          <tr className="ccr-report__acordeon-detalle">
                            <td colSpan={colSpanTabla} className="bg-white border-bottom p-3">
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
