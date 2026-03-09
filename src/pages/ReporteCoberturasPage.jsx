// pages/ReporteCoberturasPage.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Table, Button, Badge, Alert, Spinner, Form } from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import { FaSort, FaSortUp, FaSortDown, FaFileAlt } from "react-icons/fa";
import { getReporteCoberturas } from "../services/reportesService";
import { fetchCompanies } from "../services/companies";
import systemConfigService from "../services/SystemConfigService";
import RequerimientosCoberturaModal from "../components/RequerimientosCoberturaModal";
import Pagination from "../components/Pagination";
import useToast from "../hooks/useToast";

/**
 * Construye los query params desde el estado de filtros
 */
const buildQueryParams = (filters) => {
  const params = {};
  
  if (filters.page) params.page = filters.page;
  if (filters.per_page) params.per_page = filters.per_page;
  if (filters.compania_id) params.compania_id = filters.compania_id;
  if (filters.zip_code) params.zip_code = filters.zip_code;
  // Solo enviar only_pending si es true
  if (filters.only_pending === true) {
    params.only_pending = true;
  }
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;
  if (filters.search) params.search = filters.search;
  // Solo enviar sort_by y sort_dir si sort_by tiene valor
  if (filters.sort_by) {
    params.sort_by = filters.sort_by;
    if (filters.sort_dir) {
      params.sort_dir = filters.sort_dir;
    }
  }
  
  return params;
};

/**
 * Formatea una fecha para mostrar
 */
const formatDate = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateString;
  }
};

/**
 * Formatea un valor monetario
 */
const formatCurrency = (value) => {
  if (!value && value !== 0) return "-";
  try {
    return new Intl.NumberFormat("es-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return value;
  }
};

/**
 * Formatea el status de la cobertura
 */
const formatStatus = (status) => {
  if (!status) return "-";
  
  const statusLower = status.toLowerCase();
  switch (statusLower) {
    case "active":
    case "activa":
    case "activo":
      return "Activa";
    case "pending":
    case "pendiente":
      return "Pendiente";
    case "cancelled":
    case "cancelada":
    case "cancelado":
      return "Cancelada";
    case "inactive":
    case "inactiva":
    case "inactivo":
      return "Inactiva";
    default:
      return status;
  }
};

/**
 * Columnas ordenables permitidas
 */
const SORTABLE_COLUMNS = {
  fecha_activacion: "fecha_activacion",
  cliente: "cliente",
  codigo_poliza: "codigo_poliza",
  req_pendientes: "req_pendientes",
  req_total: "req_total",
};

/**
 * Convierte una clave de columna (snake_case) en etiqueta legible.
 * Se usa cuando las columnas se derivan de los datos del reporte (Postgres) sin metadata.
 */
const keyToLabel = (key) => {
  if (!key || key === "acciones") return "Acciones";
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Columnas por defecto cuando el backend aún no ha devuelto metadata (reporting Postgres).
 * El reporte puede enviar response.columns o las columnas se derivan del primer registro de response.data.
 */
const FALLBACK_REPORT_COLUMNS = [
  { key: "fecha_activacion", label: "Fecha Activación" },
  { key: "codigo_poliza", label: "Código Póliza" },
  { key: "cliente", label: "Cliente" },
  { key: "compania", label: "Compañía" },
  { key: "responsable", label: "Responsable" },
  { key: "zip_code", label: "Código Postal" },
  { key: "condado", label: "Condado" },
  { key: "estado", label: "Estado" },
  { key: "precio", label: "Precio" },
  { key: "dia_pago", label: "Día Pago" },
  { key: "tipo_pago", label: "Tipo Pago" },
  { key: "ingreso_familiar_anual", label: "Ingreso Familiar Anual" },
  { key: "status", label: "Status" },
  { key: "req_pendientes", label: "Requerimientos" },
  { key: "acciones", label: "Acciones" },
];

const REPORT_COLUMNS_CONFIG_KEY = "reporte_coberturas_columns";

/**
 * Normaliza la definición de columnas que puede venir del reporting (Postgres):
 * - response.columns = [{ key, label }, ...] o [{ key }, ...] o ["key1", "key2", ...]
 * Devuelve array de { key, label } y añade la columna "acciones" al final.
 */
const normalizeReportColumns = (columnsOrKeys, firstRowKeys = null) => {
  const withAcciones = (list) => {
    if (list.some((c) => c.key === "acciones")) return list;
    return [...list, { key: "acciones", label: "Acciones" }];
  };

  if (Array.isArray(columnsOrKeys) && columnsOrKeys.length > 0) {
    const normalized = columnsOrKeys.map((item) => {
      if (typeof item === "string") {
        return { key: item, label: keyToLabel(item) };
      }
      if (item && typeof item === "object" && item.key) {
        return { key: item.key, label: item.label || keyToLabel(item.key) };
      }
      return null;
    }).filter(Boolean);
    return withAcciones(normalized);
  }

  if (Array.isArray(firstRowKeys) && firstRowKeys.length > 0) {
    const derived = firstRowKeys.map((key) => ({ key, label: keyToLabel(key) }));
    return withAcciones(derived);
  }

  return withAcciones([...FALLBACK_REPORT_COLUMNS.filter((c) => c.key !== "acciones")]);
};

const ReporteCoberturasPage = () => {
  const toast = useToast();
  
  // Estado de datos
  const [coberturas, setCoberturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({ page: 1, per_page: 25, total: 0, last_page: 1 });
  const [shouldFetch, setShouldFetch] = useState(false);
  const [reportColumns, setReportColumns] = useState(FALLBACK_REPORT_COLUMNS);
  const [visibleColumns, setVisibleColumns] = useState(() =>
    FALLBACK_REPORT_COLUMNS.map((c) => c.key)
  );
  const [showColumnsConfig, setShowColumnsConfig] = useState(false);
  const [loadingColumnsConfig, setLoadingColumnsConfig] = useState(false);
  const [savingColumnsConfig, setSavingColumnsConfig] = useState(false);
  const [columnsConfigLoaded, setColumnsConfigLoaded] = useState(false);
  const [columnsConfigEmpty, setColumnsConfigEmpty] = useState(false);
  
  // Estado de filtros
  const [filters, setFilters] = useState({
    page: 1,
    per_page: 25,
    compania_id: "",
    zip_code: "",
    only_pending: false,
    date_from: "",
    date_to: "",
    search: "",
    sort_by: "",
    sort_dir: "",
  });
  
  // Estado de filtros temporales (antes de aplicar)
  const [tempFilters, setTempFilters] = useState({
    compania_id: "",
    zip_code: "",
    only_pending: false,
    date_from: "",
    date_to: "",
    search: "",
  });
  
  // Estado para compañías
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  
  // Estado para el modal de requerimientos
  const [showModal, setShowModal] = useState(false);
  const [selectedCobertura, setSelectedCobertura] = useState(null);
  
  // AbortController para cancelar peticiones
  const abortControllerRef = useRef(null);
  
  // Cargar compañías al montar
  useEffect(() => {
    const loadCompanies = async () => {
      setLoadingCompanies(true);
      try {
        const data = await fetchCompanies();
        setCompanies(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error al cargar compañías:", err);
      } finally {
        setLoadingCompanies(false);
      }
    };
    loadCompanies();
  }, []);
  /**
   * Carga la configuración de columnas desde system-config (si existe).
   * Se invoca de forma perezosa cuando el usuario abre el panel de columnas,
   * para no hacer peticiones adicionales al entrar al reporte.
   */
  const loadColumnsConfig = useCallback(async () => {
    // Evitar recargar si ya se intentó al menos una vez
    if (columnsConfigLoaded || loadingColumnsConfig) return;

    setLoadingColumnsConfig(true);
    try {
      const response = await systemConfigService.get(REPORT_COLUMNS_CONFIG_KEY);
      // El backend puede devolver un array simple o un objeto { value, visible }
      const stored =
        Array.isArray(response)
          ? response
          : Array.isArray(response?.visible)
          ? response.visible
          : Array.isArray(response?.value)
          ? response.value
          : null;

      if (Array.isArray(stored)) {
        if (stored.length === 0) {
          // Configuración existente pero sin columnas definidas
          setColumnsConfigEmpty(true);
        } else {
          const validKeys = reportColumns.map((c) => c.key);
          const filtered = stored.filter((key) => validKeys.includes(key));
          if (filtered.length > 0) {
            setVisibleColumns(filtered);
          }
          setColumnsConfigEmpty(false);
        }
      }
    } catch (err) {
      console.error("Error al cargar configuración de columnas del reporte:", err);
      const status = err?.response?.status ?? err?.status;
      // Si la clave aún no existe en system-config (404), usamos configuración por defecto sin mostrar error.
      if (status !== 404 && toast && typeof toast.showError === "function") {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "No se pudieron cargar las columnas personalizadas del reporte.";
        toast.showError(message);
      }
    } finally {
      setColumnsConfigLoaded(true);
      setLoadingColumnsConfig(false);
    }
  }, [columnsConfigLoaded, loadingColumnsConfig, reportColumns, toast]);
  
  // Cargar datos cuando cambian los filtros
  useEffect(() => {
    // No hacer petición inicial al montar la página.
    // Solo se debe consultar el endpoint después de que el usuario pulse "Aplicar Filtros".
    if (!shouldFetch) {
      return;
    }

    let isMounted = true;
    let currentAbortController = null;
    
    // Cancelar petición anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Crear nuevo AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    currentAbortController = abortController;
    
    setLoading(true);
    setError(null);
    
    const loadData = async () => {
      try {
        const params = buildQueryParams(filters);
        const response = await getReporteCoberturas(params, abortController.signal);
        
        // Solo actualizar estado si el componente sigue montado, la petición no fue cancelada
        // y es la petición actual (no una anterior)
        if (!abortController.signal.aborted && isMounted && currentAbortController === abortControllerRef.current) {
          const data = Array.isArray(response) ? response : response?.data || [];
          const metaData = response?.meta || { page: 1, per_page: 25, total: 0, last_page: 1 };

          setCoberturas(data);
          setMeta(Array.isArray(response) ? { page: 1, per_page: response.length, total: response.length, last_page: 1 } : metaData);

          // Columnas del reporting (Postgres): backend puede enviar response.columns o se derivan del primer registro
          const fromBackend = response?.columns;
          const firstRowKeys = data.length > 0 ? Object.keys(data[0]) : null;
          const nextReportColumns = normalizeReportColumns(fromBackend, firstRowKeys);
          setReportColumns(nextReportColumns);

          const nextKeys = nextReportColumns.map((c) => c.key);
          setVisibleColumns((prev) => {
            const valid = prev.filter((k) => nextKeys.includes(k));
            return valid.length > 0 ? valid : nextKeys;
          });

          setError(null); // Limpiar errores previos si la carga fue exitosa
        }
      } catch (err) {
        // Ignorar errores de cancelación silenciosamente
        if (err.message === "Petición cancelada" || err.name === "AbortError") {
          return;
        }
        
        // Solo mostrar error si el componente sigue montado y es la petición actual
        if (isMounted && currentAbortController === abortControllerRef.current) {
          const errorMessage = err.response?.data?.message || err.message || "Error al cargar el reporte de coberturas";
          setError(errorMessage);
          // Usar toast de forma segura sin incluirlo en dependencias
          if (toast && typeof toast.showError === 'function') {
            toast.showError(errorMessage);
          }
          console.error("Error al cargar reporte:", err);
          setCoberturas([]);
          setMeta({ page: 1, per_page: 25, total: 0, last_page: 1 });
        }
      } finally {
        // Solo actualizar loading si el componente sigue montado, la petición no fue cancelada
        // y es la petición actual
        if (isMounted && !abortController.signal.aborted && currentAbortController === abortControllerRef.current) {
          setLoading(false);
        }
      }
    };
    
    loadData();
    
    // Cleanup: cancelar petición y marcar como desmontado
    return () => {
      isMounted = false;
      if (currentAbortController) {
        currentAbortController.abort();
      }
    };
  }, [filters, shouldFetch]); // Depende de filters y del flag shouldFetch para evitar llamadas iniciales innecesarias
  
  // Sincronizar filtros temporales con filtros activos solo cuando cambian realmente
  const prevFiltersRef = useRef(filters);
  
  useEffect(() => {
    // Solo actualizar si realmente cambiaron los filtros relevantes
    const filtersChanged = 
      prevFiltersRef.current.compania_id !== filters.compania_id ||
      prevFiltersRef.current.zip_code !== filters.zip_code ||
      prevFiltersRef.current.only_pending !== filters.only_pending ||
      prevFiltersRef.current.date_from !== filters.date_from ||
      prevFiltersRef.current.date_to !== filters.date_to ||
      prevFiltersRef.current.search !== filters.search;
    
    if (filtersChanged) {
      setTempFilters({
        compania_id: filters.compania_id,
        zip_code: filters.zip_code,
        only_pending: filters.only_pending,
        date_from: filters.date_from,
        date_to: filters.date_to,
        search: filters.search,
      });
      prevFiltersRef.current = filters;
    }
  }, [filters]);
  
  // Manejar cambio de filtros temporales
  const handleTempFilterChange = (key, value) => {
    setTempFilters((prev) => ({ ...prev, [key]: value }));
  };
  
  // Aplicar filtros
  const handleApplyFilters = () => {
    // A partir de este momento se permiten peticiones al endpoint
    setShouldFetch(true);
    setFilters((prev) => ({
      ...prev,
      ...tempFilters,
      page: 1, // Resetear a primera página al aplicar filtros
    }));
  };

  // Manejar visibilidad de columnas
  const toggleColumn = (key) => {
    setVisibleColumns((prev) => {
      const exists = prev.includes(key);
      if (exists) {
        // Evitar dejar la tabla sin columnas visibles
        if (prev.length === 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleSelectAllColumns = () => {
    setVisibleColumns(reportColumns.map((c) => c.key));
  };

  const handleSaveColumnsConfig = async () => {
    setSavingColumnsConfig(true);
    try {
      await systemConfigService.put(REPORT_COLUMNS_CONFIG_KEY, visibleColumns, "json");
      if (toast && typeof toast.showSuccess === "function") {
        toast.showSuccess("Configuración de columnas del reporte guardada correctamente.");
      }
    } catch (err) {
      console.error("Error al guardar configuración de columnas del reporte:", err);
      if (toast && typeof toast.showError === "function") {
        const message =
          err?.message ||
          err?.response?.data?.message ||
          "Error al guardar configuración de columnas del reporte.";
        toast.showError(message);
      }
    } finally {
      setSavingColumnsConfig(false);
    }
  };
  
  // Limpiar filtros
  const handleClearFilters = () => {
    const clearedFilters = {
      compania_id: "",
      zip_code: "",
      only_pending: false,
      date_from: "",
      date_to: "",
      search: "",
    };
    setTempFilters(clearedFilters);
    setFilters((prev) => ({
      ...prev,
      ...clearedFilters,
      page: 1,
    }));
  };
  
  // Manejar ordenamiento
  const handleSort = (column) => {
    if (!SORTABLE_COLUMNS[column]) return;
    
    setFilters((prev) => ({
      ...prev,
      sort_by: column,
      sort_dir: prev.sort_by === column && prev.sort_dir === "asc" ? "desc" : "asc",
      page: 1, // Resetear a primera página al ordenar
    }));
  };
  
  // Limpiar ordenamiento
  const handleClearSort = () => {
    setFilters((prev) => ({
      ...prev,
      sort_by: "",
      sort_dir: "",
      page: 1,
    }));
  };
  
  // Manejar cambio de página
  const handlePageChange = (page) => {
    setFilters((prev) => ({ ...prev, page }));
  };
  
  // Manejar cambio de per_page
  const handlePerPageChange = (e) => {
    const perPage = parseInt(e.target.value, 10);
    setFilters((prev) => ({ ...prev, per_page: perPage, page: 1 }));
  };
  
  // Abrir modal de requerimientos
  const handleViewRequerimientos = (cobertura) => {
    setSelectedCobertura(cobertura);
    setShowModal(true);
  };
  
  // Cerrar modal
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCobertura(null);
  };
  
  // Renderizar icono de ordenamiento
  const renderSortIcon = (column) => {
    if (filters.sort_by !== column) {
      return <FaSort className="ms-1 text-muted" />;
    }
    return filters.sort_dir === "asc" ? (
      <FaSortUp className="ms-1" />
    ) : (
      <FaSortDown className="ms-1" />
    );
  };

  const isColumnVisible = (key) => visibleColumns.includes(key);

  const renderCell = (cobertura, columnKey) => {
    switch (columnKey) {
      case "fecha_activacion":
        return formatDate(cobertura.fecha_activacion);
      case "codigo_poliza":
        return cobertura.codigo_poliza || "-";
      case "cliente":
        return cobertura.cliente || "-";
      case "compania":
        return cobertura.compania || "-";
      case "responsable":
        return cobertura.responsable || "-";
      case "zip_code":
        return cobertura.zip_code || "-";
      case "condado":
        return cobertura.condado || "-";
      case "estado":
        return cobertura.estado || "-";
      case "precio":
        return formatCurrency(cobertura.precio);
      case "dia_pago":
        return cobertura.dia_pago || "-";
      case "tipo_pago":
        return cobertura.tipo_pago || "-";
      case "ingreso_familiar_anual":
        return formatCurrency(cobertura.ingreso_familiar_anual);
      case "status":
        return formatStatus(cobertura.status);
      case "req_pendientes":
        return cobertura.req_total === 0 ? (
          <span className="text-muted">0/0</span>
        ) : (
          <>
            {cobertura.req_pendientes > 0 && (
              <Badge bg="warning" className="me-1">
                {cobertura.req_pendientes}
              </Badge>
            )}
            <span>
              {cobertura.req_pendientes}/{cobertura.req_total}
            </span>
          </>
        );
      case "acciones":
        return (
          <Button
            variant={cobertura.req_total === 0 ? "secondary" : "primary"}
            size="sm"
            onClick={() => handleViewRequerimientos(cobertura)}
            disabled={cobertura.req_total === 0}
          >
            <FaFileAlt className="me-1" />
            {cobertura.req_total === 0 ? "Sin requerimientos" : "Ver documentos"}
          </Button>
        );
      default:
        return cobertura[columnKey] ?? "-";
    }
  };
  
  return (
    <div className="container-fluid py-4">
      <Helmet>
        <title>Reporte de Coberturas</title>
      </Helmet>
      
      <h2 className="mb-4">Reporte General</h2>
      
      {/* Filtros */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0">Filtros</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {/* Búsqueda */}
            <div className="col-md-3">
              <Form.Label>Búsqueda</Form.Label>
              <Form.Control
                type="text"
                placeholder="Cliente o código póliza..."
                value={tempFilters.search}
                onChange={(e) => handleTempFilterChange("search", e.target.value)}
              />
            </div>
            
            {/* Compañía */}
            <div className="col-md-2">
              <Form.Label>Compañía</Form.Label>
              <Form.Select
                value={tempFilters.compania_id}
                onChange={(e) => handleTempFilterChange("compania_id", e.target.value)}
                disabled={loadingCompanies}
              >
                <option value="">Todas</option>
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.nombre}
                  </option>
                ))}
              </Form.Select>
            </div>
            
            {/* Código Postal */}
            <div className="col-md-2">
              <Form.Label>Código Postal</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ej: 33101"
                value={tempFilters.zip_code}
                onChange={(e) => handleTempFilterChange("zip_code", e.target.value)}
              />
            </div>
            
            {/* Solo Pendientes */}
            <div className="col-md-2">
              <Form.Label>&nbsp;</Form.Label>
              <Form.Check
                type="checkbox"
                label="Solo pendientes"
                checked={tempFilters.only_pending}
                onChange={(e) => handleTempFilterChange("only_pending", e.target.checked)}
                className="mt-2"
              />
            </div>
            
            {/* Fecha Desde */}
            <div className="col-md-2">
              <Form.Label>Fecha Desde</Form.Label>
              <Form.Control
                type="date"
                value={tempFilters.date_from}
                onChange={(e) => handleTempFilterChange("date_from", e.target.value)}
              />
            </div>
            
            {/* Fecha Hasta */}
            <div className="col-md-2">
              <Form.Label>Fecha Hasta</Form.Label>
              <Form.Control
                type="date"
                value={tempFilters.date_to}
                onChange={(e) => handleTempFilterChange("date_to", e.target.value)}
              />
            </div>
            
            {/* Resultados por página */}
            <div className="col-md-2">
              <Form.Label>Resultados por página</Form.Label>
              <Form.Select value={filters.per_page} onChange={handlePerPageChange}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </Form.Select>
            </div>
            
            {/* Botones */}
            <div className="col-md-12 d-flex gap-2 mt-3">
              <Button variant="primary" onClick={handleApplyFilters}>
                Aplicar Filtros
              </Button>
              <Button variant="secondary" onClick={handleClearFilters}>
                Limpiar
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mensaje de error */}
      {error && (
        <Alert variant="danger" className="mb-4">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
        </Alert>
      )}
      
      {/* Tabla */}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Coberturas</h5>
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => {
                setShowColumnsConfig((prev) => {
                  const next = !prev;
                  // Cargar configuración de columnas solo la primera vez que se abre el panel
                  if (next) {
                    loadColumnsConfig();
                  }
                  return next;
                });
              }}
            >
              Columnas
            </Button>
            {meta.total > 0 && (
              <span className="text-muted">
                Total: {meta.total} | Página {meta.page} de {meta.last_page}
              </span>
            )}
          </div>
        </div>
        <div className="card-body">
          {showColumnsConfig && (
            <div className="mb-3 p-3 border rounded bg-light">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="small fw-semibold text-muted">
                  Selecciona las columnas que quieres ver en el reporte
                </span>
                <div className="d-flex gap-2">
                  <Button
                    size="sm"
                    variant="link"
                    className="p-0"
                    onClick={handleSelectAllColumns}
                  >
                    Seleccionar todas
                  </Button>
                </div>
              </div>

              {loadingColumnsConfig ? (
                <div className="d-flex align-items-center gap-2">
                  <Spinner animation="border" size="sm" />
                  <span className="small text-muted">Cargando configuración de columnas...</span>
                </div>
              ) : columnsConfigEmpty ? (
                <div className="alert alert-warning py-2 small mb-2">
                  Debes configurar en el <strong>Configurador</strong> las columnas a mostrar para este informe
                  (<code>reporte_coberturas_columns</code>) o seleccionarlas aquí y guardarlas como predeterminadas.
                </div>
              ) : (
                <div className="row">
                  {reportColumns.map((col) => (
                    <div key={col.key} className="col-md-3 mb-2">
                      <Form.Check
                        type="checkbox"
                        id={`column-${col.key}`}
                        label={col.label}
                        checked={isColumnVisible(col.key)}
                        onChange={() => toggleColumn(col.key)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveColumnsConfig}
                  disabled={savingColumnsConfig}
                >
                  {savingColumnsConfig ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar como predeterminado"
                  )}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Cargando...</span>
              </Spinner>
              <p className="mt-2 text-muted">Cargando coberturas...</p>
            </div>
          ) : coberturas.length === 0 ? (
            <Alert variant="info">
              No se encontraron coberturas con los filtros aplicados.
            </Alert>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      {reportColumns.filter((col) => isColumnVisible(col.key)).map((col) => {
                        const isSortable = !!SORTABLE_COLUMNS[col.key];
                        return (
                          <th
                            key={col.key}
                            style={isSortable ? { cursor: "pointer" } : undefined}
                            onClick={isSortable ? () => handleSort(col.key) : undefined}
                          >
                            {col.label}
                            {isSortable && renderSortIcon(col.key)}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {coberturas.map((cobertura) => (
                      <tr key={cobertura.cobertura_id}>
                        {reportColumns.filter((col) => isColumnVisible(col.key)).map((col) => (
                          <td key={col.key}>{renderCell(cobertura, col.key)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              
              {/* Paginación */}
              {meta.last_page > 1 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={meta.page}
                    totalPages={meta.last_page}
                    onPageChange={handlePageChange}
                    disabled={loading}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Modal de Requerimientos */}
      {selectedCobertura && (
        <RequerimientosCoberturaModal
          isOpen={showModal}
          onClose={handleCloseModal}
          cobertura={selectedCobertura}
        />
      )}
    </div>
  );
};

export default ReporteCoberturasPage;

