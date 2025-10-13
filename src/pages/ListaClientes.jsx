import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Card, Table, Form, InputGroup, Button, Badge,
  Spinner, Pagination, Toast, ToastContainer, Overlay, Popover
} from "react-bootstrap";
import {
  FaSearch, FaEdit, FaEye, FaTrashAlt, FaUserPlus,
  FaFilter, FaFileExport, FaTimes
} from "react-icons/fa";
import "../styles/ListaClientes.css";
import apiRequest from "../services/api";
import EditClienteModal from "../components/EditClienteModal";
import DetalleClienteModal from "../components/DetalleClienteModal";

/* Helpers */
const CLIENTE_FICHA_PATH = (id) => `/clientes/${id}/ficha`;

export const renderClienteLink = (clienteId, label = null) => {
  if (!clienteId) return "—";
  return (
    <Link
      to={CLIENTE_FICHA_PATH(clienteId)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-decoration-none"
      title="Abrir ficha del cliente en una nueva pestaña"
      onClick={(e) => e.stopPropagation()}
    >
      {label ?? clienteId}
    </Link>
  );
};
// normaliza para comparar "Cotización" == "cotizacion" == "COTIZACION"
// Reemplaza tu norm por este
const norm = (s) =>
  (s ?? "")
    .toString()
    .trim()                       // <- quita espacios al inicio/fin
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita acentos

    const estadoToVariant = (estado) => {
      switch (norm(estado)) {          // <- normalizado
        case "toma de datos":      return "info";
        case "cotizacion":         return "warning";
        case "seguimiento":        return "success";
        case "inscripcion inicial":return "primary";
        case "descartado":         return "danger";
        default:                   return "secondary";
      }
    };
    

/* Columna “Proceso” solo con estados (cada badge abre el grupo) */
const ProcesoCell = ({ grupos }) => {
  if (!grupos?.length) return <>Sin proceso</>;
  const ordered = [...grupos].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  const MAX = 3;
  const [expanded, setExpanded] = React.useState(false);
  const list = expanded ? ordered : ordered.slice(0, MAX);

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
              title={`Abrir grupo #${g.id}`}
            >
              <Badge pill bg={estadoToVariant(g.estado)} className="stacked-badge">
                {g.estado || "Sin estado"}
              </Badge>
            </Link>
          </div>
        ))}
      </div>

      {ordered.length > MAX && (
        <Button
          variant="link"
          size="sm"
          className="p-0 mt-1"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? "Ver menos" : `+${ordered.length - MAX} más`}
        </Button>
      )}
    </div>
  );
};

const ListaClientes = () => {
  // Datos y UI
  const [clientes, setClientes] = useState([]);
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros/búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeFilters, setActiveFilters] = useState({
    nuevos30Dias: false,
    conPolizasActivas: false,
    sinGrupoFamiliar: false
  });
  const [showFiltersPopover, setShowFiltersPopover] = useState(false);
  const filterRef = React.useRef(null);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modales / toasts
  const [showEditModal, setShowEditModal] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState(null);
  const [clienteDataToEdit, setClienteDataToEdit] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [clienteToView, setClienteToView] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("cliente/with-cobertura");
      const raw = Array.isArray(response?.data) ? response.data : (response || []);
      const clientesArray = Array.isArray(raw) ? raw : Object.values(raw);

      const normalizados = clientesArray.map((c) => {
        const idsCob = (c.coberturas || []).map(co => co.grupo_familiar_id).filter(Boolean);
        const baseId = c.grupo_familiar_id ? [c.grupo_familiar_id] : [];
        const grupoFamiliarIds = Array.from(new Set([...baseId, ...idsCob]));

        const estadosMap = new Map(); // id -> estado
        (c.grupo_estados || []).forEach(g => {
          if (g?.id) estadosMap.set(g.id, g.estado || "Sin estado");
        });
        (c.coberturas || []).forEach(co => {
          const gid = co.grupo_familiar_id;
          const est = co.grupo_familiar?.estado_actual_catalogo?.estado_nombre;
          if (gid && est && !estadosMap.has(gid)) estadosMap.set(gid, est);
        });

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

  // Acciones UI
  const handleOpenViewModal = (cliente, grupoId) => {
    setClienteToView({ ...cliente, grupoFamiliarId: grupoId });
    setShowViewModal(true);
  };

  const applyFilter = (filterName, value = true) => {
    setActiveFilters(prev => ({ ...prev, [filterName]: value }));
    setShowFiltersPopover(false);
  };

  const removeFilter = (filterName) => {
    setActiveFilters(prev => ({ ...prev, [filterName]: false }));
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setActiveFilters({ nuevos30Dias: false, conPolizasActivas: false, sinGrupoFamiliar: false });
    setShowFiltersPopover(false);
  };

  // Búsqueda + filtros + orden por nombre
  useEffect(() => {
    if (!Array.isArray(clientes) || clientes.length === 0) return;

    let result = [...clientes];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(cliente =>
        (cliente.nombre_completo && cliente.nombre_completo.toLowerCase().includes(q)) ||
        (cliente.email && cliente.email.toLowerCase().includes(q)) ||
        (cliente.telefono && String(cliente.telefono).includes(searchTerm)) ||
        (cliente.social && String(cliente.social).includes(searchTerm))
      );
    }

    if (filterStatus !== "all") {
      result = result.filter((cliente) => {
        const grupos = cliente.grupos || [];
        if (filterStatus === "sin-proceso") {
          return grupos.length === 0;
        }
        // hay al menos un grupo cuyo estado coincide
        return grupos.some(g => norm(g.estado) === norm(filterStatus));
      });
    }
    

    if (activeFilters.nuevos30Dias) {
      const d = new Date(); d.setDate(d.getDate() - 30);
      result = result.filter(c => c.created_at && new Date(c.created_at) >= d);
    }

    if (activeFilters.conPolizasActivas) {
      result = result.filter(c => c.cobertura === true || (c.coberturas && c.coberturas.length > 0));
    }

    if (activeFilters.sinGrupoFamiliar) {
      result = result.filter(c =>
        !c.grupo_familiar_id &&
        (!c.coberturas || c.coberturas.length === 0 || !c.coberturas[0].grupo_familiar_id)
      );
    }

    // Orden simple por nombre
    result.sort((a, b) => (a.nombre_completo || "").localeCompare(b.nombre_completo || "", undefined, { sensitivity: "base" }));

    setFilteredClientes(result);
    setCurrentPage(1);
  }, [searchTerm, filterStatus, clientes, activeFilters]);

  // Paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = Array.isArray(filteredClientes)
    ? filteredClientes.slice(indexOfFirstItem, indexOfLastItem)
    : [];
  const totalPages = Math.ceil((filteredClientes?.length || 0) / itemsPerPage);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const renderPaginationItems = () => {
    const pages = [];
    pages.push(<Pagination.First key="first" onClick={() => paginate(1)} disabled={currentPage === 1} />);
    pages.push(<Pagination.Prev key="prev" onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} />);

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    if (startPage > 1) pages.push(<Pagination.Ellipsis key="ellipsis-start" disabled />);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(<Pagination.Item key={i} active={i === currentPage} onClick={() => paginate(i)}>{i}</Pagination.Item>);
    }

    if (endPage < totalPages) pages.push(<Pagination.Ellipsis key="ellipsis-end" disabled />);
    pages.push(<Pagination.Next key="next" onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} />);
    pages.push(<Pagination.Last key="last" onClick={() => paginate(totalPages)} disabled={currentPage === totalPages || totalPages === 0} />);
    return pages;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "No registrado";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getParentesco = (cliente) => {
    if (cliente.parentesco) return cliente.parentesco;
    if (cliente.coberturas?.length) return cliente.coberturas[0].parentesco || "Sin definir";
    return "Sin parentesco";
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar al cliente ${nombre}?`)) return;
    try {
      await apiRequest(`cliente/${id}`, "DELETE");
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

  const handleOpenEditModal = (cliente) => {
    setClienteToEdit(cliente.id);
    setClienteDataToEdit(cliente);
    setShowEditModal(true);
  };

  const handleClienteUpdated = (updatedCliente) => {
    setClientes(prev => prev.map(c => (c.id === updatedCliente.id ? updatedCliente : c)));
    setFilteredClientes(prev => prev.map(c => (c.id === updatedCliente.id ? updatedCliente : c)));
    setToastMessage("Cliente actualizado con éxito");
    setToastVariant("success");
    setShowToast(true);
    setShowEditModal(false);
  };

  /* UI principal */
  const renderActiveFiltersPills = () => {
    if (!Object.values(activeFilters).some(value => value)) return null;
    return (
      <div className="d-flex flex-wrap mt-2">
        {activeFilters.nuevos30Dias && (
          <Badge bg="primary" className="me-2 mb-1 py-2 px-3">
            Clientes nuevos (30 días)
            <Button variant="link" className="p-0 ms-2 text-white" onClick={() => removeFilter('nuevos30Dias')} style={{ fontSize: '10px', textDecoration: 'none' }}>
              <FaTimes />
            </Button>
          </Badge>
        )}
        {activeFilters.conPolizasActivas && (
          <Badge bg="primary" className="me-2 mb-1 py-2 px-3">
            Con pólizas activas
            <Button variant="link" className="p-0 ms-2 text-white" onClick={() => removeFilter('conPolizasActivas')} style={{ fontSize: '10px', textDecoration: 'none' }}>
              <FaTimes />
            </Button>
          </Badge>
        )}
        {activeFilters.sinGrupoFamiliar && (
          <Badge bg="primary" className="me-2 mb-1 py-2 px-3">
            Sin grupo familiar
            <Button variant="link" className="p-0 ms-2 text-white" onClick={() => removeFilter('sinGrupoFamiliar')} style={{ fontSize: '10px', textDecoration: 'none' }}>
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
      return <div className="alert alert-danger" role="alert">{error}</div>;
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

    const current = currentItems;

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
                <th>Proceso</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {current.map(cliente => {
                const grupos = cliente.grupos || [];
                const unico = grupos.length === 1 ? grupos[0] : null;

                return (
                  <tr key={cliente.id}>
                    <td>{cliente.id || "Sin ID"}</td>
                    <td>{renderClienteLink(cliente.id, cliente.nombre_completo || "Sin nombre")}</td>
                    <td>{formatDate(cliente.fecha_nacimiento)}</td>
                    <td>{cliente.codigo_postal || "No registrado"}</td>
                    <td>{getParentesco(cliente)}</td>
                    <td>{cliente.telefono || "No registrado"}</td>
                    <td><ProcesoCell grupos={grupos} /></td>
                    <td className="text-center">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleOpenViewModal(cliente, unico?.id || cliente.grupo_familiar_id)}
                        className="me-1"
                      >
                        <FaEye />
                      </Button>
                      <Button
                        variant="outline-success"
                        size="sm"
                        onClick={() => handleOpenEditModal(cliente)}
                        className="me-1"
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
                );
              })}
            </tbody>
          </Table>
        </div>

        <div className="d-flex justify-content-between align-items-center mt-3">
          <Pagination>{renderPaginationItems()}</Pagination>
        </div>
      </>
    );
  };

  return (
    <div className="lista-clientes-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="page-title">Lista de Clientes</h1>
        <Button variant="primary" as={Link} to="/clientes/crear" className="d-flex align-items-center">
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
  <option value="all">Todos los estados (Proceso)</option>
  <option value="cotizacion">Cotización</option>
  <option value="seguimiento">Seguimiento</option>   {/* <- sin espacio */}
  <option value="toma de datos">Toma de Datos</option>
  <option value="inscripcion inicial">Inscripción Inicial</option>
  <option value="descartado">Descartado</option>
  <option value="sin-proceso">Sin proceso</option>
</Form.Select>


              </div>

              <div className="col-md-3 d-flex gap-2">
                <div className="position-relative flex-grow-1" ref={filterRef}>
                  
                </div>

                <Button variant="outline-secondary">
                  <FaFileExport />
                </Button>
              </div>
            </div>

            {renderActiveFiltersPills()}
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

      <DetalleClienteModal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        clienteData={clienteToView}
        grupoFamiliarId={clienteToView?.grupoFamiliarId}
      />

      <ToastContainer className="p-3" position="top-end">
        <Toast show={showToast} onClose={() => setShowToast(false)} delay={3000} autohide bg={toastVariant}>
          <Toast.Header closeButton={true}>
            <strong className="me-auto">{toastVariant === "success" ? "Éxito" : "Error"}</strong>
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
