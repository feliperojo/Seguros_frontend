import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Card, Table, Form, InputGroup, Button, Badge, 
  Spinner, Pagination, Dropdown, Toast, ToastContainer
} from "react-bootstrap";
import { 
  FaSearch, FaEdit, FaEye, FaTrashAlt, FaUserPlus, 
  FaFilter, FaSortAmountDown, FaSortAmountUp, FaFileExport
} from "react-icons/fa";
import "../styles/ListaClientes.css";
import apiRequest from "../services/api";
import EditClienteModal from "../components/EditClienteModal"; // Importamos el componente de modal
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
  
  // Cargar datos
  useEffect(() => {
    fetchClientes();
  }, []);
  
  const fetchClientes = async () => {
    setLoading(true);
    try {
      console.log("Iniciando petición a la API para obtener clientes...");
      
      const data = await apiRequest("cliente");
      console.log("Respuesta completa:", data);
      
      const clientesData = data?.data || data || [];
      
      console.log("Datos de clientes procesados:", clientesData);
      
      const clientesArray = Array.isArray(clientesData) 
        ? clientesData 
        : Object.values(clientesData);
      
      if (clientesArray.length === 0) {
        console.log("No se encontraron clientes en la respuesta de la API");
      }
      
      setClientes(clientesArray);
      setFilteredClientes(clientesArray);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
      setError("No se pudieron cargar los clientes. " + (err.message || "Por favor, intente nuevamente."));
    } finally {
      setLoading(false);
    }
  };

      // Función para abrir el modal de visualización
    const handleOpenViewModal = (cliente) => {
      setClienteToView(cliente);
      setShowViewModal(true);
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
        (cliente.numero_documento && cliente.numero_documento.toString().includes(searchTerm))
      );
    }
    
    // Aplicar filtro de estado
    if (filterStatus !== "all") {
      result = result.filter(cliente => cliente.status === filterStatus);
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
    
    setFilteredClientes(result);
    setCurrentPage(1); // Reset a la primera página cuando cambian los filtros
  }, [searchTerm, filterStatus, sortField, sortDirection, clientes]);
  
  // Calcular paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = Array.isArray(filteredClientes) 
    ? filteredClientes.slice(indexOfFirstItem, indexOfLastItem)
    : [];
  const totalPages = Math.ceil((filteredClientes?.length || 0) / itemsPerPage);
  
  // Cambiar página
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  
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
       // Actualizar la lista filtrada también
  setFilteredClientes(prevFiltered => 
    prevFiltered.map(cliente => 
      cliente.id === updatedCliente.id ? updatedCliente : cliente
    )
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
    
    // Mostrar toast de éxito
    setToastMessage("Cliente actualizado con éxito");
    setToastVariant("success");
    setShowToast(true);
  };
  
  // Renderizar paginación
  const renderPaginationItems = () => {
    const pages = [];
    
    // Botón para ir a la primera página
    pages.push(
      <Pagination.First 
        key="first" 
        onClick={() => paginate(1)} 
        disabled={currentPage === 1}
      />
    );
    
    // Botón para ir a la página anterior
    pages.push(
      <Pagination.Prev 
        key="prev" 
        onClick={() => paginate(currentPage - 1)} 
        disabled={currentPage === 1}
      />
    );
    
    // Limitamos a mostrar 5 páginas alrededor de la actual
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    // Si estamos lejos del inicio, mostrar "..."
    if (startPage > 1) {
      pages.push(<Pagination.Ellipsis key="ellipsis-start" disabled />);
    }
    
    // Generar los números de página
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
    
    // Si estamos lejos del final, mostrar "..."
    if (endPage < totalPages) {
      pages.push(<Pagination.Ellipsis key="ellipsis-end" disabled />);
    }
    
    // Botón para ir a la página siguiente
    pages.push(
      <Pagination.Next 
        key="next" 
        onClick={() => paginate(currentPage + 1)} 
        disabled={currentPage === totalPages || totalPages === 0}
      />
    );
    
    // Botón para ir a la última página
    pages.push(
      <Pagination.Last 
        key="last" 
        onClick={() => paginate(totalPages)} 
        disabled={currentPage === totalPages || totalPages === 0}
      />
    );
    
    return pages;
  };
  
  // Renderizar tabla de clientes
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
    
    // Verificar que filteredClientes sea un array
    if (!Array.isArray(filteredClientes) || filteredClientes.length === 0) {
      return (
        <div className="text-center p-5">
          <FaSearch size={40} className="text-muted mb-3" />
          <h4>No se encontraron clientes</h4>
          <p className="text-muted">
            {searchTerm || filterStatus !== "all" 
              ? "Intenta con otros criterios de búsqueda"
              : "No hay clientes registrados en el sistema"}
          </p>
          // En la sección donde se renderizan los botones de acciones por cliente
          <Button 
            variant="outline-success" 
            size="sm"
            onClick={() => handleOpenEditModal(cliente)}
            title="Editar cliente"
          >
            <FaEdit />
          </Button>

        </div>
      );
    }
    
    // Verificar que currentItems sea un array y tenga elementos
    if (!Array.isArray(currentItems) || currentItems.length === 0) {
      return (
        <div className="text-center p-5">
          <p className="text-muted">No hay resultados para mostrar con los filtros actuales.</p>
        </div>
      );
    }
    
    return (
      <>
        <div className="table-responsive">
          <Table hover className="lista-clientes-table">
            <thead>
              <tr>
                <th onClick={() => handleSort("nombre_completo")} className="sortable-header">
                  Nombre
                  {sortField === "nombre_completo" && (
                    sortDirection === "asc" ? <FaSortAmountUp className="ms-2" /> : <FaSortAmountDown className="ms-2" />
                  )}
                </th>
                <th onClick={() => handleSort("telefono")} className="sortable-header">
                  Contacto
                  {sortField === "telefono" && (
                    sortDirection === "asc" ? <FaSortAmountUp className="ms-2" /> : <FaSortAmountDown className="ms-2" />
                  )}
                </th>
                <th onClick={() => handleSort("status")} className="sortable-header">
                  Estado
                  {sortField === "status" && (
                    sortDirection === "asc" ? <FaSortAmountUp className="ms-2" /> : <FaSortAmountDown className="ms-2" />
                  )}
                </th>
                <th onClick={() => handleSort("created_at")} className="sortable-header">
                  Registro
                  {sortField === "created_at" && (
                    sortDirection === "asc" ? <FaSortAmountUp className="ms-2" /> : <FaSortAmountDown className="ms-2" />
                  )}
                </th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map(cliente => (
                <tr key={cliente.id || Math.random().toString()}>
                  <td>
                    <div className="cliente-nombre">
                      {cliente.nombre_completo}
                      {cliente.categoria && (
                        <Badge bg="info" pill className="ms-2">
                          {cliente.categoria}
                        </Badge>
                      )}
                    </div>
                    <small className="texto-secundario">
                      {cliente.tipo_documento && cliente.numero_documento 
                        ? `${cliente.tipo_documento}: ${cliente.numero_documento}`
                        : "Sin documento registrado"}
                    </small>
                  </td>
                  <td>
                    {cliente.telefono && (
                      <div>
                        <i className="bi bi-telephone me-1"></i>
                        {cliente.telefono}
                        {cliente.whatsapp && <i className="bi bi-whatsapp ms-1 text-success"></i>}
                      </div>
                    )}
                    {cliente.email && (
                      <small className="texto-secundario d-block">
                        <i className="bi bi-envelope me-1"></i>
                        {cliente.email}
                      </small>
                    )}
                  </td>
                  <td>
                    <Badge bg={getStatusBadgeColor(cliente.status)}>
                      {cliente.status || "Sin estado"}
                    </Badge>
                  </td>
                  <td>
                    {cliente.created_at 
                      ? new Date(cliente.created_at).toLocaleDateString() 
                      : "Fecha desconocida"}
                  </td>
                  <td>
                    <div className="d-flex justify-content-center gap-2">
                       <Button 
                          variant="outline-primary" 
                          size="sm"
                          onClick={() => handleOpenViewModal(cliente)}
                          title="Ver detalles"
                        >
                          <FaEye />
                        </Button>
                      <Button 
                        variant="outline-success" 
                        size="sm"
                        onClick={() => handleOpenEditModal(cliente)}
                        title="Editar cliente"
                      >
                        <FaEdit />
                      </Button>
                      <Button 
                        variant="outline-danger" 
                        size="sm"
                        onClick={() => handleDelete(cliente.id, cliente.nombre_completo)}
                        title="Eliminar cliente"
                      >
                        <FaTrashAlt />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        
        <div className="d-flex justify-content-between align-items-center mt-3">
          <div className="pagination-info">
            Mostrando {indexOfFirstItem + 1} a {Math.min(indexOfLastItem, filteredClientes.length)} de {filteredClientes.length} clientes
          </div>
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
                    placeholder="Buscar por nombre, email, teléfono o documento..."
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
                <Dropdown className="flex-grow-1">
                  <Dropdown.Toggle variant="outline-secondary" id="dropdown-filters" className="w-100">
                    <FaFilter className="me-2" />
                    Filtros
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item>Clientes nuevos (30 días)</Dropdown.Item>
                    <Dropdown.Item>Con pólizas activas</Dropdown.Item>
                    <Dropdown.Item>Sin grupo familiar</Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={() => {
                      setSearchTerm("");
                      setFilterStatus("all");
                    }}>
                      Limpiar filtros
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
                
                <Button variant="outline-secondary">
                  <FaFileExport />
                </Button>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>
      
      {renderClientesTable()}
      
      <EditClienteModal
  show={showEditModal}
  onHide={() => setShowEditModal(false)}
  clienteId={clienteToEdit}
  clienteData={clienteDataToEdit}
  onClienteUpdated={handleClienteUpdated}
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
      // Al final del componente, antes del cierre del return
          {/* Modal de Edición Mejorado */}
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
            />

    </div>
    
  );
};

export default ListaClientes;