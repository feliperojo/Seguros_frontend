// pages/ReporteCumpleanosPage.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Table, Button, Alert, Spinner, Form, Card, Badge } from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import { FaSort, FaSortUp, FaSortDown, FaBirthdayCake, FaCalendarAlt } from "react-icons/fa";
import apiRequest from "../services/api";
import Pagination from "../components/Pagination";
import useToast from "../hooks/useToast";

/**
 * Filtra clientes por criterios de cumpleaños
 */
const filtrarClientes = (clientes, filters) => {
  if (!Array.isArray(clientes) || clientes.length === 0) {
    return [];
  }

  let resultado = [...clientes];

  // Filtro por búsqueda de nombre
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    resultado = resultado.filter((cliente) => {
      const nombreCompleto = (cliente.nombre_completo || "").toLowerCase();
      return nombreCompleto.includes(searchLower);
    });
  }

  // Filtro por fecha de cumpleaños
  resultado = resultado.filter((cliente) => {
    const fechaNacimiento = cliente.fecha_nacimiento;
    if (!fechaNacimiento) return false;

    try {
      // Usar UTC para evitar problemas de zona horaria
      let fecha;
      if (typeof fechaNacimiento === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fechaNacimiento)) {
        const [year, month, day] = fechaNacimiento.split('T')[0].split('-');
        fecha = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      } else {
        const date = new Date(fechaNacimiento);
        fecha = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      }
      
      const mes = fecha.getUTCMonth() + 1; // 1-12
      const dia = fecha.getUTCDate(); // 1-31

      // Filtro por mes
      if (filters.mes && parseInt(filters.mes) !== mes) {
        return false;
      }

      // Filtro por día
      if (filters.dia && parseInt(filters.dia) !== dia) {
        return false;
      }

      // Filtro por rango de fechas (comparando mes y día, ignorando año)
      if (filters.fecha_desde || filters.fecha_hasta) {
        const fechaDesde = filters.fecha_desde ? new Date(filters.fecha_desde + 'T00:00:00Z') : null;
        const fechaHasta = filters.fecha_hasta ? new Date(filters.fecha_hasta + 'T23:59:59Z') : null;

        if (fechaDesde) {
          const mesDesde = fechaDesde.getUTCMonth() + 1;
          const diaDesde = fechaDesde.getUTCDate();
          if (mes < mesDesde || (mes === mesDesde && dia < diaDesde)) {
            return false;
          }
        }

        if (fechaHasta) {
          const mesHasta = fechaHasta.getUTCMonth() + 1;
          const diaHasta = fechaHasta.getUTCDate();
          if (mes > mesHasta || (mes === mesHasta && dia > diaHasta)) {
            return false;
          }
        }
      }

      // Filtro solo hoy
      if (filters.solo_hoy) {
        const hoy = new Date();
        const hoyUTC = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
        return (
          mes === hoyUTC.getUTCMonth() + 1 && dia === hoyUTC.getUTCDate()
        );
      }

      return true;
    } catch {
      return false;
    }
  });

  // Ordenamiento
  if (filters.sort_by) {
    resultado.sort((a, b) => {
      let aVal, bVal;

      switch (filters.sort_by) {
        case "nombre_completo":
          aVal = (a.nombre_completo || "").toLowerCase();
          bVal = (b.nombre_completo || "").toLowerCase();
          break;
        case "fecha_nacimiento":
          // Usar UTC para evitar problemas de zona horaria
          const getDateUTC = (dateString) => {
            if (!dateString) return new Date(0);
            if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
              const [year, month, day] = dateString.split('T')[0].split('-');
              return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
            }
            const date = new Date(dateString);
            return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
          };
          aVal = getDateUTC(a.fecha_nacimiento);
          bVal = getDateUTC(b.fecha_nacimiento);
          break;
        case "edad":
          aVal = calcularEdad(a.fecha_nacimiento);
          bVal = calcularEdad(b.fecha_nacimiento);
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return filters.sort_dir === "asc" ? -1 : 1;
      if (aVal > bVal) return filters.sort_dir === "asc" ? 1 : -1;
      return 0;
    });
  }

  return resultado;
};

/**
 * Formatea una fecha para mostrar (evita problemas de zona horaria)
 */
const formatDate = (dateString) => {
  if (!dateString) return "-";
  try {
    // Si es una fecha en formato ISO (YYYY-MM-DD), usar directamente
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
      const [year, month, day] = dateString.split('T')[0].split('-');
      return `${day}/${month}/${year}`;
    }
    // Si tiene hora, extraer solo la fecha
    const date = new Date(dateString);
    // Usar UTC para evitar problemas de zona horaria
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
};

/**
 * Calcula la edad a partir de la fecha de nacimiento (evita problemas de zona horaria)
 */
const calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return "-";
  try {
    const hoy = new Date();
    // Usar UTC para evitar problemas de zona horaria
    let nacimiento;
    if (typeof fechaNacimiento === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fechaNacimiento)) {
      const [year, month, day] = fechaNacimiento.split('T')[0].split('-');
      nacimiento = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    } else {
      const date = new Date(fechaNacimiento);
      nacimiento = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }
    
    const hoyUTC = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
    
    let edad = hoyUTC.getUTCFullYear() - nacimiento.getUTCFullYear();
    const mes = hoyUTC.getUTCMonth() - nacimiento.getUTCMonth();
    if (mes < 0 || (mes === 0 && hoyUTC.getUTCDate() < nacimiento.getUTCDate())) {
      edad--;
    }
    return edad;
  } catch {
    return "-";
  }
};

/**
 * Verifica si una fecha de cumpleaños es hoy (evita problemas de zona horaria)
 */
const esCumpleanosHoy = (fechaNacimiento) => {
  if (!fechaNacimiento) return false;
  try {
    const hoy = new Date();
    // Usar UTC para evitar problemas de zona horaria
    let nacimiento;
    if (typeof fechaNacimiento === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fechaNacimiento)) {
      const [year, month, day] = fechaNacimiento.split('T')[0].split('-');
      nacimiento = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    } else {
      const date = new Date(fechaNacimiento);
      nacimiento = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }
    
    const hoyUTC = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
    
    return (
      hoyUTC.getUTCMonth() === nacimiento.getUTCMonth() &&
      hoyUTC.getUTCDate() === nacimiento.getUTCDate()
    );
  } catch {
    return false;
  }
};

/**
 * Formatea los teléfonos desde el arreglo telefonos del cliente
 */
const formatTelefonos = (cliente) => {
  if (!cliente) return "-";
  
  // Primero intentar obtener del array de telefonos
  const telefonos = Array.isArray(cliente.telefonos) ? cliente.telefonos : [];
  
  if (telefonos.length > 0) {
    // Ordenar: principal primero
    const ordenados = [...telefonos].sort(
      (a, b) => (b?.principal ? 1 : 0) - (a?.principal ? 1 : 0)
    );
    
    // Formatear cada teléfono
    return ordenados
      .map((t) => {
        const numero = t.numero || t.telefono || t.numero_e164 || t.numeroE164 || "";
        if (!numero) return null;
        
        const indicativo = t?.indicativo ? `+${t.indicativo} ` : "";
        const tipo = t?.tipo ? ` (${t.tipo})` : "";
        const principal = t?.principal ? " [Principal]" : "";
        return `${indicativo}${numero}${tipo}${principal}`.trim();
      })
      .filter(Boolean)
      .join(", ") || "-";
  }
  
  // Fallback: construir desde campos legacy si no hay arreglo
  const telefonosLegacy = [];
  if (cliente.telefono) telefonosLegacy.push(cliente.telefono);
  if (cliente.secundario) telefonosLegacy.push(cliente.secundario);
  if (cliente.whatsapp_num) telefonosLegacy.push(`WhatsApp: ${cliente.whatsapp_num}`);
  
  return telefonosLegacy.length > 0 ? telefonosLegacy.join(", ") : "-";
};

/**
 * Columnas ordenables permitidas
 */
const SORTABLE_COLUMNS = {
  nombre_completo: "nombre_completo",
  fecha_nacimiento: "fecha_nacimiento",
  edad: "edad",
};

const ReporteCumpleanosPage = () => {
  const toast = useToast();
  
  // Estado de datos - todos los clientes cargados
  const [todosClientes, setTodosClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estado de filtros
  const [filters, setFilters] = useState({
    page: 1,
    per_page: 25,
    fecha_desde: "",
    fecha_hasta: "",
    mes: "",
    dia: "",
    solo_hoy: false,
    search: "",
    sort_by: "",
    sort_dir: "",
  });
  
  // Estado de filtros temporales (antes de aplicar)
  const [tempFilters, setTempFilters] = useState({
    fecha_desde: "",
    fecha_hasta: "",
    mes: "",
    dia: "",
    solo_hoy: false,
    search: "",
  });
  
  // AbortController para cancelar peticiones
  const abortControllerRef = useRef(null);
  
  // Cargar todos los clientes al montar
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
    
    const loadClientes = async () => {
      try {
        // Cargar todos los clientes
        const response = await apiRequest("cliente/with-cobertura", "GET");
        
        // Solo actualizar estado si el componente sigue montado, la petición no fue cancelada
        // y es la petición actual (no una anterior)
        if (!abortController.signal.aborted && isMounted && currentAbortController === abortControllerRef.current) {
          // Normalizar la respuesta
          const raw = Array.isArray(response?.data) ? response.data : (response || []);
          const clientesArray = Array.isArray(raw) ? raw : Object.values(raw);
          
          // Filtrar solo clientes que tengan fecha de nacimiento
          const clientesConFecha = clientesArray.filter((c) => c.fecha_nacimiento);
          
          setTodosClientes(clientesConFecha);
          setError(null);
        }
      } catch (err) {
        // Ignorar errores de cancelación silenciosamente
        if (err.message === "Petición cancelada" || err.name === "AbortError") {
          return;
        }
        
        // Solo mostrar error si el componente sigue montado y es la petición actual
        if (isMounted && currentAbortController === abortControllerRef.current) {
          const errorMessage = err.response?.data?.message || err.message || "Error al cargar los clientes";
          setError(errorMessage);
          if (toast && typeof toast.showError === 'function') {
            toast.showError(errorMessage);
          }
          console.error("Error al cargar clientes:", err);
          setTodosClientes([]);
        }
      } finally {
        // Solo actualizar loading si el componente sigue montado, la petición no fue cancelada
        // y es la petición actual
        if (isMounted && !abortController.signal.aborted && currentAbortController === abortControllerRef.current) {
          setLoading(false);
        }
      }
    };
    
    loadClientes();
    
    // Cleanup: cancelar petición y marcar como desmontado
    return () => {
      isMounted = false;
      if (currentAbortController) {
        currentAbortController.abort();
      }
    };
  }, []); // Solo se ejecuta al montar
  
  // Filtrar y paginar clientes usando useMemo
  const { clientesFiltrados, cumpleanosHoy, paginados, meta } = useMemo(() => {
    // Filtrar clientes
    const filtrados = filtrarClientes(todosClientes, filters);
    
    // Separar los que cumplen años hoy
    const hoy = filtrados.filter((cliente) => esCumpleanosHoy(cliente.fecha_nacimiento));
    const otros = filtrados.filter((cliente) => !esCumpleanosHoy(cliente.fecha_nacimiento));
    
    // Determinar qué mostrar según el filtro
    let clientesParaMostrar = filters.solo_hoy ? hoy : otros;
    
    // Calcular paginación
    const total = clientesParaMostrar.length;
    const perPage = filters.per_page || 25;
    const currentPage = filters.page || 1;
    const lastPage = Math.ceil(total / perPage);
    const startIndex = (currentPage - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginados = clientesParaMostrar.slice(startIndex, endIndex);
    
    return {
      clientesFiltrados: clientesParaMostrar,
      cumpleanosHoy: filters.solo_hoy ? [] : hoy,
      paginados,
      meta: {
        page: currentPage,
        per_page: perPage,
        total,
        last_page: lastPage,
      },
    };
  }, [todosClientes, filters]);
  
  // Sincronizar filtros temporales con filtros activos
  useEffect(() => {
    setTempFilters({
      fecha_desde: filters.fecha_desde,
      fecha_hasta: filters.fecha_hasta,
      mes: filters.mes,
      dia: filters.dia,
      solo_hoy: filters.solo_hoy,
      search: filters.search,
    });
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
      fecha_desde: "",
      fecha_hasta: "",
      mes: "",
      dia: "",
      solo_hoy: false,
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
        <title>Cumpleaños de Clientes</title>
      </Helmet>
      
      <h2 className="mb-4">
        <FaBirthdayCake className="me-2" />
        Cumpleaños de Clientes
      </h2>
      
      {/* Área de Cumpleaños de Hoy */}
      {!filters.solo_hoy && cumpleanosHoy.length > 0 && (
        <Card className="mb-4 border-warning">
          <Card.Header className="bg-warning text-dark">
            <h5 className="mb-0">
              <FaBirthdayCake className="me-2" />
              ¡Cumpleaños de Hoy! ({cumpleanosHoy.length})
            </h5>
          </Card.Header>
          <Card.Body>
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Nombre Completo</th>
                    <th>Fecha de Nacimiento</th>
                    <th>Edad</th>
                    <th>Teléfonos</th>
                    <th>Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {cumpleanosHoy.map((cliente) => (
                    <tr key={cliente.id || cliente.cliente_id}>
                      <td>
                        <Badge bg="warning" className="me-2">¡Hoy!</Badge>
                        {cliente.nombre_completo || "-"}
                      </td>
                      <td>{formatDate(cliente.fecha_nacimiento)}</td>
                      <td>{calcularEdad(cliente.fecha_nacimiento)}</td>
                      <td>{formatTelefonos(cliente)}</td>
                      <td>{cliente.email || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}
      
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
                placeholder="Nombre del cliente..."
                value={tempFilters.search}
                onChange={(e) => handleTempFilterChange("search", e.target.value)}
              />
            </div>
            
            {/* Mes */}
            <div className="col-md-2">
              <Form.Label>Mes</Form.Label>
              <Form.Select
                value={tempFilters.mes}
                onChange={(e) => handleTempFilterChange("mes", e.target.value)}
              >
                <option value="">Todos</option>
                <option value="1">Enero</option>
                <option value="2">Febrero</option>
                <option value="3">Marzo</option>
                <option value="4">Abril</option>
                <option value="5">Mayo</option>
                <option value="6">Junio</option>
                <option value="7">Julio</option>
                <option value="8">Agosto</option>
                <option value="9">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </Form.Select>
            </div>
            
            {/* Día */}
            <div className="col-md-2">
              <Form.Label>Día</Form.Label>
              <Form.Control
                type="number"
                min="1"
                max="31"
                placeholder="Día (1-31)"
                value={tempFilters.dia}
                onChange={(e) => handleTempFilterChange("dia", e.target.value)}
              />
            </div>
            
            {/* Fecha Desde */}
            <div className="col-md-2">
              <Form.Label>Fecha Desde</Form.Label>
              <Form.Control
                type="date"
                value={tempFilters.fecha_desde}
                onChange={(e) => handleTempFilterChange("fecha_desde", e.target.value)}
              />
            </div>
            
            {/* Fecha Hasta */}
            <div className="col-md-2">
              <Form.Label>Fecha Hasta</Form.Label>
              <Form.Control
                type="date"
                value={tempFilters.fecha_hasta}
                onChange={(e) => handleTempFilterChange("fecha_hasta", e.target.value)}
              />
            </div>
            
            {/* Solo Hoy */}
            <div className="col-md-1">
              <Form.Label>&nbsp;</Form.Label>
              <Form.Check
                type="checkbox"
                label="Solo hoy"
                checked={tempFilters.solo_hoy}
                onChange={(e) => handleTempFilterChange("solo_hoy", e.target.checked)}
                className="mt-2"
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
          <h5 className="mb-0">
            <FaCalendarAlt className="me-2" />
            Clientes
          </h5>
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
              <p className="mt-2 text-muted">Cargando clientes...</p>
            </div>
          ) : paginados.length === 0 ? (
            <Alert variant="info">
              No se encontraron clientes con los filtros aplicados.
            </Alert>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("nombre_completo")}
                      >
                        Nombre Completo {renderSortIcon("nombre_completo")}
                      </th>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("fecha_nacimiento")}
                      >
                        Fecha de Nacimiento {renderSortIcon("fecha_nacimiento")}
                      </th>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("edad")}
                      >
                        Edad {renderSortIcon("edad")}
                      </th>
                      <th>Teléfonos</th>
                      <th>Correo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginados.map((cliente) => (
                      <tr key={cliente.id || cliente.cliente_id}>
                        <td>{cliente.nombre_completo || "-"}</td>
                        <td>{formatDate(cliente.fecha_nacimiento)}</td>
                        <td>{calcularEdad(cliente.fecha_nacimiento)}</td>
                        <td>{formatTelefonos(cliente)}</td>
                        <td>{cliente.email || "-"}</td>
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
    </div>
  );
};

export default ReporteCumpleanosPage;

