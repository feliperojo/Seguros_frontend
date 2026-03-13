import React, { useState, useEffect } from "react";
import {
  Container, Card, Table, Badge, Button,
  Form, InputGroup, Dropdown, Modal
} from "react-bootstrap";
import {
  FaSearch, FaEdit, FaEye, FaTrashAlt, FaCog,
  FaFilter, FaSortAmountDown, FaSortAmountUp, FaFile, FaFileExport
} from "react-icons/fa";
import "../styles/GruposFamiliaresListado.css"
import { Link, useNavigate, useLocation } from "react-router-dom";
import apiRequest from "../services/api";
import GrupoFamiliarDetalleModal from "../components/GrupoFamiliarDetalleModal";
import RequerimientosModal from "../components/RequerimientosModal"; // Importar el modal
import RetiroCancelacionModal from "../components/RetiroCancelacionModal";
import ResumenGruposEstados from "../components/ResumenGruposEstados";
import { Helmet } from "react-helmet-async";




const GruposFamiliaresListado = () => {
  const navigate = useNavigate();


  // Estados
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos los estados");
  const [showRetiroModal, setShowRetiroModal] = useState(false);
  const [grupoParaRetiro, setGrupoParaRetiro] = useState(null);
 const [showModal, setShowModal] = useState(false);
 const [showDocumentosModal, setShowDocumentosModal] = useState(false);
const [coberturaId, setCoberturaId] = useState(null);
const [grupoFamiliarId, setGrupoFamiliarId] = useState(null); // Agregar el estado


  // Estados para modales
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentGrupo, setCurrentGrupo] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [mostrarInactivas, setMostrarInactivas] = useState(false);
  const location = useLocation();

  // Función para manejar el clic desde el componente de resumen
  const handleEstadoClickFromResumen = (codigoEstado) => {
    // Si se hace clic en "Todos los estados", resetear el filtro
    if (codigoEstado === "Todos los estados") {
      setSelectedStatus("Todos los estados");
    } else {
      // El código del estado ya viene en minúsculas (ej: "cotizacion", "toma_datos")
      // que es exactamente lo que el endpoint espera
      setSelectedStatus(codigoEstado);
    }
  };

  const handleOpenRetiroModal = (grupo) => {
    setGrupoParaRetiro(grupo);
    setShowRetiroModal(true);
  };

useEffect(() => {
  const params = new URLSearchParams(location.search);
  const searchParam = params.get("search");
  if (searchParam) {
    setSearchTerm(searchParam);
  }
}, [location.search]);

  // Cargar grupos al montar el componente o cuando cambia el estado seleccionado
  useEffect(() => {
    fetchGrupos();
  }, [selectedStatus]);

  // Función para mapear el código del estado al formato que espera el endpoint
  const mapearEstadoParaEndpoint = (codigoEstado) => {
    // Mapeo de códigos en minúsculas a códigos en mayúsculas que espera el API
    const estadoMap = {
      "prospecto": "PROSPECTO",
      "cotizacion": "COTIZACION",
      "seguimiento": "SEGUIMIENTO",
      "toma_datos": "TOMA_DATOS",
      "inscripcion_ini": "INSCRIPCION_INI",
      "grupo_familiar": "GRUPO_FAMILIAR",
      "descartado": "DESCARTADO"
    };
    
    // Si el código ya está en mayúsculas, devolverlo tal cual
    if (codigoEstado === codigoEstado.toUpperCase()) {
      return codigoEstado;
    }
    
    // Convertir a mayúsculas y buscar en el mapa
    const codigoLower = codigoEstado.toLowerCase();
    return estadoMap[codigoLower] || codigoEstado.toUpperCase();
  };

  // Función para cargar grupos
  const fetchGrupos = async () => {
    setLoading(true);
    try {
      // Endpoint para grupos familiares con coberturas y clientes
      let endpoint = "grupo_familiar/grupos-familiares-full";
      // Añadir parámetros de filtro por estado si es necesario
      if (selectedStatus !== "Todos los estados") {
        // Mapear el estado al formato correcto (mayúsculas)
        const estadoParam = mapearEstadoParaEndpoint(selectedStatus);
        endpoint += `?estado=${estadoParam}`;
      }
      
      console.log("🔍 [GruposFamiliaresListado] Estado seleccionado:", selectedStatus);
      console.log("🔍 [GruposFamiliaresListado] Estado mapeado para endpoint:", selectedStatus !== "Todos los estados" ? mapearEstadoParaEndpoint(selectedStatus) : "N/A");
      console.log("🔍 [GruposFamiliaresListado] Endpoint a llamar:", endpoint);
      
      const response = await apiRequest(endpoint, "GET");
      
      console.log("📦 [GruposFamiliaresListado] Respuesta completa del API:", response);
      console.log("📦 [GruposFamiliaresListado] Tipo de respuesta:", typeof response);
      console.log("📦 [GruposFamiliaresListado] response.status:", response?.status);
      console.log("📦 [GruposFamiliaresListado] response.data:", response?.data);
      console.log("📦 [GruposFamiliaresListado] Es array?", Array.isArray(response?.data));
      console.log("📦 [GruposFamiliaresListado] Cantidad de grupos:", response?.data?.length);

      if (response && response.status === "success" && Array.isArray(response.data)) {
        console.log("✅ [GruposFamiliaresListado] Grupos cargados correctamente:", response.data);
        console.log("✅ [GruposFamiliaresListado] Primer grupo (ejemplo):", response.data[0]);
        
        // Si hay un filtro aplicado, verificar que los grupos coincidan
        if (selectedStatus !== "Todos los estados") {
          const estadoEsperado = mapearEstadoParaEndpoint(selectedStatus);
          const gruposFiltrados = response.data.filter(grupo => {
            const estadoGrupo = grupo.estado_codigo || grupo.estado?.toUpperCase();
            return estadoGrupo === estadoEsperado;
          });
          console.log("🔍 [GruposFamiliaresListado] Grupos filtrados por estado:", gruposFiltrados.length);
          console.log("🔍 [GruposFamiliaresListado] Estados encontrados en grupos:", response.data.map(g => ({ id: g.id, estado: g.estado, estado_codigo: g.estado_codigo })));
        }
        
        setGrupos(response.data);
      } else {
        console.error("❌ [GruposFamiliaresListado] Respuesta inesperada:", response);
        setGrupos([]);
      }
    } catch (error) {
      console.error("❌ [GruposFamiliaresListado] Error al cargar grupos familiares:", error);
      // Mostrar alerta al usuario
      alert("Error al cargar los grupos familiares. Por favor, intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };


  // Añade esta función después de getCompaniaNombre o getTomadorNombre
  // const getGrupoEstado = (grupo) => {
  //   if (!grupo.coberturas || grupo.coberturas.length === 0) {
  //     return { estado: "Sin póliza", variant: "secondary" };
  //   }

  //   // Verificar si todas las coberturas tienen fecha de cancelación
  //   const todasCanceladas = grupo.coberturas.every(cobertura => !!cobertura.fecha_cancelacion);

  //   if (todasCanceladas) {
  //     return { estado: "Cancelada", variant: "danger" };
  //   }

  //   // Si al menos una no está cancelada
  //   return { estado: "Activa", variant: "success" };
  // };
  const getGrupoEstado = (grupo) => {
    // Extract the estado (state) and estado_codigo from the response
    const estado = grupo.estado || "Sin estado";  // Default to "Sin estado" if no estado is found
  
    // Define the badge color based on the estado value
    const variant = estado === "Cotización" ? "warning" :
                    estado === "Activo" ? "success" :
                    estado === "Inactivo" ? "danger" : "secondary";
  
    return { estado, variant };
  };
  

  // Funciones para manejar acciones
  const handleOpenViewModal = async (grupo) => {
    try {
      const response = await apiRequest(`grupo_familiar/grupos-familiares-full/${grupo.id}`, "GET");
      if (response && response.status === "success") {
        setCurrentGrupo(response.data); // 🔹 Aquí llega el detalle completo
        setShowViewModal(true);
      } else {
        console.error("Error al cargar detalle:", response);
        alert("No se pudo cargar la información del grupo familiar.");
      }
    } catch (error) {
      console.error("Error al obtener detalle:", error);
      alert("Error al cargar detalle del grupo familiar.");
    }
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

  // Filtrar grupos según la búsqueda y el estado seleccionado
  const filteredGrupos = grupos.filter(grupo => {
    // Primero filtrar por estado si hay uno seleccionado
    if (selectedStatus !== "Todos los estados") {
      const estadoEsperado = mapearEstadoParaEndpoint(selectedStatus);
      const estadoGrupo = grupo.estado_codigo || grupo.estado?.toUpperCase() || "";
      
      // Si el estado del grupo no coincide, excluirlo
      if (estadoGrupo !== estadoEsperado) {
        return false;
      }
    }

    // Luego filtrar por búsqueda si hay término de búsqueda
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

    switch (estado.toLowerCase()) {
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
       <Helmet>
              <title>Vantun/List Grupo Familiar</title>
            </Helmet>
      
      {/* Título y descripción */}
      <div className="mb-4">
        <h3 className="mb-2 fw-bold text-dark">Grupos Familiares</h3>
        <p className="text-muted mb-0" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
          Gestión y administración de grupos familiares asegurados en su cartera de seguros de vida.
        </p>
      </div>

      {/* Barra de resumen de estados */}
      <ResumenGruposEstados 
        onEstadoClick={handleEstadoClickFromResumen}
        estadoSeleccionado={selectedStatus}
      />

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
                <option value="prospecto">Prospecto</option>
                <option value="cotizacion">Cotización</option>
                <option value="seguimiento">Seguimiento</option>
                <option value="toma_datos">Toma de Datos</option>
                <option value="inscripcion_ini">Inscripción Inicial</option>
                <option value="grupo_familiar">Grupo Familiar</option>
                <option value="descartado">Descartado</option>
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
                        <th>ESTADO</th>
                        <th className="text-center">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGrupos.map((grupo) => (
                        <tr key={grupo.id}>
                  <td>
                          {grupo.id ? (
                            <Link
                              to={`/grupo_familiar/${grupo.id}`}
                              className="text-decoration-none"
                              title="Ver detalle del grupo"
                            >
                              {grupo.id}
                            </Link>
                          ) : (
                            "Sin asignar"
                          )}
                        </td>
                          <td>{getTomadorNombre(grupo)}</td>
                          <td>
                            <span className="badge rounded-circle bg-info text-white me-1">
                              {grupo.personas_cobertura || "0"}
                            </span>
                            <span className="text-muted">en cobertura</span>
                          </td>
                          <td>{grupo.personas_taxes || "0"}</td>
                          <td>{getCompaniaNombre(grupo)}</td>
                          <td>
                            <Badge
                              pill
                              bg="primary"
                            >
                              {grupo.responsable || "Sin responsable"}
                            </Badge>
                          </td>
                          <td>
                                  {grupo.id ? (
                                    <Badge
                                      as={Link}
                                      to={`/grupo_familiar/${grupo.id}`}     // mismo destino que el ID
                                      bg={getGrupoEstado(grupo).variant}
                                      pill
                                      className="text-decoration-none"
                                      title="Ver detalle del grupo"
                                      onClick={(e) => e.stopPropagation()}   // por si el <tr> fuese clickable
                                      style={{ cursor: "pointer" }}
                                    >
                                      {getGrupoEstado(grupo).estado}
                                    </Badge>
                                  ) : (
                                    <Badge pill bg={getGrupoEstado(grupo).variant}>
                                      {getGrupoEstado(grupo).estado}
                                    </Badge>
                                  )}
                                </td>

                          <td>
                            <div className="d-flex justify-content-center gap-2">
                              {false && (
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleOpenViewModal(grupo)}
                                  title="Ver detalles"
                                >
                                  <FaEye />
                                </Button>
                              )}
                              {false && (
                                <Button
                                  variant="outline-success"
                                  size="sm"
                                  onClick={() => handleOpenEditModal(grupo)}
                                  title="Editar grupo familiar"
                                >
                                  <FaEdit />
                                </Button>
                              )}
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDelete(grupo)}
                                title="Eliminar grupo familiar"
                              >
                                <FaTrashAlt />
                              </Button>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => {
                                  setGrupoFamiliarId(grupo.id);
                                  setShowDocumentosModal(true);
                                }}
                              >
                                <FaFile />
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

      <GrupoFamiliarDetalleModal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        grupo={currentGrupo}
        getTomadorNombre={getTomadorNombre}
      />

      <RetiroCancelacionModal
        show={showRetiroModal}
        onHide={() => setShowRetiroModal(false)}
        grupoFamiliar={grupoParaRetiro}
        onSave={(updatedGrupo) => {
          fetchGrupos();
          // Actualizar el grupo en la lista
          setGrupos(prev =>
            prev.map(g => g.id === updatedGrupo.id ? updatedGrupo : g)
          );
          setShowRetiroModal(false);
        }}
      />
      <RequerimientosModal
        show={showDocumentosModal}
        onHide={() => setShowDocumentosModal(false)}
        grupoFamiliarId={grupoFamiliarId} // Pasar el ID del grupo familiar
      />



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
