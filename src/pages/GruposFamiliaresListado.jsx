import React, { useState, useEffect } from "react";
import {
  Container, Card, Table, Badge, Button,
  Form, InputGroup, Dropdown, Modal
} from "react-bootstrap";
import {
  FaSearch, FaEdit, FaEye, FaTrashAlt, FaUserPlus, FaCog,
  FaFilter, FaSortAmountDown, FaSortAmountUp, FaFile, FaFileExport
} from "react-icons/fa";
import "../styles/GruposFamiliaresListado.css"
import { useNavigate } from "react-router-dom";
import apiRequest from "../services/api";
import GrupoFamiliarDetalleModal from "../components/GrupoFamiliarDetalleModal";
import RequerimientosModal from "../components/RequerimientosModal"; // Importar el modal
import RetiroCancelacionModal from "../components/RetiroCancelacionModal";




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

  const handleOpenRetiroModal = (grupo) => {
    setGrupoParaRetiro(grupo);
    setShowRetiroModal(true);
  };

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
                              <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={() => {
                                      // Aquí pasamos solo el ID del grupo familiar
                                      setGrupoFamiliarId(grupo.id); // Establecer el ID del grupo familiar
                                      setShowDocumentosModal(true); // Mostrar el modal
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