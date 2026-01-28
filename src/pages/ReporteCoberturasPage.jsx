// pages/ReporteCoberturasPage.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Table, Button, Badge, Alert, Spinner, Form } from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import { FaSort, FaSortUp, FaSortDown, FaFileAlt } from "react-icons/fa";
import { getReporteCoberturas } from "../services/reportesService";
import { fetchCompanies } from "../services/companies";
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
 * Columnas ordenables permitidas
 */
const SORTABLE_COLUMNS = {
  fecha_activacion: "fecha_activacion",
  cliente: "cliente",
  codigo_poliza: "codigo_poliza",
  req_pendientes: "req_pendientes",
  req_total: "req_total",
};

const ReporteCoberturasPage = () => {
  const toast = useToast();
  
  // Estado de datos
  const [coberturas, setCoberturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({ page: 1, per_page: 25, total: 0, last_page: 1 });
  
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
  
  // Cargar datos cuando cambian los filtros
  useEffect(() => {
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
          // Verificar si la respuesta tiene estructura { data: [...], meta: {...} } o es directamente un array
          if (Array.isArray(response)) {
            setCoberturas(response);
            setMeta({ page: 1, per_page: response.length, total: response.length, last_page: 1 });
          } else {
            setCoberturas(response?.data || []);
            setMeta(response?.meta || { page: 1, per_page: 25, total: 0, last_page: 1 });
          }
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
  }, [filters]); // Solo depende de filters para evitar loops infinitos
  
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
    setFilters((prev) => ({
      ...prev,
      ...tempFilters,
      page: 1, // Resetear a primera página al aplicar filtros
    }));
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
  
  return (
    <div className="container-fluid py-4">
      <Helmet>
        <title>Vantun/Reporte de Coberturas</title>
      </Helmet>
      
      <h2 className="mb-4">Reporte de Coberturas</h2>
      
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
          {meta.total > 0 && (
            <span className="text-muted">
              Total: {meta.total} | Página {meta.page} de {meta.last_page}
            </span>
          )}
        </div>
        <div className="card-body">
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
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("fecha_activacion")}
                      >
                        Fecha Activación {renderSortIcon("fecha_activacion")}
                      </th>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("codigo_poliza")}
                      >
                        Código Póliza {renderSortIcon("codigo_poliza")}
                      </th>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("cliente")}
                      >
                        Cliente {renderSortIcon("cliente")}
                      </th>
                      <th>Compañía</th>
                      <th>Responsable</th>
                      <th>Código Postal</th>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("req_pendientes")}
                      >
                        Requerimientos {renderSortIcon("req_pendientes")}
                      </th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coberturas.map((cobertura) => (
                      <tr key={cobertura.cobertura_id}>
                        <td>{formatDate(cobertura.fecha_activacion)}</td>
                        <td>{cobertura.codigo_poliza || "-"}</td>
                        <td>{cobertura.cliente || "-"}</td>
                        <td>{cobertura.compania || "-"}</td>
                        <td>{cobertura.responsable || "-"}</td>
                        <td>{cobertura.zip_code || "-"}</td>
                        <td>
                          {cobertura.req_total === 0 ? (
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
                          )}
                        </td>
                        <td>
                          <Button
                            variant={cobertura.req_total === 0 ? "secondary" : "primary"}
                            size="sm"
                            onClick={() => handleViewRequerimientos(cobertura)}
                            disabled={cobertura.req_total === 0}
                          >
                            <FaFileAlt className="me-1" />
                            {cobertura.req_total === 0
                              ? "Sin requerimientos"
                              : "Ver documentos"}
                          </Button>
                        </td>
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

