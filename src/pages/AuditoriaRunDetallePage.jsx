// pages/AuditoriaRunDetallePage.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Table, Button, Badge, Alert, Spinner, Form, Modal } from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import { FaSort, FaSortUp, FaSortDown, FaFileAlt, FaComment } from "react-icons/fa";
import { getRunReporte, updateItem, getRun } from "../services/auditoriasService";
import { fetchCompanies } from "../services/companies";
import RequerimientosCoberturaModal from "../components/RequerimientosCoberturaModal";
import Pagination from "../components/Pagination";
import useToast from "../hooks/useToast";

/**
 * Estados de auditoría permitidos
 */
const AUDIT_STATUSES = [
  { value: "PENDIENTE", label: "Pendiente", variant: "warning" },
  { value: "OK", label: "OK", variant: "success" },
  { value: "NOVEDAD", label: "Novedad", variant: "warning" },
  { value: "PERDIDA", label: "Perdida", variant: "danger" },
  { value: "SOLUCIONADO", label: "Solucionado", variant: "info" },
];

/**
 * Estados que requieren comentario obligatorio
 */
const STATUSES_REQUIRING_COMMENT = ["NOVEDAD", "PERDIDA"];

/**
 * Construye los query params desde el estado de filtros
 */
const buildQueryParams = (filters) => {
  const params = {};
  
  if (filters.page) params.page = filters.page;
  if (filters.per_page) params.per_page = filters.per_page;
  if (filters.compania_id) params.compania_id = filters.compania_id;
  if (filters.zip_code) params.zip_code = filters.zip_code;
  if (filters.audit_status) params.audit_status = filters.audit_status;
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;
  if (filters.search) params.search = filters.search;
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
 * Formatea fecha y hora para mostrar
 */
const formatDateTime = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
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
 * Columnas ordenables permitidas
 */
const SORTABLE_COLUMNS = {
  fecha_activacion: "fecha_activacion",
  cliente: "cliente",
  codigo_poliza: "codigo_poliza",
  grupo_familiar_id: "grupo_familiar_id",
  fecha_nacimiento: "fecha_nacimiento",
  precio: "precio",
  req_pendientes: "req_pendientes",
  req_total: "req_total",
};

const AuditoriaRunDetallePage = () => {
  const { runId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  // Estado de datos del run
  const [runInfo, setRunInfo] = useState(null);
  const [loadingRunInfo, setLoadingRunInfo] = useState(false);
  
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
    audit_status: "",
    date_from: "",
    date_to: "",
    search: "",
    sort_by: "",
    sort_dir: "",
  });
  
  // Estado de filtros temporales
  const [tempFilters, setTempFilters] = useState({
    compania_id: "",
    zip_code: "",
    audit_status: "",
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
  
  // Estado para edición de status
  const [editingItem, setEditingItem] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusForm, setStatusForm] = useState({
    status: "",
    comment: "",
  });
  const [savingStatus, setSavingStatus] = useState(false);
  
  // AbortController para cancelar peticiones
  const abortControllerRef = useRef(null);
  
  // Cargar información del run al montar
  useEffect(() => {
    if (!runId) return;
    
    const loadRunInfo = async () => {
      setLoadingRunInfo(true);
      try {
        const runData = await getRun(runId);
        setRunInfo(runData);
      } catch (err) {
        console.error("Error al cargar información del run:", err);
        // Si falla, al menos establecer un objeto básico
        setRunInfo({ id: runId, nombre: `Auditoría #${runId}`, audit_type: "SHERPA" });
      } finally {
        setLoadingRunInfo(false);
      }
    };
    
    loadRunInfo();
  }, [runId]);
  
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
    if (!runId) return;
    
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
        const response = await getRunReporte(runId, params, abortController.signal);
        
        if (!abortController.signal.aborted && isMounted && currentAbortController === abortControllerRef.current) {
          if (Array.isArray(response)) {
            setCoberturas(response);
            setMeta({ page: 1, per_page: response.length, total: response.length, last_page: 1 });
          } else {
            setCoberturas(response?.data || []);
            setMeta(response?.meta || { page: 1, per_page: 25, total: 0, last_page: 1 });
          }
          setError(null);
        }
      } catch (err) {
        if (err.message === "Petición cancelada" || err.name === "AbortError") {
          return;
        }
        
        if (isMounted && currentAbortController === abortControllerRef.current) {
          const errorMessage = err.response?.data?.message || err.message || "Error al cargar el reporte";
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
        if (isMounted && !abortController.signal.aborted && currentAbortController === abortControllerRef.current) {
          setLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
      if (currentAbortController) {
        currentAbortController.abort();
      }
    };
    // Usar dependencias específicas en lugar del objeto completo para evitar re-renders innecesarios
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    runId,
    filters.page,
    filters.per_page,
    filters.compania_id,
    filters.zip_code,
    filters.audit_status,
    filters.date_from,
    filters.date_to,
    filters.search,
    filters.sort_by,
    filters.sort_dir,
  ]);
  
  // Sincronizar filtros temporales con filtros activos (solo cuando cambian los filtros de búsqueda, no paginación)
  const prevFiltersRef = useRef({
    compania_id: "",
    zip_code: "",
    audit_status: "",
    date_from: "",
    date_to: "",
    search: "",
  });
  
  useEffect(() => {
    const currentFilterValues = {
      compania_id: filters.compania_id,
      zip_code: filters.zip_code,
      audit_status: filters.audit_status,
      date_from: filters.date_from,
      date_to: filters.date_to,
      search: filters.search,
    };
    
    const filtersChanged = 
      prevFiltersRef.current.compania_id !== currentFilterValues.compania_id ||
      prevFiltersRef.current.zip_code !== currentFilterValues.zip_code ||
      prevFiltersRef.current.audit_status !== currentFilterValues.audit_status ||
      prevFiltersRef.current.date_from !== currentFilterValues.date_from ||
      prevFiltersRef.current.date_to !== currentFilterValues.date_to ||
      prevFiltersRef.current.search !== currentFilterValues.search;
    
    if (filtersChanged) {
      setTempFilters(currentFilterValues);
      prevFiltersRef.current = currentFilterValues;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.compania_id, filters.zip_code, filters.audit_status, filters.date_from, filters.date_to, filters.search]);
  
  // Manejar cambio de filtros temporales
  const handleTempFilterChange = (key, value) => {
    setTempFilters((prev) => ({ ...prev, [key]: value }));
  };
  
  // Aplicar filtros
  const handleApplyFilters = () => {
    setFilters((prev) => ({
      ...prev,
      ...tempFilters,
      page: 1,
    }));
  };
  
  // Limpiar filtros
  const handleClearFilters = () => {
    const clearedFilters = {
      compania_id: "",
      zip_code: "",
      audit_status: "",
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
  
  // Abrir modal de edición de status
  const handleEditStatus = (cobertura) => {
    setEditingItem(cobertura);
    setStatusForm({
      status: cobertura.audit_status || "PENDIENTE",
      comment: cobertura.audit_comment || "",
    });
    setShowStatusModal(true);
  };
  
  // Cerrar modal de status
  const handleCloseStatusModal = () => {
    setShowStatusModal(false);
    setEditingItem(null);
    setStatusForm({ status: "", comment: "" });
  };
  
  // Guardar cambio de status
  const handleSaveStatus = async () => {
    if (!editingItem) return;
    
    // Validar comentario obligatorio
    if (STATUSES_REQUIRING_COMMENT.includes(statusForm.status) && !statusForm.comment?.trim()) {
      toast.showWarning("El comentario es obligatorio para este estado");
      return;
    }
    
    setSavingStatus(true);
    
    try {
      // Construir payload: comment solo si tiene valor o es requerido
      const payload = {
        status: statusForm.status,
      };
      
      // Incluir comment si tiene valor o si es requerido (aunque esté vacío, la validación previa lo evita)
      if (statusForm.comment?.trim()) {
        payload.comment = statusForm.comment.trim();
      } else if (STATUSES_REQUIRING_COMMENT.includes(statusForm.status)) {
        // Esto no debería pasar por la validación previa, pero por seguridad
        payload.comment = "";
      }
      
      // Usar el ID correcto según el target_type del run
      // Puede ser cobertura_id o cliente_id
      const entityId = editingItem.cobertura_id || editingItem.cliente_id;
      if (!entityId) {
        toast.showError("No se pudo identificar el ID de la entidad");
        return;
      }
      
      await updateItem(runId, entityId, payload);
      
      toast.showSuccess("Estado actualizado exitosamente");
      
      // Refrescar los datos para obtener la información actualizada del servidor
      // Esto asegura que las métricas y estados estén sincronizados
      try {
        const params = buildQueryParams(filters);
        const response = await getRunReporte(runId, params);
        
        if (Array.isArray(response)) {
          setCoberturas(response);
          setMeta({ page: 1, per_page: response.length, total: response.length, last_page: 1 });
        } else {
          setCoberturas(response?.data || []);
          setMeta(response?.meta || { page: 1, per_page: 25, total: 0, last_page: 1 });
        }
      } catch (refreshError) {
        console.error("Error al refrescar datos después de actualizar:", refreshError);
        // Si falla el refresh, al menos actualizar el item local
        const currentEntityId = editingItem.cobertura_id || editingItem.cliente_id;
        setCoberturas((prev) =>
          prev.map((item) => {
            const itemId = item.cobertura_id || item.cliente_id;
            return itemId === currentEntityId
              ? {
                  ...item,
                  audit_status: statusForm.status,
                  audit_comment: statusForm.comment || null,
                  reviewed_at: new Date().toISOString(),
                }
              : item;
          })
        );
      }
      
      handleCloseStatusModal();
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Error al actualizar el estado";
      toast.showError(errorMessage);
      console.error("Error al actualizar status:", err);
    } finally {
      setSavingStatus(false);
    }
  };
  
  // Obtener badge variant para status
  const getStatusBadgeVariant = (status) => {
    const statusObj = AUDIT_STATUSES.find((s) => s.value === status);
    return statusObj?.variant || "secondary";
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
        <title>
          {runInfo?.nombre 
            ? `${runInfo.nombre} - Detalle` 
            : `Detalle de Auditoría #${runId}`}
        </title>
      </Helmet>
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          {loadingRunInfo ? (
            <h2>
              <Spinner animation="border" size="sm" className="me-2" />
              Cargando...
            </h2>
          ) : runInfo ? (
            <h2>
              {runInfo.nombre || `Auditoría #${runId}`}
              {runInfo.audit_type && (
                <Badge 
                  bg={runInfo.audit_type === "SHERPA" ? "primary" : "info"} 
                  className="ms-2"
                  title={`Tipo: ${runInfo.audit_type}`}
                >
                  {runInfo.audit_type}
                </Badge>
              )}
            </h2>
          ) : (
            <h2>Auditoría #{runId}</h2>
          )}
        </div>
        <Button variant="secondary" onClick={() => navigate("/auditorias")}>
          Volver a Auditorías
        </Button>
      </div>
      
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
            
            {/* Estado de Auditoría */}
            <div className="col-md-2">
              <Form.Label>Estado Auditoría</Form.Label>
              <Form.Select
                value={tempFilters.audit_status}
                onChange={(e) => handleTempFilterChange("audit_status", e.target.value)}
              >
                <option value="">Todos</option>
                {AUDIT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </Form.Select>
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
                        onClick={() => handleSort("grupo_familiar_id")}
                        title="Identificador único del grupo familiar al que pertenece la cobertura"
                      >
                        GF {renderSortIcon("grupo_familiar_id")}
                      </th>
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
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("fecha_nacimiento")}
                      >
                        Fecha Nacimiento {renderSortIcon("fecha_nacimiento")}
                      </th>
                      <th>Compañía</th>
                      <th>Responsable</th>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("precio")}
                      >
                        Precio {renderSortIcon("precio")}
                      </th>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("req_pendientes")}
                      >
                        Requerimientos {renderSortIcon("req_pendientes")}
                      </th>
                      <th>Estado Auditoría</th>
                      <th>Revisado En</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coberturas.map((cobertura) => {
                      const entityId = cobertura.cobertura_id || cobertura.cliente_id;
                      return (
                        <tr key={entityId}>
                        <td>{cobertura.grupo_familiar_id || cobertura.grupo_familiar?.id || cobertura.gf_id || "-"}</td>
                        <td>{formatDate(cobertura.fecha_activacion)}</td>
                        <td>{cobertura.codigo_poliza || "-"}</td>
                        <td>{cobertura.cliente || "-"}</td>
                        <td>{formatDate(cobertura.fecha_nacimiento || cobertura.cliente?.fecha_nacimiento || cobertura.fechaNacimiento)}</td>
                        <td>{cobertura.compania || "-"}</td>
                        <td>{cobertura.responsable || "-"}</td>
                        <td>{formatCurrency(cobertura.precio)}</td>
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
                          <Badge bg={getStatusBadgeVariant(cobertura.audit_status || "PENDIENTE")}>
                            {cobertura.audit_status || "PENDIENTE"}
                          </Badge>
                        </td>
                        <td>{formatDateTime(cobertura.reviewed_at)}</td>
                        <td>
                          <div className="d-flex gap-1">
                            <Button
                              variant={cobertura.req_total === 0 ? "secondary" : "primary"}
                              size="sm"
                              onClick={() => handleViewRequerimientos(cobertura)}
                              disabled={cobertura.req_total === 0}
                              title="Ver documentos"
                            >
                              <FaFileAlt />
                            </Button>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEditStatus(cobertura)}
                              title="Editar estado"
                            >
                              <FaComment />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
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
      
      {/* Modal de Edición de Status */}
      <Modal show={showStatusModal} onHide={handleCloseStatusModal} backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Editar Estado de Auditoría</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingItem && (
            <>
              <p className="mb-3">
                <strong>Cliente:</strong> {editingItem.cliente || "-"} <br />
                <strong>Código Póliza:</strong> {editingItem.codigo_poliza || "-"}
              </p>
              
              <Form.Group className="mb-3">
                <Form.Label>Estado</Form.Label>
                <Form.Select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {AUDIT_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>
                  Comentario
                  {STATUSES_REQUIRING_COMMENT.includes(statusForm.status) && (
                    <span className="text-danger"> *</span>
                  )}
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={statusForm.comment}
                  onChange={(e) => setStatusForm((prev) => ({ ...prev, comment: e.target.value }))}
                  placeholder={
                    STATUSES_REQUIRING_COMMENT.includes(statusForm.status)
                      ? "El comentario es obligatorio para este estado"
                      : "Comentario opcional"
                  }
                />
                {STATUSES_REQUIRING_COMMENT.includes(statusForm.status) && (
                  <Form.Text className="text-muted">
                    Este estado requiere un comentario obligatorio.
                  </Form.Text>
                )}
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseStatusModal} disabled={savingStatus}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSaveStatus} disabled={savingStatus}>
            {savingStatus ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AuditoriaRunDetallePage;

