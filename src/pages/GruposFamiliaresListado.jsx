import React, { useState, useEffect } from "react";
import { 
    Container, Card, Table, Badge, Button, 
    Form, InputGroup, Dropdown, Modal
} from "react-bootstrap";
import { 
    FaSearch, FaEdit, FaEye, FaTrashAlt, FaUserPlus, 
    FaFilter, FaSortAmountDown, FaSortAmountUp, FaFileExport
} from "react-icons/fa";
import "../styles/GruposFamiliaresListado.css"
import { useNavigate } from "react-router-dom";
import apiRequest from "../services/api";





const GruposFamiliaresListado = () => {
  const navigate = useNavigate();
  
  // Estados
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos los estados");
  
  // Estados para modales
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentGrupo, setCurrentGrupo] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Cargar grupos al montar el componente o cuando cambia el estado seleccionado
  useEffect(() => {
    fetchGrupos();
  }, [selectedStatus]);
  
  // Función para cargar grupos
  const fetchGrupos = async () => {
    setLoading(true);
    try {
      // Endpoint para grupos familiares con coberturas y clientes
      let endpoint = "grupo_familiar/grupos-familiares-full";
      
      // Añadir parámetros de filtro por estado si es necesario
      if (selectedStatus !== "Todos los estados") {
        const estadoParam = selectedStatus.toLowerCase();
        endpoint += `?estado=${estadoParam}`;
      }
      
      const response = await apiRequest(endpoint, "GET");
      console.log("Datos recibidos:", response);
      
      if (response && response.status === "success" && Array.isArray(response.data)) {
        setGrupos(response.data);
      } else {
        console.error("Respuesta inesperada:", response);
        setGrupos([]);
      }
    } catch (error) {
      console.error("Error al cargar grupos familiares:", error);
      // Mostrar alerta al usuario
      alert("Error al cargar los grupos familiares. Por favor, intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };


// Añade esta función después de getCompaniaNombre o getTomadorNombre
const getGrupoEstado = (grupo) => {
  if (!grupo.coberturas || grupo.coberturas.length === 0) {
    return { estado: "Sin póliza", variant: "secondary" };
  }

  // Verificar si todas las coberturas tienen fecha de cancelación
  const todasCanceladas = grupo.coberturas.every(cobertura => !!cobertura.fecha_cancelacion);

  if (todasCanceladas) {
    return { estado: "Cancelada", variant: "danger" };
  }

  // Si al menos una no está cancelada
  return { estado: "Activa", variant: "success" };
};

  // Funciones para manejar acciones
  const handleOpenViewModal = (grupo) => {
    
    setCurrentGrupo(grupo);
    setShowViewModal(true);
  };
  
  const handleOpenEditModal = (grupo) => {
    const id = grupo.id;
    navigate(`/grupo-familiar/${id}/editar`);
  };
  
  const handleDelete = (grupo) => {
    setCurrentGrupo(grupo);
    setShowDeleteModal(true);
  };
  
  const confirmDelete = async () => {
    if (!currentGrupo) return;
    
    setDeleteLoading(true);
    try {
      const id = currentGrupo.id;
      await apiRequest(`grupo_familiar/${id}`, "DELETE");
      // Actualizar la lista después de eliminar
      setGrupos(grupos.filter(grupo => grupo.id !== id));
      setShowDeleteModal(false);
      setCurrentGrupo(null);
      // Mostrar mensaje de éxito
      alert("Grupo familiar eliminado correctamente");
    } catch (error) {
      console.error("Error al eliminar grupo familiar:", error);
      alert("No se pudo eliminar el grupo familiar. Por favor, inténtelo de nuevo.");
    } finally {
      setDeleteLoading(false);
    }
  };
  

  // Añade esta función para obtener el nombre de la compañía
// Añade esta función para obtener el nombre de la compañía
const getCompaniaNombre = (grupo) => {
  if (!grupo.coberturas || !Array.isArray(grupo.coberturas) || grupo.coberturas.length === 0) {
    return "-";
  }
  
  // Buscar la cobertura donde el parentesco sea "TOMADOR"
  const tomadorCobertura = grupo.coberturas.find(
    cobertura => cobertura.parentesco && 
    cobertura.parentesco.toUpperCase() === "TOMADOR" && 
    cobertura.compania
  );
  
  if (tomadorCobertura && tomadorCobertura.compania) {
    return tomadorCobertura.compania.nombre || "-";
  }
  
  // Si no hay tomador, usar la primera cobertura que tenga compañía
  const primeraCobertura = grupo.coberturas.find(
    cobertura => cobertura.compania
  );
  
  if (primeraCobertura && primeraCobertura.compania) {
    return primeraCobertura.compania.nombre || "-";
  }
  
  return "-";
};

  // Función para obtener el tomador (persona con parentesco TOMADOR)
  const getTomadorNombre = (grupo) => {
    if (!grupo.coberturas || grupo.coberturas.length === 0) {
      return "Sin asignar";
    }
    
    // Buscar la cobertura donde el parentesco sea "TOMADOR"
    const tomadorCobertura = grupo.coberturas.find(
      cobertura => cobertura.parentesco && 
      cobertura.parentesco.toUpperCase() === "TOMADOR" && 
      cobertura.cliente
    );
    
    if (tomadorCobertura && tomadorCobertura.cliente) {
      return tomadorCobertura.cliente.nombre_completo || 
             (tomadorCobertura.cliente.primer_nombre + " " + tomadorCobertura.cliente.apellidos) || 
             "Sin asignar";
    }
    
    // Si no hay tomador específico, devolvemos sin asignar
    return "Sin asignar";
  };
  
  // Filtrar grupos según la búsqueda
  const filteredGrupos = grupos.filter(grupo => {
    if (searchTerm === "") return true;
    
    // Buscar en persona de contacto
    const contacto = grupo.persona_contacto || "";
    const id = grupo.id ? grupo.id.toString() : "";
    const tomador = getTomadorNombre(grupo);
    
    // También buscar en los clientes de las coberturas
    const clientesMatch = grupo.coberturas && grupo.coberturas.some(cobertura => 
      cobertura.cliente && 
      cobertura.cliente.nombre_completo && 
      cobertura.cliente.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return contacto.toLowerCase().includes(searchTerm.toLowerCase()) || 
           id.includes(searchTerm) ||
           tomador.toLowerCase().includes(searchTerm.toLowerCase()) ||
           clientesMatch;
  });
  
  // Función para obtener el color de la insignia según el estado
  const getBadgeVariant = (estado) => {
    if (!estado) return "secondary";
    
    switch(estado.toLowerCase()) {
      case "activo":
        return "success";
      case "inactivo":
        return "danger";
      case "pendiente":
        return "warning";
      default:
        return "secondary";
    }
  };
  
  // Función para verificar si una cobertura es de un tomador
  const isTomador = (parentesco) => {
    return parentesco && parentesco.toUpperCase() === "TOMADOR";
  };
  
  return (
    <Container fluid className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">
          Lista de Grupos Familiares
        </h4>
        <Button 
          variant="primary" 
          onClick={() => navigate("/Grupofamiliar/crear")}
        >
          <FaUserPlus className="me-2" />
          Nuevo Grupo Familiar
        </Button>
      </div>
      
      <Card className="shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex flex-column flex-md-row gap-3 mb-4">
            <div className="flex-grow-1">
              <InputGroup>
                <Form.Control
                  placeholder="Buscar por ID, tomador o persona de contacto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button variant="outline-secondary">
                  <FaSearch />
                </Button>
              </InputGroup>
            </div>
            <div style={{ minWidth: "200px" }}>
              <Form.Select 
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="Todos los estados">Todos los estados</option>
                <option value="Activo">Activos</option>
                <option value="Inactivo">Inactivos</option>
                <option value="Pendiente">Pendientes</option>
              </Form.Select>
            </div>
            <div>
              <Button variant="outline-secondary">
                <FaFilter className="me-2" />
                Filtros
              </Button>
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="mt-3">Cargando grupos familiares...</p>
            </div>
          ) : (
            <>
              {filteredGrupos.length === 0 ? (
                <div className="text-center py-5">
                  <p className="text-muted mb-0">No se encontraron grupos familiares</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="align-middle">
                    <thead>
                      <tr>
                        <th>ID GF</th>
                        <th>TOMADOR</th>
                        <th>P. COBERTURA</th>
                        <th>P. TAXES</th>
                        <th>ASEGURADORA</th>
                        <th>RESPONSABLE</th>
                        <th>P. CONTACTO</th>
                        <th>ESTADO</th>
                        <th className="text-center">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGrupos.map((grupo) => (
                        <tr key={grupo.id}>
                          <td>{grupo.id || "Sin asignar"}</td>
                          <td>{getTomadorNombre(grupo)}</td>
                          <td>
                            <span className="badge rounded-circle bg-info text-white me-1">
                              {grupo.personas_cobertura || grupo.coberturas?.length || "0"}
                            </span>
                            <span className="text-muted">en cobertura</span>
                          </td>
                          <td>{grupo.personas_taxes || "-"}</td>
                          <td>{getCompaniaNombre(grupo)}</td>
                          <td>
                            <Badge 
                              pill 
                              bg="primary"
                            >
                              Sin responsable
                            </Badge>
                          </td>
                         
                          <td>{grupo.persona_contacto || "-"}</td>
                          <td>
                            <Badge 
                              pill 
                              bg={getGrupoEstado(grupo).variant}
                            >
                              {getGrupoEstado(grupo).estado}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex justify-content-center gap-2">
                              <Button 
                                variant="outline-primary" 
                                size="sm"
                                onClick={() => handleOpenViewModal(grupo)}
                                title="Ver detalles"
                              >
                                <FaEye />
                              </Button>
                              <Button 
                                variant="outline-success" 
                                size="sm"
                                onClick={() => handleOpenEditModal(grupo)}
                                title="Editar grupo familiar"
                              >
                                <FaEdit />
                              </Button>
                              <Button 
                                variant="outline-danger" 
                                size="sm"
                                onClick={() => handleDelete(grupo)}
                                title="Eliminar grupo familiar"
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
              )}
            </>
          )}
        </Card.Body>
      </Card>
      
      {/* Modal de Confirmación para Eliminar */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} backdrop="static" centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar eliminación</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>¿Está seguro que desea eliminar el grupo familiar {currentGrupo?.persona_contacto || `ID: ${currentGrupo?.id}`}?</p>
          <p className="text-danger mb-0">
            <strong>Advertencia:</strong> Esta acción eliminará también todas las coberturas y datos relacionados.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleteLoading}>
            {deleteLoading ? "Eliminando..." : "Eliminar"}
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Modal para Ver Detalles - Tamaño extra grande */}
      <Modal 
        show={showViewModal} 
        onHide={() => setShowViewModal(false)} 
        size="xl" 
        centered
        dialogClassName="modal-90w"
      >
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            <strong>Detalles del Grupo Familiar</strong>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4 py-4">
          {currentGrupo && (
            <div>
              <div className="mb-4">
                <h5 className="border-bottom pb-2 text-primary">Información General</h5>
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <p className="mb-1 text-muted">ID del Grupo:</p>
                    <h6><strong>{currentGrupo.id}</strong></h6>
                  </div>
                  <div className="col-md-4 mb-3">
                    <p className="mb-1 text-muted">Tomador:</p>
                    <h6><strong>{getTomadorNombre(currentGrupo)}</strong></h6>
                  </div>
                  <div className="col-md-4 mb-3">
                    <p className="mb-1 text-muted">Persona de Contacto:</p>
                    <h6><strong>{currentGrupo.persona_contacto || "Sin especificar"}</strong></h6>
                  </div>
                  <div className="col-md-4 mb-3">
                    <p className="mb-1 text-muted">Nota:</p>
                    <h6><strong>{currentGrupo.nota || "Sin especificar"}</strong></h6>
                  </div>
                  <div className="col-md-4 mb-3">
                    <p className="mb-1 text-muted">Personas en Cobertura:</p>
                    <h6>
                      <span className="badge bg-info text-white">
                        {currentGrupo.personas_cobertura || currentGrupo.coberturas?.length || "0"}
                      </span>
                    </h6>
                  </div>
                  <div className="col-md-4 mb-3">
                    <p className="mb-1 text-muted">Personas en taxes:</p>
                    <h6>
                      <span className="badge bg-info text-white">
                        {currentGrupo.personas_taxes || "0"}
                      </span>
                    </h6>
                  </div>
                  <div className="col-md-4 mb-3">
                    <p className="mb-1 text-muted">Ingreso Familiar Anual:</p>
                    <h6>
                        <strong>
                          {currentGrupo.ingreso_familiar_anual 
                            ? parseFloat(currentGrupo.ingreso_familiar_anual).toLocaleString('en-US', {
                                style: 'currency',
                                currency: 'USD',
                              })
                            : "No especificado"
                          }
                        </strong>
                      </h6>

                  </div>
                </div>
              </div>
              
              {/* Información de Contacto */}
              <div className="mb-4">
                <h5 className="border-bottom pb-2 text-primary">Información de Contacto</h5>
                <div className="row">
                  {currentGrupo.telefonos && (
                    <>
                      <div className="col-md-3 mb-3">
                        <p className="mb-1 text-muted">Teléfono 1:</p>
                        <h6><strong>{currentGrupo.telefonos.telefono_1 || "No especificado"}</strong></h6>
                      </div>
                      <div className="col-md-3 mb-3">
                        <p className="mb-1 text-muted">Teléfono 2:</p>
                        <h6><strong>{currentGrupo.telefonos.telefono_2 || "No especificado"}</strong></h6>
                      </div>
                      <div className="col-md-2 mb-3">
                        <p className="mb-1 text-muted">Whatsapp:</p>
                        <h6>
                          <Badge pill bg={currentGrupo.telefonos.whatsapp ? "success" : "secondary"}>
                            {currentGrupo.telefonos.whatsapp ? "Activo" : "Inactivo"}
                          </Badge>
                        </h6>
                        
                      </div>
                      <div className="col-md-2 mb-3">
                        <p className="mb-1 text-muted">Telegram:</p>
                        <h6>
                          <Badge pill bg={currentGrupo.telefonos.telegram ? "success" : "secondary"}>
                            {currentGrupo.telefonos.telegram ? "Activo" : "Inactivo"}
                          </Badge>
                        </h6>
                        
                      </div>
                      <div className="col-md-2 mb-3">
                        <p className="mb-1 text-muted">Mensaje sms:</p>
                        <h6>
                          <Badge pill bg={currentGrupo.telefonos.mensaje_sms ? "success" : "secondary"}>
                            {currentGrupo.telefonos.mensaje_sms ? "Activo" : "Inactivo"}
                          </Badge>
                        </h6>
                        
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Sección para mostrar las coberturas */}
              {currentGrupo.coberturas && currentGrupo.coberturas.length > 0 && (
                <div className="mb-4">
                  <h5 className="border-bottom pb-2 text-primary">Coberturas</h5>
                  <div className="table-responsive">
                    <Table bordered hover className="mt-3">
                      <thead className="table-light">
                        <tr>
                          <th>Código Póliza</th>
                          <th>Cliente</th>
                          <th>Parentesco</th>
                          <th>Elegibilidad</th>
                          <th>Compañia</th>
                          <th>Plan</th>
                          <th>Metal</th>
                          <th>Red</th>
                          <th>Pagador</th>
                          <th>Año Cobertura</th>
                          <th>Precio $</th>
                          <th>Fecha Activación</th>
                          <th>Fecha cancelación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentGrupo.coberturas.map((cobertura, index) => (
                          <tr 
                            key={cobertura.id || index}
                            // Aplicamos fondo amarillo para tomadores
                            style={isTomador(cobertura.parentesco) ? {backgroundColor: '#fff3cd'} : {}}
                          >
                            <td>{cobertura.codigo_poliza || "-"}</td>
                            <td>
                              <strong>{cobertura.cliente?.nombre_completo || "-"}</strong>
                              {isTomador(cobertura.parentesco) && (
                                <Badge bg="warning" text="dark" className="ms-2">TOMADOR</Badge>
                              )}
                            </td>
                            <td>{cobertura.parentesco || "-"}</td>
                            <td>{cobertura.elegibilidad || "-"}</td>
                            <td>{cobertura.compania.nombre || "-"}</td>
                            <td>{cobertura.plan || "-"}</td>
                            <td>{cobertura.metal || "-"}</td>
                            <td>{cobertura.red || "-"}</td>
                            <td>{cobertura.nombre_pagador || "-"}</td>
                            <td>{cobertura.ano_cobertura || "-"}</td>
                            <td>{cobertura.precio || "-"}</td>
                            <td>
                              {cobertura.fecha_activacion 
                                ? new Date(cobertura.fecha_activacion).toLocaleDateString() 
                                : "-"
                              }
                            </td>
                            <td>
                              {cobertura.fecha_activacion 
                                ? new Date(cobertura.fecha_cancelacion).toLocaleDateString() 
                                : "-"
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}
              
              <div className="d-flex justify-content-between mt-4">
              <Button 
                      variant="outline-primary" 
                      onClick={() => {
                        setShowViewModal(false);
                        window.open(`/grupo-familiar/${currentGrupo.id}/reporte`, '_blank');
                      }}
                    >
                      <FaFileExport className="me-2" />
                      Ver Detalles Completos
                    </Button>


                {/* <Button 
                  variant="outline-success" 
                  onClick={() => {
                    setShowViewModal(false);
                    navigate(`/grupo-familiar/${currentGrupo.id}/editar`);
                  }}
                >
                  <FaEdit className="me-2" />
                  Editar Grupo Familiar
                </Button> */}
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
};

// Agregamos estilos CSS personalizados para el modal más amplio
const styles = `
  .modal-90w {
    max-width: 90%;
    width: 90%;
  }
`;

// Agrega los estilos al documento
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default GruposFamiliaresListado;