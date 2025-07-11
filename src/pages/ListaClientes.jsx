import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Card, Table, Form, InputGroup, Button, Badge, 
  Spinner, Pagination, Dropdown, Toast, ToastContainer,
  Overlay, Popover
} from "react-bootstrap";
import { 
  FaSearch, FaEdit, FaEye, FaTrashAlt, FaUserPlus, 
  FaFilter, FaSortAmountDown, FaSortAmountUp, FaFileExport, FaTimes
} from "react-icons/fa";
import "../styles/ListaClientes.css";
import apiRequest from "../services/api";
import EditClienteModal from "../components/EditClienteModal";
import DetalleClienteModal from "../components/DetalleClienteModal";

const ListaClientes = () => {
  const navigate = useNavigate();
  
  // Estados para manejar datos y filtros
  const [clientes, setClientes] = useState([]);
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState("nombre_completo");
  const [sortDirection, setSortDirection] = useState("asc");
  const [filterStatus, setFilterStatus] = useState("all");
  
  // Nuevo estado para filtros adicionales
  const [activeFilters, setActiveFilters] = useState({
    nuevos30Dias: false,
    conPolizasActivas: false,
    sinGrupoFamiliar: false
  });

  // Estados para controlar el popover de filtros
  const [showFiltersPopover, setShowFiltersPopover] = useState(false);
  const filterRef = React.useRef(null);
  
  // Estados para el modal de edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState(null);
  
  // Estado para la notificación toast
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [clienteDataToEdit, setClienteDataToEdit] = useState(null);

  const [showViewModal, setShowViewModal] = useState(false);
  const [clienteToView, setClienteToView] = useState(null);
  
  useEffect(() => {
    fetchClientes();
  }, []);
  
  // Modificación en la parte donde procesas los clientes

  const fetchClientes = async () => {
    setLoading(true);
    try {
      
      
      const response = await apiRequest("cliente/with-cobertura");
   console.log(response)
      
      const clientesData = response?.data || response || [];
      
      
      console.log(clientesData)
      const clientesArray = Array.isArray(clientesData) ? clientesData : Object.values(clientesData);
      
      // Usamos un Set para agrupar a los clientes por su ID, y almacenar los grupos familiares únicos
      const clientesUnicos = [];
  
      clientesArray.forEach(cliente => {
        const existingClient = clientesUnicos.find(c => c.id === cliente.id);
  
        // Si el cliente ya está en el array, solo agregamos un nuevo grupo familiar
        if (existingClient) {
          // Evitamos duplicar el ID de grupo familiar
          if (!existingClient.grupoFamiliarIds.includes(cliente.grupo_familiar_id)) {
            existingClient.grupoFamiliarIds.push(cliente.grupo_familiar_id);
          }
        } else {
          // Si el cliente no está, lo agregamos con su grupo familiar
          clientesUnicos.push({
            ...cliente,
            grupoFamiliarIds: [cliente.grupo_familiar_id] // Guardamos los IDs de los grupos familiares a los que pertenece
          });
        }
      });
  
      setClientes(clientesUnicos);
      setFilteredClientes(clientesUnicos);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
      setError("No se pudieron cargar los clientes. " + (err.message || "Por favor, intente nuevamente."));
    } finally {
      setLoading(false);
    }
  };
  
  

  // Función para abrir el modal de visualización
  const handleOpenViewModal = (cliente, grupoId) => {
    setClienteToView(cliente);
    setShowViewModal(true);
    setClienteToView({ ...cliente, grupoFamiliarId: grupoId }); // Asegúrate de pasar el grupoId aquí si lo necesitas
  };
  
  // Función para aplicar un filtro
  const applyFilter = (filterName, value = true) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
    setShowFiltersPopover(false); // Cerrar el popover después de aplicar un filtro
  };
  
  // Función para eliminar un filtro
  const removeFilter = (filterName) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterName]: false
    }));
  };
  
  // Función para limpiar todos los filtros
  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setActiveFilters({
      nuevos30Dias: false,
      conPolizasActivas: false,
      sinGrupoFamiliar: false
    });
    setShowFiltersPopover(false); // Cerrar el popover después de limpiar todos los filtros
  };
  
  // Filtrar y ordenar clientes cuando cambian los criterios
  useEffect(() => {
    if (!Array.isArray(clientes) || clientes.length === 0) return;
  
    let result = [...clientes];
  
    // Aplicar filtro de búsqueda
    if (searchTerm) {
      result = result.filter(cliente =>
        (cliente.nombre_completo && cliente.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cliente.email && cliente.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cliente.telefono && cliente.telefono.toString().includes(searchTerm)) ||
        (cliente.social && cliente.social.toString().includes(searchTerm))
      );
    }
  
    // Aplicar filtro de estado
    if (filterStatus !== "all") {
      result = result.filter(cliente => cliente.status === filterStatus);
    }
  
    // Aplicar filtros adicionales
    if (activeFilters.nuevos30Dias) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
      result = result.filter(cliente => {
        if (!cliente.created_at) return false;
        const createdDate = new Date(cliente.created_at);
        return createdDate >= thirtyDaysAgo;
      });
    }
  
    if (activeFilters.conPolizasActivas) {
      result = result.filter(cliente =>
        cliente.cobertura === true ||
        (cliente.coberturas && cliente.coberturas.length > 0)
      );
    }
  
    if (activeFilters.sinGrupoFamiliar) {
      result = result.filter(cliente =>
        !cliente.grupo_familiar_id &&
        (!cliente.coberturas || cliente.coberturas.length === 0 || !cliente.coberturas[0].grupo_familiar_id)
      );
    }
  
    // Aplicar ordenamiento
    result.sort((a, b) => {
      let valueA = a[sortField] ?? "";
      let valueB = b[sortField] ?? "";
  
      // Convertir a minúsculas si son strings
      if (typeof valueA === 'string') valueA = valueA.toLowerCase();
      if (typeof valueB === 'string') valueB = valueB.toLowerCase();
  
      if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  
    setFilteredClientes(result); // Actualiza el estado con los datos filtrados.
    setCurrentPage(1); // Resetea a la primera página cuando cambian los filtros.
  }, [searchTerm, filterStatus, sortField, sortDirection, clientes, activeFilters]);
  
 // Calcular la paginación
const indexOfLastItem = currentPage * itemsPerPage; // Índice del último ítem de la página
const indexOfFirstItem = indexOfLastItem - itemsPerPage; // Índice del primer ítem de la página
const currentItems = Array.isArray(filteredClientes) 
  ? filteredClientes.slice(indexOfFirstItem, indexOfLastItem) // Cortamos los elementos para mostrar en la página actual
  : [];
const totalPages = Math.ceil((filteredClientes?.length || 0) / itemsPerPage); // Calculamos el total de páginas


// Cambiar de página
const paginate = (pageNumber) => setCurrentPage(pageNumber); // Actualiza la página
  
  // Manejar ordenamiento
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };
  
  // Manejar eliminación
  const handleDelete = async (id, nombre) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar al cliente ${nombre}?`)) {
      try {
        await apiRequest(`cliente/${id}`, "DELETE");
        
        const updatedClientes = clientes.filter(cliente => cliente.id !== id);
        setClientes(updatedClientes);
        setFilteredClientes(prevFiltered => 
          prevFiltered.filter(cliente => cliente.id !== id)
        );
        
        // Mostrar toast de éxito
        setToastMessage("Cliente eliminado con éxito");
        setToastVariant("success");
        setShowToast(true);
      } catch (err) {
        console.error("Error al eliminar cliente:", err);
        setToastMessage("No se pudo eliminar el cliente. " + (err.message || "Podría estar asociado a otros registros."));
        setToastVariant("danger");
        setShowToast(true);
      }
    }
  };
  
  // Función para abrir el modal de edición y pasar todos los datos del cliente
  const handleOpenEditModal = (cliente) => {
    setClienteToEdit(cliente.id);
    setClienteDataToEdit(cliente);
    setShowEditModal(true);
  };
  
  // Función para manejar la actualización del cliente después de editar
  const handleClienteUpdated = (updatedCliente) => {
    // Actualizar el cliente en la lista
    setClientes(prevClientes => 
      prevClientes.map(cliente => 
        cliente.id === updatedCliente.id ? updatedCliente : cliente
      )
    );
    
    // Actualizar la lista filtrada también
    setFilteredClientes(prevFiltered => 
      prevFiltered.map(cliente => 
        cliente.id === updatedCliente.id ? updatedCliente : cliente
      )
    );
    
    // Mostrar toast de éxito
    setToastMessage("Cliente actualizado con éxito");
    setToastVariant("success");
    setShowToast(true);
    setShowEditModal(false);
  };
  
  // Función para obtener el parentesco del cliente
  const getParentesco = (cliente) => {
    // Verificamos si hay un valor directo
    if (cliente.parentesco) {
      return cliente.parentesco;
    }
    
    // Si no, verificamos en coberturas
    if (cliente.coberturas && Array.isArray(cliente.coberturas) && cliente.coberturas.length > 0) {
      return cliente.coberturas[0].parentesco || "Sin definir";
    }
    
    return "Sin parentesco";
  };
  
  // Función para obtener el ID del grupo familiar
  const getGrupoFamiliarId = (cliente) => {
    // Si el cliente no tiene grupo familiar, asignar "N/A"
    if (!cliente.grupo_familiar_id) {
      return "N/A";
    }
  
    return cliente.grupo_familiar_id;
  };
  
  
  // Renderizar paginación
 // Renderizar los botones de paginación
const renderPaginationItems = () => {
  const pages = [];

  // Botón para ir a la primera página
  pages.push(
    <Pagination.First 
      key="first" 
      onClick={() => paginate(1)} 
      disabled={currentPage === 1} // Desactivar si ya estamos en la primera página
    />
  );

  // Botón para ir a la página anterior
  pages.push(
    <Pagination.Prev 
      key="prev" 
      onClick={() => paginate(currentPage - 1)} 
      disabled={currentPage === 1} // Desactivar si estamos en la primera página
    />
  );

  // Generar los números de página
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    pages.push(<Pagination.Ellipsis key="ellipsis-start" disabled />);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(
      <Pagination.Item 
        key={i} 
        active={i === currentPage}
        onClick={() => paginate(i)} // Cambiar a la página correspondiente
      >
        {i}
      </Pagination.Item>
    );
  }

  if (endPage < totalPages) {
    pages.push(<Pagination.Ellipsis key="ellipsis-end" disabled />);
  }

  // Botón para ir a la página siguiente
  pages.push(
    <Pagination.Next 
      key="next" 
      onClick={() => paginate(currentPage + 1)} 
      disabled={currentPage === totalPages || totalPages === 0} // Desactivar si ya estamos en la última página
    />
  );

  // Botón para ir a la última página
  pages.push(
    <Pagination.Last 
      key="last" 
      onClick={() => paginate(totalPages)} 
      disabled={currentPage === totalPages || totalPages === 0} // Desactivar si estamos en la última página
    />
  );

  return pages;
};
 
  // Función para formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return "No registrado";
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };
  
  // Renderizar los filtros activos como pills/badges
  const renderActiveFiltersPills = () => {
    // Si no hay filtros activos, no mostrar nada
    if (!Object.values(activeFilters).some(value => value)) {
      return null;
    }
    
    return (
      <div className="d-flex flex-wrap mt-2">
        {activeFilters.nuevos30Dias && (
          <Badge bg="primary" className="me-2 mb-1 py-2 px-3">
            Clientes nuevos (30 días)
            <Button 
              variant="link" 
              className="p-0 ms-2 text-white" 
              onClick={() => removeFilter('nuevos30Dias')}
              style={{ fontSize: '10px', textDecoration: 'none' }}
            >
              <FaTimes />
            </Button>
          </Badge>
        )}
        
        {activeFilters.conPolizasActivas && (
          <Badge bg="primary" className="me-2 mb-1 py-2 px-3">
            Con pólizas activas
            <Button 
              variant="link" 
              className="p-0 ms-2 text-white" 
              onClick={() => removeFilter('conPolizasActivas')}
              style={{ fontSize: '10px', textDecoration: 'none' }}
            >
              <FaTimes />
            </Button>
          </Badge>
        )}
        
        {activeFilters.sinGrupoFamiliar && (
          <Badge bg="primary" className="me-2 mb-1 py-2 px-3">
            Sin grupo familiar
            <Button 
              variant="link" 
              className="p-0 ms-2 text-white" 
              onClick={() => removeFilter('sinGrupoFamiliar')}
              style={{ fontSize: '10px', textDecoration: 'none' }}
            >
              <FaTimes />
            </Button>
          </Badge>
        )}
      </div>
    );
  };
  
  const renderClientesTable = () => {
    if (loading) {
      return (
        <div className="text-center p-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Cargando clientes...</p>
        </div>
      );
    }
  
    if (error) {
      return (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      );
    }
  
    if (!Array.isArray(filteredClientes) || filteredClientes.length === 0) {
      return (
        <div className="text-center p-5">
          <FaSearch size={40} className="text-muted mb-3" />
          <h4>No se encontraron clientes</h4>
          <p className="text-muted">
            {searchTerm || filterStatus !== "all" || Object.values(activeFilters).some(v => v)
              ? "Intenta con otros criterios de búsqueda"
              : "No hay clientes registrados en el sistema"}
          </p>
        </div>
      );
    }
  
    return (
      <>
        <div className="table-responsive">
          <Table hover className="lista-clientes-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre Completo</th>
                <th>Fecha Nacimiento</th>
                <th>Código Postal</th>
                <th>Parentesco</th>
                <th>Teléfono</th>
                <th>ID GF</th>
                <th>Prospecto</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
  {currentItems.map(cliente => ( // Asegúrate de que uses currentItems
    cliente.grupoFamiliarIds.map((grupoId, index) => (
      <tr key={`${cliente.id}-${grupoId}`}>
        <td>{cliente.id || "Sin ID"}</td>
        <td>{cliente.nombre_completo || "Sin nombre"}</td>
        <td>{formatDate(cliente.fecha_nacimiento)}</td>
        <td>{cliente.codigo_postal || "No registrado"}</td>
        <td>{getParentesco(cliente)}</td>
        <td>{cliente.telefono || "No registrado"}</td>
        <td>{grupoId || "Sin grupo"}</td>
        <td>
              <Badge
                pill
                bg={
                  cliente.estado_cliente === "cliente"
                    ? "primary"
                    : cliente.estado_cliente === "prospecto"
                    ? "warning"
                    : "danger" // para "descartado"
                }
                text={
                  cliente.estado_cliente === "cliente"
                    ? "light"
                    : cliente.estado_cliente === "prospecto"
                    ? "dark"
                    : "light" // para "descartado"
                }
              >
                {cliente.estado_cliente === "cliente"
                  ? "Cliente"
                  : cliente.estado_cliente === "prospecto"
                  ? "Prospecto"
                  : "Descartado"}
              </Badge>
            </td>

        <td className="text-center">
          <Button 
            variant="outline-primary" 
            size="sm"
            onClick={() => handleOpenViewModal(cliente, grupoId)}
          >
            <FaEye />
          </Button>
          <Button 
            variant="outline-success" 
            size="sm"
            onClick={() => handleOpenEditModal(cliente)}
          >
            <FaEdit />
          </Button>
          <Button 
            variant="outline-danger" 
            size="sm"
            onClick={() => handleDelete(cliente.id, cliente.nombre_completo)}
          >
            <FaTrashAlt />
          </Button>
        </td>
      </tr>
    ))
  ))}
</tbody>
          </Table>
        </div>
  
        {/* Mostrar paginación si es necesario */}
        <div className="d-flex justify-content-between align-items-center mt-3">
          <Pagination>{renderPaginationItems()}</Pagination>
        </div>
      </>
    );
  };
    
  // Función para determinar el color del badge según el estado
  const getStatusBadgeColor = (status) => {
    if (!status) return "secondary";
    
    switch (status.toString().toLowerCase()) {
      case "activo":
        return "success";
      case "inactivo":
        return "danger";
      case "pendiente":
        return "warning";
      default:
        return "info";
    }
  };

  return (
    <div className="lista-clientes-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="page-title">Lista de Clientes</h1>
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
      
      <Card className="mb-4">
        <Card.Body>
          <div className="filter-container">
            <div className="row">
              <div className="col-md-6 mb-3 mb-md-0">
                <InputGroup>
                  <Form.Control
                    placeholder="Buscar por nombre, email, teléfono o Social..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Button variant="outline-secondary">
                    <FaSearch />
                  </Button>
                </InputGroup>
              </div>
              
              <div className="col-md-3 mb-3 mb-md-0">
                <Form.Select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="activo">Activos</option>
                  <option value="inactivo">Inactivos</option>
                  <option value="pendiente">Pendientes</option>
                </Form.Select>
              </div>
              
              <div className="col-md-3 d-flex gap-2">
                <div className="position-relative flex-grow-1" ref={filterRef}>
                  <Button 
                    variant="outline-secondary" 
                    className="w-100 d-flex align-items-center justify-content-center"
                    onClick={() => setShowFiltersPopover(!showFiltersPopover)}
                  >
                    <FaFilter className="me-2" />
                    Filtros
                  </Button>
                  
                  <Overlay
                    show={showFiltersPopover}
                    target={filterRef.current}
                    placement="bottom"
                    container={filterRef.current}
                    containerPadding={20}
                  >
                    <Popover id="filters-popover" style={{ minWidth: '200px' }}>
                      <Popover.Header as="h3">Filtros adicionales</Popover.Header>
                      <Popover.Body>
                        <div className="d-grid gap-2">
                          <Button 
                            variant={activeFilters.nuevos30Dias ? "primary" : "outline-primary"}
                            size="sm"
                            onClick={() => applyFilter('nuevos30Dias', !activeFilters.nuevos30Dias)}
                            className="text-start"
                          >
                            Clientes nuevos (30 días)
                          </Button>
                          <Button 
                            variant={activeFilters.conPolizasActivas ? "primary" : "outline-primary"}
                            size="sm"
                            onClick={() => applyFilter('conPolizasActivas', !activeFilters.conPolizasActivas)}
                            className="text-start"
                          >
                            Con pólizas activas
                          </Button>
                          <Button 
                            variant={activeFilters.sinGrupoFamiliar ? "primary" : "outline-primary"}
                            size="sm"
                            onClick={() => applyFilter('sinGrupoFamiliar', !activeFilters.sinGrupoFamiliar)}
                            className="text-start"
                          >
                            Sin grupo familiar
                          </Button>
                          <hr />
                          <Button 
                            variant="outline-secondary"
                            size="sm"
                            onClick={clearAllFilters}
                          >
                            Limpiar filtros
                          </Button>
                        </div>
                      </Popover.Body>
                    </Popover>
                  </Overlay>
                </div>
                
                <Button variant="outline-secondary">
                  <FaFileExport />
                </Button>
              </div>
            </div>
            
            {/* Mostrar filtros activos como badges */}
            {renderActiveFiltersPills()}
          </div>
        </Card.Body>
      </Card>
      
      {renderClientesTable()}
      
      {/* Modal de Edición */}
      <EditClienteModal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        clienteId={clienteToEdit}
        clienteData={clienteDataToEdit}
        onClienteUpdated={handleClienteUpdated}
      />
      
      {/* Modal de Visualización */}
      <DetalleClienteModal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        clienteData={clienteToView}
        grupoFamiliarId={clienteToView?.grupoFamiliarId} 
      />
      
      {/* Toast de notificación */}
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