// Dashboard.js con integración de modal de edición
import React, { useState, useEffect } from "react";
import { Card, Row, Col, Button, Table, Badge, Alert } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  FaUsers, FaProjectDiagram, FaCalendarAlt, FaExclamationTriangle,
  FaPlus, FaList, FaChartLine, FaFileInvoiceDollar, FaEdit, FaEye
} from "react-icons/fa";
import "../styles/Dashboard.css";
import apiRequest from "../services/api";
import EditClienteModal from "../components/EditClienteModal"; // Importamos el modal de edición
// Importar el componente modal de visualización
import DetalleClienteModal from "../components/DetalleClienteModal";
import CalendarioTareas from "../components/Tareas/CalendarioTareas";
import { Helmet } from "react-helmet-async";



const Dashboard = () => {
  const currentUser = JSON.parse(localStorage.getItem("user"));
  

  const [clientesRecientes, setClientesRecientes] = useState([]);
  const [polizasCanceladas, setPolizasCanceladas] = useState([]);
  const [documentosProximosVencer, setDocumentosProximosVencer] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [loadingTareas, setLoadingTareas] = useState(true);
  
  const [polizasProximasVencer, setPolizasProximasVencer] = useState([]);
  const [estadisticas, setEstadisticas] = useState({
    totalClientes: 0,
    totalGruposFamiliares: 0,
    polizasActivas: 0,
    polizasVencidas: 0
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para el modal de edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState(null);
  const [clienteDataToEdit, setClienteDataToEdit] = useState(null);
  // Agregar estados para el modal de visualización
const [showViewModal, setShowViewModal] = useState(false);
const [clienteToView, setClienteToView] = useState(null);
const [filtroDias, setFiltroDias] = useState(15);

  useEffect(() => {
    cargarDatos();
  }, []);
  
  const cargarDatos = async () => {
    const resTareas = await apiRequest("tareas_operativas?per_page=100", "GET");
    setTareas(resTareas.data || []);
    setLoadingTareas(false);

    setCargando(true);
    setError(null);
    try {

      const resDocumentos = await apiRequest(`documentos/proximos-vencer?dias=${filtroDias}`, "GET");

      setDocumentosProximosVencer(resDocumentos);

      const resClientes = await apiRequest("cliente/recientes", "GET");
      setClientesRecientes(resClientes.slice(0, 15));

      const resCanceladas = await apiRequest("cobertura/canceladas", "GET");
    
      setPolizasCanceladas(resCanceladas.slice(0, 15)); // Mostrar solo 15


      const resPolizas = await apiRequest("cobertura/proximas-vencer", "GET");
      setPolizasProximasVencer(resPolizas.slice(0, 5));

      const resEstadisticas = await apiRequest("cliente/general", "GET");
      setEstadisticas(resEstadisticas);
    } catch (err) {
      console.error("Error al cargar datos del dashboard:", err);
      setError("Hubo un problema al cargar los datos. Por favor, intente nuevamente.");
    } finally {
      setCargando(false);
    }
  };

  const handleChangeFiltroDias = async (e) => {
    const dias = parseInt(e.target.value);
    setFiltroDias(dias);
    try {
      const res = await apiRequest(`documentos/proximos-vencer?dias=${dias}`, "GET");
      setDocumentosProximosVencer(res);
    } catch (error) {
      console.error("Error filtrando documentos:", error);
    }
  };
  

  // Función para abrir el modal de visualización
const handleOpenViewModal = (cliente) => {
  setClienteToView(cliente);
  setShowViewModal(true);
};
  
  // Función para abrir el modal de edición
  const handleOpenEditModal = (cliente) => {
    setClienteToEdit(cliente.id);
    setClienteDataToEdit(cliente);
    setShowEditModal(true);
  };
  
  // Función para manejar la actualización del cliente
  const handleClienteUpdated = (updatedCliente) => {
    // Actualizar el cliente en la lista de clientes recientes
    setClientesRecientes(prevClientes => 
      prevClientes.map(cliente => 
        cliente.id === updatedCliente.id ? updatedCliente : cliente
      )
    );
    
  };

  // Función para renderizar el mensaje cuando no hay datos
  const renderEmptyMessage = (mensaje) => (
    <tr>
      <td colSpan="12" className="text-center py-12">
        <div className="empty-state">
          <FaList className="empty-icon" />
          <p>{mensaje}</p>
        </div>
      </td>
    </tr>
  );

  // Función para renderizar el estado de carga
  const renderLoading = () => (
    <tr>
      <td colSpan="4" className="text-center py-4">
        <div className="loading-state">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-2">Cargando datos...</p>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="dashboard-wrapper">
 <Helmet>
      <title>Vantun/Panel Principal</title>
    </Helmet>
      {error && (
        <Row className="mb-4">
          <Col>
            <Alert variant="danger" className="d-flex align-items-center">
              <FaExclamationTriangle className="me-2" />
              <span>{error}</span>
            </Alert>
          </Col>
        </Row>
      )}

      <div className="section-container">
        <Row className="stats-cards g-3">
          <Col xl={3} md={6}>
            <Card className="dashboard-card h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="stats-title">Total Clientes</h6>
                    <h3 className="stats-value">{estadisticas.totalClientes}</h3>
                  </div>
                  <div className="stats-icon"><FaUsers /></div>
                </div>
                <Link to="/clientes/lista" className="stretched-link"></Link>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} md={6}>
            <Card className="dashboard-card h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="stats-title">Grupos Familiares</h6>
                    <h3 className="stats-value">{estadisticas.totalGruposFamiliares}</h3>
                  </div>
                  <div className="stats-icon"><FaProjectDiagram /></div>
                </div>
                <Link to="/Grupofamiliar/lista" className="stretched-link"></Link>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} md={6}>
            <Card className="dashboard-card h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="stats-title">Pólizas Activas</h6>
                    <h3 className="stats-value">{estadisticas.polizasActivas}</h3>
                  </div>
                  <div className="stats-icon"><FaFileInvoiceDollar /></div>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} md={6}>
            <Card className="dashboard-card alert-card h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="stats-title">Pólizas Canceladas</h6>
                    <h3 className="stats-value">{estadisticas.polizasCanceladas}</h3>
                  </div>
                  <div className="stats-icon"><FaCalendarAlt /></div>
                </div>
                
              </Card.Body>
            </Card>
          </Col>
          
        </Row>
      </div>
      <div className="section-container table-section">
  <div className="d-flex justify-content-between align-items-center mb-3">
    <h5 className="section-title mb-0">Documentos solicitados</h5>
    <div>
      <label className="me-2">Filtrar por:</label>
      <select className="form-select form-select-sm w-auto d-inline" value={filtroDias} onChange={handleChangeFiltroDias}>
        <option value="15">15 días</option>
        <option value="30">30 días</option>
        <option value="60">60 días</option>
        <option value="90">90 días</option>
      </select>
    </div>
  </div>

  <div className="table-responsive">
    <Table hover className="mb-0 table-borderless">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Codigo poliza</th>
          <th>Parentesco</th>
          <th>Documento</th>
          <th>Estado</th>
          <th>Vence el</th>
          <th>Días restantes</th>
        </tr>
      </thead>
      <tbody>
        {cargando ? (
          renderLoading()
        ) : documentosProximosVencer.length > 0 ? (
          documentosProximosVencer.map(doc => {
            const fechaVenc = new Date(doc.fecha_vencimiento);
            const hoy = new Date();
            const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
            return (
              <tr key={doc.id}>
                <td className="fw-medium">{doc.cobertura?.cliente?.nombre_completo || 'Cliente desconocido'}</td>
                <td>{doc.cobertura?.codigo_poliza || 'N/D'}</td>
                <td>{doc.cobertura?.parentesco || 'N/D'}</td>
                <td>{doc.documento_requerido}</td>
                <td>
                  <Badge bg="primary">{doc.estado}</Badge>
                </td>
                <td>{(() => {
                  const month = String(fechaVenc.getMonth() + 1).padStart(2, "0");
                  const day = String(fechaVenc.getDate()).padStart(2, "0");
                  const year = fechaVenc.getFullYear();
                  return `${month}/${day}/${year}`;
                })()}</td>
                <td>
                  {diasRestantes <= 5 ? (
                    <Badge bg="danger">{diasRestantes} día(s)</Badge>
                  ) : diasRestantes <= 15 ? (
                    <Badge bg="warning" text="dark">{diasRestantes} días</Badge>
                  ) : (
                    <Badge bg="success">{diasRestantes} días</Badge>
                  )}
                </td>
              </tr>
            );
          })
        ) : (
          renderEmptyMessage("No hay documentos próximos a vencer.")
        )}
      </tbody>
    </Table>
  </div>
</div>


      <div className="section-container">
        <h5 className="section-title">Acciones Rápidas</h5>
        <Row className="g-3">
          <Col lg={3} md={6}>
            <Button as={Link} to="/clientes/crear" variant="primary" className="quick-action-btn">
              <FaPlus /> Nuevo Cliente
            </Button>
          </Col>
          <Col lg={3} md={6}>
            <Button as={Link} to="/grupofamiliar/crear" variant="primary" className="quick-action-btn">
              <FaPlus /> Nuevo Grupo Familiar
            </Button>
          </Col>
          <Col lg={3} md={6}>
            <Button as={Link} to="/" variant="outline-primary" className="quick-action-btn">
              <FaChartLine /> Ver Informes
            </Button>
          </Col>
          <Col lg={3} md={6}>
            <Button as={Link} to="/Grupofamiliar/lista" variant="outline-primary" className="quick-action-btn">
              <FaCalendarAlt /> Ver Cancelaciones
            </Button>
          </Col>
        </Row>
      </div>

      <Row className="mb-4 g-4 align-items-stretch">
      <Col lg={6} className="h-100">
      <div className="section-container table-section h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="section-title mb-0">Clientes Recientes</h5>
              <Link to="/clientes/lista" className="btn btn-sm btn-link text-decoration-none">
              
                Ver todos <FaList className="ms-1" />
              </Link>
            </div>
            <div className="table-responsive">
              <Table hover className="mb-0 table-borderless">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Fecha</th>
                    <th>Contacto</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    renderLoading()
                  ) : clientesRecientes.length > 0 ? (
                    clientesRecientes.map(cliente => (
                      <tr key={cliente.id}>
                            <td className="fw-medium">{cliente.nombre_completo}</td>
                            <td>{(() => {
                              const d = new Date(cliente.created_at);
                              const month = String(d.getMonth() + 1).padStart(2, "0");
                              const day = String(d.getDate()).padStart(2, "0");
                              const year = d.getFullYear();
                              return `${month}/${day}/${year}`;
                            })()}</td>
                            <td>{cliente.telefono || cliente.email}</td>
                            <td className="text-end">
                              <Button 
                                variant="outline-primary" 
                                size="sm"
                                className="me-1"
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
                            </td>
                          </tr>
                    ))
                  ) : (
                    renderEmptyMessage("No hay clientes recientes")
                  )}
                </tbody>
              </Table>
            </div>
          </div>
        </Col>

        <Col lg={6} className="h-100">
        <div className="section-container table-section h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="section-title mb-0">Pólizas Canceladas</h5>
              <Link to="/grupofamiliar/vencimientos" className="btn btn-sm btn-link text-decoration-none">
                Ver todas <FaList className="ms-1" />
              </Link>
            </div>
            <div className="table-responsive">
              <Table hover className="mb-0 table-borderless">
                <thead>
                  <tr>
                    <th>GF</th>
                    <th>Cliente</th>
                    <th>Vencimiento</th>
                    <th className="text-end">Estado</th>
                  </tr>
                </thead>
                <tbody>
                      {cargando ? (
                        renderLoading()
                      ) : polizasCanceladas.length > 0 ? (
                        polizasCanceladas.map(poliza => (
                          <tr key={poliza.id}>
                            <td className="fw-medium">{poliza.grupo_familiar?.id || 'Sin grupo'}</td>
                            <td>{poliza.cliente.nombre_completo || 'Sin tipo'}</td>
                            <td>{poliza.fecha_cancelacion ? (() => {
                              const d = new Date(poliza.fecha_cancelacion);
                              const month = String(d.getMonth() + 1).padStart(2, "0");
                              const day = String(d.getDate()).padStart(2, "0");
                              const year = d.getFullYear();
                              return `${month}/${day}/${year}`;
                            })() : 'Sin fecha'}</td>
                            <td className="text-end">
                              <Badge bg="danger" pill>Cancelada</Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        renderEmptyMessage("No hay pólizas canceladas")
                      )}
                    </tbody>

              </Table>
            </div>
          </div>
        </Col>
      </Row>
      <div className="section-container mt-4">
  <Card>
    <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
      <span><FaCalendarAlt className="me-2" /> Calendario de Tareas</span>
    </Card.Header>
    <Card.Body>
      {loadingTareas ? (
        <div className="d-flex justify-content-center py-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <CalendarioTareas tareas={tareas} currentUser={currentUser} />

      )}
    </Card.Body>
  </Card>
</div>

      
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
      />
    </div>
  );
};

export default Dashboard;