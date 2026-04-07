import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Card, Table, Form, InputGroup, Button, Badge,
  Spinner, Pagination, Toast, ToastContainer
} from "react-bootstrap";
import {
  FaSearch, FaEdit, FaEye, FaTrashAlt, FaUserPlus,
  FaFilter, FaFileExport, FaTimes, FaUsers, FaInfoCircle
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "../styles/ListaClientes.css";
import apiRequest from "../services/api";
import EditClienteModal from "../components/EditClienteModal";
import DetalleClienteModal from "../components/DetalleClienteModal";

// ============================================================================
// CONSTANTES Y HELPERS
// ============================================================================

/**
 * Genera la ruta de la ficha del cliente
 * @param {number} id - ID del cliente
 * @returns {string} Ruta de la ficha
 */
const CLIENTE_FICHA_PATH = (id) => `/clientes/${id}/ficha`;

/**
 * Renderiza un enlace al cliente que abre en nueva pestaña
 * @param {number} clienteId - ID del cliente
 * @param {string} label - Texto a mostrar (opcional)
 * @returns {JSX.Element} Enlace al cliente
 */
export const renderClienteLink = (clienteId, label = null) => {
  if (!clienteId) return "—";
  return (
    <Link
      to={CLIENTE_FICHA_PATH(clienteId)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-decoration-none fw-semibold"
      title="Abrir ficha del cliente en una nueva pestaña"
      onClick={(e) => e.stopPropagation()}
    >
      {label ?? clienteId}
    </Link>
  );
};

/**
 * Normaliza una cadena de texto para comparación sin sensibilidad a mayúsculas/minúsculas y acentos
 * Ejemplo: "Cotización" == "cotizacion" == "COTIZACION"
 * @param {string} s - Cadena a normalizar
 * @returns {string} Cadena normalizada
 */
const norm = (s) =>
  (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Convierte el estado del proceso a una variante de color de Bootstrap
 * @param {string} estado - Estado del proceso
 * @returns {string} Variante de color para Badge
 */
const estadoToVariant = (estado) => {
  switch (norm(estado)) {
    case "toma de datos": return "info";
    case "cotizacion": return "warning";
    case "seguimiento": return "success";
    case "inscripcion inicial": return "primary";
    case "descartado": return "danger";
    default: return "secondary";
  }
};

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

/**
 * Componente que muestra los estados de proceso de un cliente en forma de badges
 * Permite expandir/contraer cuando hay más de 3 grupos
 * @param {Object} props - Propiedades del componente
 * @param {Array} props.grupos - Array de grupos familiares con sus estados
 */
const ProcesoCell = ({ grupos }) => {
  if (!grupos?.length) {
    return (
      <Badge bg="light" text="dark" className="fw-normal">
        Sin proceso
      </Badge>
    );
  }

  const MAX_VISIBLE = 3; // Máximo de badges visibles sin expandir
  const [expanded, setExpanded] = React.useState(false);
  
  // Ordena los grupos por ID
  const ordered = [...grupos].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  
  // Decide qué grupos mostrar según si está expandido o no
  const list = expanded ? ordered : ordered.slice(0, MAX_VISIBLE);

  return (
    <div>
      <div className="stacked-list">
        {list.map(g => (
          <div key={g.id} className="stacked-item">
            <Link
              to={`/grupo_familiar/${g.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-decoration-none"
              title={`Ver grupo familiar #${g.id} - ${g.estado || "Sin estado"}`}
            >
              <Badge pill bg={estadoToVariant(g.estado)} className="stacked-badge">
                {g.estado || "Sin estado"}
              </Badge>
            </Link>
          </div>
        ))}
      </div>

      {/* Botón para expandir/contraer si hay más de MAX_VISIBLE grupos */}
      {ordered.length > MAX_VISIBLE && (
        <Button
          variant="link"
          size="sm"
          className="p-0 mt-1 text-primary text-decoration-none"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? "Ver menos" : `+${ordered.length - MAX_VISIBLE} más`}
        </Button>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

/**
 * Componente principal para listar y gestionar clientes
 * Incluye funcionalidades de búsqueda, filtrado, paginación y acciones CRUD
 */
const ListaClientes = () => {
  // ========================================================================
  // ESTADOS
  // ========================================================================

  // Estados de datos
  const [clientes, setClientes] = useState([]); // Lista completa de clientes
  const [filteredClientes, setFilteredClientes] = useState([]); // Lista filtrada
  const [loading, setLoading] = useState(true); // Estado de carga
  const [error, setError] = useState(null); // Errores en la carga

  // Estados de filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState(""); // Término de búsqueda
  const [filterStatus, setFilterStatus] = useState("all"); // Filtro por estado del proceso
  const [activeFilters, setActiveFilters] = useState({
    nuevos30Dias: false, // Clientes creados en los últimos 30 días
    conPolizasActivas: false, // Clientes con pólizas activas
    sinGrupoFamiliar: false // Clientes sin grupo familiar
  });
  const [showFiltersPopover, setShowFiltersPopover] = useState(false);
  const filterRef = React.useRef(null);

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1); // Página actual
  const [itemsPerPage, setItemsPerPage] = useState(10); // Items por página

  // Estados de modales y notificaciones
  const [showEditModal, setShowEditModal] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState(null);
  const [clienteDataToEdit, setClienteDataToEdit] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [clienteToView, setClienteToView] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");

  // ========================================================================
  // EFECTOS
  // ========================================================================

  /**
   * Carga los clientes al montar el componente
   */
  useEffect(() => {
    fetchClientes();
  }, []);

  /**
   * Aplica filtros y búsqueda cuando cambian los criterios
   * También resetea la página a la primera cuando cambian los filtros
   */
  useEffect(() => {
    if (!Array.isArray(clientes) || clientes.length === 0) {
      setFilteredClientes([]);
      return;
    }

    let result = [...clientes];

    // Filtro por término de búsqueda (nombre, email, teléfono, social)
    if (searchTerm) {
      // Normalizar el término de búsqueda: eliminar espacios múltiples y convertir a minúsculas
      const normalizeSearch = (text) => {
        if (!text) return "";
        return text
          .toLowerCase()
          .trim()
          .replace(/\s+/g, " "); // Reemplazar múltiples espacios con uno solo
      };
      
      const q = normalizeSearch(searchTerm);
      
      result = result.filter(cliente => {
        // Buscar en nombre completo (normalizado)
        if (cliente.nombre_completo) {
          const nombreNormalizado = normalizeSearch(cliente.nombre_completo);
          if (nombreNormalizado.includes(q)) return true;
        }
        
        // Buscar también en nombre y apellidos por separado (más flexible)
        const primerNombre = normalizeSearch(cliente.primer_nombre || "");
        const segundoNombre = normalizeSearch(cliente.segundo_nombre || "");
        const apellidos = normalizeSearch(cliente.apellidos || "");
        
        // Construir variaciones del nombre sin segundo nombre
        const nombreSinSegundo = `${primerNombre} ${apellidos}`.trim();
        if (nombreSinSegundo.includes(q)) return true;
        
        // Construir nombre completo con segundo nombre
        const nombreCompleto = `${primerNombre} ${segundoNombre} ${apellidos}`.trim().replace(/\s+/g, " ");
        if (nombreCompleto.includes(q)) return true;
        
        // Buscar en email
        if (cliente.email && normalizeSearch(cliente.email).includes(q)) return true;
        
        // Buscar en teléfonos (array y campo legacy)
        const telefonos = Array.isArray(cliente.telefonos) ? cliente.telefonos : [];
        const tieneTelefonoEnArray = telefonos.some(t => {
          const num = String(t.numero || t.telefono || t.numero_e164 || t.numeroE164 || "");
          return normalizeSearch(num).includes(q);
        });
        if (tieneTelefonoEnArray || (cliente.telefono && normalizeSearch(String(cliente.telefono)).includes(q))) return true;
        
        // Buscar en social
        if (cliente.social && normalizeSearch(String(cliente.social)).includes(q)) return true;
        
        return false;
      });
    }

    // Filtro por estado del proceso
    if (filterStatus !== "all") {
      result = result.filter((cliente) => {
        const grupos = cliente.grupos || [];
        if (filterStatus === "sin-proceso") {
          return grupos.length === 0;
        }
        // Verifica si hay al menos un grupo cuyo estado coincide
        return grupos.some(g => norm(g.estado) === norm(filterStatus));
      });
    }

    // Filtro: Clientes nuevos (últimos 30 días)
    if (activeFilters.nuevos30Dias) {
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - 30);
      result = result.filter(c => 
        c.created_at && new Date(c.created_at) >= fechaLimite
      );
    }

    // Filtro: Clientes con pólizas activas
    if (activeFilters.conPolizasActivas) {
      result = result.filter(c => 
        c.cobertura === true || (c.coberturas && c.coberturas.length > 0)
      );
    }

    // Filtro: Clientes sin grupo familiar
    if (activeFilters.sinGrupoFamiliar) {
      result = result.filter(c =>
        !c.grupo_familiar_id &&
        (!c.coberturas || c.coberturas.length === 0 || !c.coberturas[0].grupo_familiar_id)
      );
    }

    // Ordena alfabéticamente por nombre completo
    result.sort((a, b) => 
      (a.nombre_completo || "").localeCompare(b.nombre_completo || "", undefined, { sensitivity: "base" })
    );

    setFilteredClientes(result);
    setCurrentPage(1); // Resetea a la primera página cuando cambian los filtros
  }, [searchTerm, filterStatus, clientes, activeFilters]);

  // ========================================================================
  // FUNCIONES DE DATOS
  // ========================================================================

  /**
   * Obtiene los clientes desde la API y normaliza los datos
   * Procesa la información de grupos familiares y estados
   */
  const fetchClientes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest("cliente/with-cobertura");
      
      // Normaliza la respuesta para manejar diferentes formatos
      const raw = Array.isArray(response?.data) ? response.data : (response || []);
      const clientesArray = Array.isArray(raw) ? raw : Object.values(raw);

      // Normaliza cada cliente agregando información de grupos y estados
      const normalizados = clientesArray.map((c) => {
        // Recopila todos los IDs de grupos familiares (de coberturas y del cliente)
        const idsCob = (c.coberturas || [])
          .map(co => co.grupo_familiar_id)
          .filter(Boolean);
        const baseId = c.grupo_familiar_id ? [c.grupo_familiar_id] : [];
        const grupoFamiliarIds = Array.from(new Set([...baseId, ...idsCob]));

        // Mapa de estados por grupo familiar ID
        const estadosMap = new Map();
        
        // Agrega estados desde grupo_estados
        (c.grupo_estados || []).forEach(g => {
          if (g?.id) {
            estadosMap.set(g.id, g.estado || "Sin estado");
          }
        });
        
        // Agrega estados desde coberturas
        (c.coberturas || []).forEach(co => {
          const gid = co.grupo_familiar_id;
          const est = co.grupo_familiar?.estado_actual_catalogo?.estado_nombre;
          if (gid && est && !estadosMap.has(gid)) {
            estadosMap.set(gid, est);
          }
        });

        // Crea array de grupos con id y estado
        const grupos = grupoFamiliarIds.map(id => ({
          id,
          estado: estadosMap.get(id) || "Sin estado",
        }));

        return { ...c, grupos };
      });

      setClientes(normalizados);
      setFilteredClientes(normalizados);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
      setError("No se pudieron cargar los clientes. " + (err.message || "Por favor, intente nuevamente."));
    } finally {
      setLoading(false);
    }
  };

  // ========================================================================
  // FUNCIONES DE UTILIDAD
  // ========================================================================

  /**
   * Formatea una fecha a formato local
   * Maneja correctamente fechas ISO (YYYY-MM-DD) para evitar problemas de zona horaria
   * @param {string} dateString - Fecha en formato string
   * @returns {string} Fecha formateada o "No registrado"
   */
  const formatDate = (dateString) => {
    if (!dateString) return "No registrado";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const year = date.getFullYear();
      return `${month}-${day}-${year}`;
    } catch {
      return dateString;
    }
  };

  /**
   * Obtiene el parentesco del cliente
   * @param {Object} cliente - Objeto cliente
   * @returns {string} Parentesco del cliente
   */
  const getParentesco = (cliente) => {
    if (cliente.parentesco) return cliente.parentesco;
    if (cliente.coberturas?.length) {
      return cliente.coberturas[0].parentesco || "Sin definir";
    }
    return "Sin parentesco";
  };

  /**
   * Obtiene el teléfono principal del cliente
   * @param {Object} cliente - Objeto cliente
   * @returns {string} Teléfono principal o null
   */
  const getTelefonoPrincipal = (cliente) => {
    if (!cliente) return null;
    
    // Primero intentar obtener del array de telefonos
    const telefonos = Array.isArray(cliente.telefonos) ? cliente.telefonos : [];
    if (telefonos.length > 0) {
      // Buscar el teléfono marcado como principal
      const principal = telefonos.find((t) => t?.principal);
      if (principal) {
        // Intentar diferentes campos donde puede estar el número
        return principal.numero || principal.telefono || principal.numero_e164 || principal.numeroE164 || null;
      }
      // Si no hay principal marcado, usar el primero
      const primero = telefonos[0];
      if (primero) {
        return primero.numero || primero.telefono || primero.numero_e164 || primero.numeroE164 || null;
      }
    }
    
    // Fallback al campo legacy
    return cliente.telefono || null;
  };

  // ========================================================================
  // FUNCIONES DE FILTROS
  // ========================================================================

  /**
   * Aplica un filtro activo
   * @param {string} filterName - Nombre del filtro
   * @param {boolean} value - Valor del filtro
   */
  const applyFilter = (filterName, value = true) => {
    setActiveFilters(prev => ({ ...prev, [filterName]: value }));
    setShowFiltersPopover(false);
  };

  /**
   * Remueve un filtro activo
   * @param {string} filterName - Nombre del filtro a remover
   */
  const removeFilter = (filterName) => {
    setActiveFilters(prev => ({ ...prev, [filterName]: false }));
  };

  /**
   * Limpia todos los filtros y búsqueda activos
   */
  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setActiveFilters({ 
      nuevos30Dias: false, 
      conPolizasActivas: false, 
      sinGrupoFamiliar: false 
    });
    setShowFiltersPopover(false);
  };

  /**
   * Limpia solo el término de búsqueda
   */
  const clearSearch = () => {
    setSearchTerm("");
  };

  // ========================================================================
  // FUNCIONES DE ACCIONES
  // ========================================================================

  /**
   * Abre el modal de visualización de cliente
   * @param {Object} cliente - Cliente a visualizar
   * @param {number} grupoId - ID del grupo familiar
   */
  const handleOpenViewModal = (cliente, grupoId) => {
    setClienteToView({ ...cliente, grupoFamiliarId: grupoId });
    setShowViewModal(true);
  };

  /**
   * Abre el modal de edición de cliente
   * @param {Object} cliente - Cliente a editar
   */
  const handleOpenEditModal = (cliente) => {
    setClienteToEdit(cliente.id);
    setClienteDataToEdit(cliente);
    setShowEditModal(true);
  };

  /**
   * Maneja la actualización exitosa de un cliente
   * @param {Object} updatedCliente - Cliente actualizado
   */
  const handleClienteUpdated = (updatedCliente) => {
    setClientes(prev => 
      prev.map(c => (c.id === updatedCliente.id ? updatedCliente : c))
    );
    setFilteredClientes(prev => 
      prev.map(c => (c.id === updatedCliente.id ? updatedCliente : c))
    );
    setToastMessage("Cliente actualizado con éxito");
    setToastVariant("success");
    setShowToast(true);
    setShowEditModal(false);
  };

  /**
   * Elimina un cliente después de confirmación
   * @param {number} id - ID del cliente
   * @param {string} nombre - Nombre del cliente
   */
  const handleDelete = async (id, nombre) => {
    const confirmacion = window.confirm(
      `¿Estás seguro de que deseas eliminar al cliente "${nombre}"?\n\nEsta acción no se puede deshacer.`
    );
    
    if (!confirmacion) return;

    try {
      await apiRequest(`cliente/${id}`, "DELETE");
      
      // Actualiza ambas listas removiendo el cliente eliminado
      const updated = clientes.filter(c => c.id !== id);
      setClientes(updated);
      setFilteredClientes(prev => prev.filter(c => c.id !== id));
      
      setToastMessage("Cliente eliminado con éxito");
      setToastVariant("success");
      setShowToast(true);
    } catch (err) {
      console.error("Error al eliminar cliente:", err);
      setToastMessage("No se pudo eliminar el cliente. " + (err.message || "Podría estar asociado a otros registros."));
      setToastVariant("danger");
      setShowToast(true);
    }
  };

  // ========================================================================
  // FUNCIONES DE PAGINACIÓN
  // ========================================================================

  /**
   * Calcula los índices y páginas para la paginación
   */
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = Array.isArray(filteredClientes)
    ? filteredClientes.slice(indexOfFirstItem, indexOfLastItem)
    : [];
  const totalPages = Math.ceil((filteredClientes?.length || 0) / itemsPerPage);

  /**
   * Cambia a una página específica
   * @param {number} pageNumber - Número de página
   */
  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  /**
   * Renderiza los elementos de paginación
   * @returns {Array} Array de elementos de paginación
   */
  const renderPaginationItems = () => {
    const pages = [];
    
    // Botones de navegación principal
    pages.push(
      <Pagination.First 
        key="first" 
        onClick={() => paginate(1)} 
        disabled={currentPage === 1} 
      />
    );
    pages.push(
      <Pagination.Prev 
        key="prev" 
        onClick={() => paginate(currentPage - 1)} 
        disabled={currentPage === 1} 
      />
    );

    // Cálculo de rango de páginas a mostrar (5 páginas visibles: 2 antes, actual, 2 después)
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    // Elipsis inicial si hay páginas antes
    if (startPage > 1) {
      pages.push(<Pagination.Ellipsis key="ellipsis-start" disabled />);
    }

    // Páginas visibles
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Pagination.Item 
          key={i} 
          active={i === currentPage} 
          onClick={() => paginate(i)}
        >
          {i}
        </Pagination.Item>
      );
    }

    // Elipsis final si hay páginas después
    if (endPage < totalPages) {
      pages.push(<Pagination.Ellipsis key="ellipsis-end" disabled />);
    }

    // Botones de navegación final
    pages.push(
      <Pagination.Next 
        key="next" 
        onClick={() => paginate(currentPage + 1)} 
        disabled={currentPage === totalPages || totalPages === 0} 
      />
    );
    pages.push(
      <Pagination.Last 
        key="last" 
        onClick={() => paginate(totalPages)} 
        disabled={currentPage === totalPages || totalPages === 0} 
      />
    );

    return pages;
  };

  // ========================================================================
  // RENDERIZADO DE COMPONENTES UI
  // ========================================================================

  /**
   * Renderiza las píldoras de filtros activos con opción de eliminar
   * @returns {JSX.Element|null} Píldoras de filtros activos
   */
  const renderActiveFiltersPills = () => {
    const hasActiveFilters = Object.values(activeFilters).some(value => value);
    const hasSearchOrStatusFilter = searchTerm || filterStatus !== "all";

    if (!hasActiveFilters && !hasSearchOrStatusFilter) return null;

    return (
      <div className="d-flex flex-wrap align-items-center gap-2 mt-3 pt-2 border-top">
        <span className="text-muted small me-2">
          <FaFilter className="me-1" />
          Filtros activos:
        </span>
        
        {hasSearchOrStatusFilter && (
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={clearAllFilters}
            className="d-flex align-items-center"
          >
            <FaTimes className="me-1" />
            Limpiar todo
          </Button>
        )}

        {activeFilters.nuevos30Dias && (
          <Badge bg="info" className="py-2 px-3 d-inline-flex align-items-center">
            Clientes nuevos (30 días)
            <Button 
              variant="link" 
              className="p-0 ms-2 text-white border-0 bg-transparent" 
              onClick={() => removeFilter('nuevos30Dias')}
              style={{ fontSize: '12px', lineHeight: 1 }}
            >
              <FaTimes />
            </Button>
          </Badge>
        )}
        
        {activeFilters.conPolizasActivas && (
          <Badge bg="success" className="py-2 px-3 d-inline-flex align-items-center">
            Con pólizas activas
            <Button 
              variant="link" 
              className="p-0 ms-2 text-white border-0 bg-transparent" 
              onClick={() => removeFilter('conPolizasActivas')}
              style={{ fontSize: '12px', lineHeight: 1 }}
            >
              <FaTimes />
            </Button>
          </Badge>
        )}
        
        {activeFilters.sinGrupoFamiliar && (
          <Badge bg="warning" text="dark" className="py-2 px-3 d-inline-flex align-items-center">
            Sin grupo familiar
            <Button 
              variant="link" 
              className="p-0 ms-2 text-dark border-0 bg-transparent" 
              onClick={() => removeFilter('sinGrupoFamiliar')}
              style={{ fontSize: '12px', lineHeight: 1 }}
            >
              <FaTimes />
            </Button>
          </Badge>
        )}
      </div>
    );
  };

  /**
   * Renderiza la tabla de clientes con todos los estados posibles
   * @returns {JSX.Element} Tabla de clientes o estados de carga/error/vacío
   */
  const renderClientesTable = () => {
    // Estado de carga
    if (loading) {
      return (
        <Card>
          <Card.Body>
            <div className="text-center p-5">
              <Spinner animation="border" variant="primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </Spinner>
              <p className="mt-3 text-muted">Cargando clientes...</p>
            </div>
          </Card.Body>
        </Card>
      );
    }

    // Estado de error
    if (error) {
      return (
        <Card>
          <Card.Body>
            <div className="alert alert-danger d-flex align-items-center" role="alert">
              <FaInfoCircle className="me-2" size={20} />
              <div>
                <strong>Error al cargar clientes</strong>
                <div className="small mt-1">{error}</div>
              </div>
            </div>
            <div className="text-center mt-3">
              <Button variant="primary" onClick={fetchClientes}>
                Reintentar
              </Button>
            </div>
          </Card.Body>
        </Card>
      );
    }

    // Estado vacío (sin resultados)
    if (!Array.isArray(filteredClientes) || filteredClientes.length === 0) {
      const hasFilters = searchTerm || filterStatus !== "all" || 
                        Object.values(activeFilters).some(v => v);

      return (
        <Card>
          <Card.Body>
            <div className="text-center p-5">
              <FaSearch size={48} className="text-muted mb-3 opacity-50" />
              <h5 className="mb-2">No se encontraron clientes</h5>
              <p className="text-muted mb-3">
                {hasFilters
                  ? "No hay clientes que coincidan con los criterios de búsqueda seleccionados."
                  : "No hay clientes registrados en el sistema."}
              </p>
              {hasFilters && (
                <Button variant="outline-primary" onClick={clearAllFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          </Card.Body>
        </Card>
      );
    }

    // Tabla con datos
    return (
      <>
        <Card>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table hover className="lista-clientes-table mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="fw-semibold">ID</th>
                    <th className="fw-semibold">Nombre Completo</th>
                    <th className="fw-semibold">Fecha Nacimiento</th>
                    <th className="fw-semibold">Código Postal</th>
                    <th className="fw-semibold">Parentesco</th>
                    <th className="fw-semibold">Teléfono</th>
                    <th className="fw-semibold">Proceso</th>
                    <th className="text-center fw-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map(cliente => {
                    const grupos = cliente.grupos || [];
                    const unico = grupos.length === 1 ? grupos[0] : null;

                    return (
                      <tr key={cliente.id}>
                        <td>
                          <span className="text-muted">{cliente.id || "N/A"}</span>
                        </td>
                        <td>
                          {renderClienteLink(cliente.id, cliente.nombre_completo || "Sin nombre")}
                        </td>
                        <td>{formatDate(cliente.fecha_nacimiento)}</td>
                        <td>{cliente.codigo_postal || <span className="text-muted">—</span>}</td>
                        <td>{getParentesco(cliente)}</td>
                        <td>{getTelefonoPrincipal(cliente) || <span className="text-muted">—</span>}</td>
                        <td>
                          <ProcesoCell grupos={grupos} />
                        </td>
                        <td className="text-center">
                          <div className="btn-group" role="group">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleOpenViewModal(cliente, unico?.id || cliente.grupo_familiar_id)}
                              className="border-end-0"
                              title="Ver detalles del cliente"
                              aria-label="Ver detalles del cliente"
                            >
                              <FaEye />
                            </Button>
                            <Button
                              variant="outline-success"
                              size="sm"
                              onClick={() => handleOpenEditModal(cliente)}
                              className="border-end-0"
                              title="Editar cliente"
                              aria-label="Editar cliente"
                            >
                              <FaEdit />
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDelete(cliente.id, cliente.nombre_completo)}
                              title="Eliminar cliente"
                              aria-label="Eliminar cliente"
                            >
                              <FaTrashAlt />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>

        {/* Controles de paginación */}
        <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-3">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="text-muted small">
              <FaUsers className="me-1" />
              Mostrando <strong>{indexOfFirstItem + 1}</strong> - <strong>{Math.min(indexOfLastItem, filteredClientes.length)}</strong> de <strong>{filteredClientes.length}</strong> cliente{filteredClientes.length !== 1 ? 's' : ''}
            </span>
            <span className="text-muted">|</span>
            <div className="d-flex align-items-center gap-2">
              <label htmlFor="items-per-page" className="text-muted small mb-0">
                Mostrar:
              </label>
              <Form.Select
                id="items-per-page"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                size="sm"
                style={{ width: '90px' }}
                aria-label="Items por página"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={40}>40</option>
                <option value={50}>50</option>
                <option value={60}>60</option>
                <option value={70}>70</option>
                <option value={80}>80</option>
                <option value={90}>90</option>
                <option value={100}>100</option>
              </Form.Select>
            </div>
          </div>
          <Pagination className="mb-0">{renderPaginationItems()}</Pagination>
        </div>
      </>
    );
  };

  // ========================================================================
  // RENDER PRINCIPAL
  // ========================================================================

  return (
    <div className="lista-clientes-container">
      {/* Header con título y botón de nuevo cliente */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title mb-1">Lista de Clientes</h1>
          <p className="text-muted small mb-0">
            Gestiona y visualiza todos los clientes del sistema
          </p>
        </div>
        <Button 
          variant="primary" 
          as={Link} 
          to="/clientes/crear" 
          className="d-flex align-items-center"
        >
          <FaUserPlus className="me-2" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Panel de búsqueda y filtros */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <div className="filter-container">
            <div className="row g-3">
              {/* Campo de búsqueda */}
              <div className="col-md-6">
                <label htmlFor="search-input" className="form-label small text-muted mb-1">
                  Buscar cliente
                </label>
                <InputGroup>
                  <Form.Control
                    id="search-input"
                    placeholder="Buscar por nombre, email, teléfono o Social..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Buscar cliente"
                  />
                  {searchTerm && (
                    <Button 
                      variant="outline-secondary" 
                      onClick={clearSearch}
                      aria-label="Limpiar búsqueda"
                    >
                      <FaTimes />
                    </Button>
                  )}
                  <Button variant="outline-secondary" disabled>
                    <FaSearch />
                  </Button>
                </InputGroup>
              </div>

              {/* Selector de estado del proceso */}
              <div className="col-md-3">
                <label htmlFor="status-filter" className="form-label small text-muted mb-1">
                  Estado del proceso
                </label>
                <Form.Select
                  id="status-filter"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  aria-label="Filtrar por estado del proceso"
                >
                  <option value="all">Todos los estados</option>
                  <option value="cotizacion">Cotización</option>
                  <option value="seguimiento">Seguimiento</option>
                  <option value="toma de datos">Toma de Datos</option>
                  <option value="inscripcion inicial">Inscripción Inicial</option>
                  <option value="descartado">Descartado</option>
                  <option value="sin-proceso">Sin proceso</option>
                </Form.Select>
              </div>

              {/* Botones de acción */}
              <div className="col-md-3">
               
                <div className="d-flex gap-2">
                  <div className="position-relative flex-grow-1" ref={filterRef}>
                    {/* Espacio reservado para filtros adicionales futuros */}
                  </div>
                  <Button 
                    variant="outline-secondary" 
                    title="Exportar lista de clientes"
                    aria-label="Exportar"
                  >
                    <FaFileExport />
                  </Button>
                </div>
              </div>
            </div>

            {/* Píldoras de filtros activos */}
            {renderActiveFiltersPills()}
          </div>
        </Card.Body>
      </Card>

      {/* Tabla de clientes */}
      {renderClientesTable()}

      {/* Modales */}
      <EditClienteModal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        clienteId={clienteToEdit}
        clienteData={clienteDataToEdit}
        onClienteUpdated={handleClienteUpdated}
      />

      <DetalleClienteModal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        clienteData={clienteToView}
        grupoFamiliarId={clienteToView?.grupoFamiliarId}
      />

      {/* Toast de notificaciones */}
      <ToastContainer className="p-3" position="top-end">
        <Toast 
          show={showToast} 
          onClose={() => setShowToast(false)} 
          delay={3000} 
          autohide 
          bg={toastVariant}
        >
          <Toast.Header closeButton={true}>
            <strong className="me-auto">
              {toastVariant === "success" ? "Éxito" : "Error"}
            </strong>
          </Toast.Header>
          <Toast.Body className={toastVariant === "success" ? "text-white" : ""}>
            {toastMessage}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
};

export default ListaClientes;
