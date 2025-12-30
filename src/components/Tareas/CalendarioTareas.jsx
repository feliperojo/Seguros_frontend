import React, { useState } from "react";
import { Card, Badge, Button, Toast, ToastContainer, Modal, ListGroup, Tooltip, OverlayTrigger } from "react-bootstrap";
import { FaPlus, FaChartBar, FaChevronLeft, FaChevronRight, FaCalendarAlt, FaUser, FaCalendarCheck, FaTasks } from "react-icons/fa";
import apiRequest from "../../services/api";
import NuevaTareaModal from "../Tareas/NuevaTareaModal";
import ResponderTareaModal from "../Tareas/ResponderTareaModal";
import ResumenTareasModal from "../Tareas/ResumenTareasModal";
import { useHasPermission } from "../../hooks/useHasPermission";

const CalendarioTareas = ({ tareas: tareasIniciales, currentUser }) => {

  const hoy = new Date();
  const [mesActual, setMesActual] = useState(hoy.getMonth());
  const [añoActual, setAñoActual] = useState(hoy.getFullYear());

  const [tareas, setTareas] = useState(Array.isArray(tareasIniciales) ? tareasIniciales : []);
  const [showNuevaModal, setShowNuevaModal] = useState(false);
  const [showResponderModal, setShowResponderModal] = useState(false);
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null);
  const [showResumen, setShowResumen] = useState(false);
  const [fechaResumen, setFechaResumen] = useState(new Date());

  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [tareasDetalle, setTareasDetalle] = useState([]);

  const [toast, setToast] = useState({ show: false, message: "", variant: "success" });

  const diasSemana = ["L", "M", "X", "J", "V", "S", "D"];
  const diasEnMes = new Date(añoActual, mesActual + 1, 0).getDate();
  const primerDiaSemana = new Date(añoActual, mesActual, 1).getDay();
  const offsetInicio = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(currentUser?.id || null);

  const [usuarios, setUsuarios] = useState([]); // Lista de usuarios

  // Verificar permiso para ver usuarios
  const canViewUsers = useHasPermission("users.view");


  const nombreMes = new Date(añoActual, mesActual).toLocaleString("es-ES", {
    month: "long",
    year: "numeric",
  });

  const abrirResponderTarea = (tarea) => {
    if (!tarea) return;
    setTareaSeleccionada(tarea);
    setShowResponderModal(true);
  };

  const abrirDetalleDia = (lista) => {
    if (!Array.isArray(lista)) return;
    setTareasDetalle(lista);
    setShowDetalleModal(true);
  };

  const onCreated = (nuevaTarea) => {
    if (!nuevaTarea) return;
    setTareas((prev) => {
      const prevArray = Array.isArray(prev) ? prev : [];
      return [...prevArray, nuevaTarea];
    });
    setToast({ show: true, message: "✅ Nueva tarea agregada", variant: "success" });
  };

  const onUpdated = (tareaActualizada) => {
    if (!tareaActualizada || !tareaActualizada.id) return;
    setTareas((prev) => {
      const prevArray = Array.isArray(prev) ? prev : [];
      return prevArray.map((t) => (t && t.id === tareaActualizada.id ? tareaActualizada : t));
    });
    setToast({ show: true, message: "✅ Tarea actualizada", variant: "info" });
  };

  const obtenerTodasTareasDelDia = (dia) => {
    if (!Array.isArray(tareas)) return [];
    return tareas.filter((t) => {
      if (!t) return false;
      const fecha = t.scheduled_date ? new Date(`${t.scheduled_date}T00:00:00`) : new Date(t.created_at);
      return fecha.getDate() === dia && fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
    });
  };

  React.useEffect(() => {
    const fetchUsuarios = async () => {
      // Si no tiene permiso para ver usuarios, solo usar el usuario actual
      if (!canViewUsers) {
        if (currentUser?.id) {
          setUsuarios([currentUser]);
          setUsuarioSeleccionado(currentUser.id);
        }
        return;
      }

      try {
        // Usar el endpoint con per_page alto para obtener todos los usuarios
        const response = await apiRequest("/v1/users?per_page=1000", "GET");
        
        // Manejar diferentes estructuras de respuesta (similar a UsersList.jsx)
        let usuariosData = [];
        
        if (response && response.data) {
          if (response.data.data && Array.isArray(response.data.data)) {
            // Estructura anidada: { data: { data: [...], pagination: {...} } }
            usuariosData = response.data.data;
          } else if (Array.isArray(response.data)) {
            // Estructura simple: { data: [...] }
            usuariosData = response.data;
          } else {
            // Intentar encontrar un array en response.data
            const possibleArrays = Object.values(response.data).filter(Array.isArray);
            if (possibleArrays.length > 0) {
              usuariosData = possibleArrays[0];
            }
          }
        } else if (Array.isArray(response)) {
          // Si la respuesta es directamente un array
          usuariosData = response;
        } else if (response && response.users) {
          // Si la respuesta tiene estructura { users: [...] }
          usuariosData = Array.isArray(response.users) ? response.users : [];
        } else if (response && typeof response === 'object') {
          // Buscar cualquier array en la respuesta
          const possibleArrays = Object.values(response).filter(Array.isArray);
          if (possibleArrays.length > 0) {
            usuariosData = possibleArrays[0];
          }
        }
        
        // Asegurar que siempre sea un array
        if (!Array.isArray(usuariosData)) {
          console.warn("⚠️ La respuesta de usuarios no es un array:", response);
          usuariosData = [];
        }
        
        if (usuariosData.length > 0) {
          setUsuarios(usuariosData);
          const usuarioDefault = currentUser?.id ? usuariosData.find(u => u.id === currentUser?.id) : null;
          if (!usuarioSeleccionado) {
            setUsuarioSeleccionado(usuarioDefault ? usuarioDefault.id : (usuariosData[0]?.id || null));
          }
          
          // Log para debugging en desarrollo
          if (import.meta.env.DEV) {
            console.log("✅ Usuarios cargados en calendario:", {
              total: usuariosData.length,
              usuarios: usuariosData.map(u => ({ id: u.id, name: u.name }))
            });
          }
        } else {
          // Si no hay usuarios, usar solo el usuario actual
          if (currentUser?.id) {
            setUsuarios([currentUser]);
            setUsuarioSeleccionado(currentUser.id);
          }
        }
      } catch (error) {
        console.error("Error cargando usuarios:", error);
        // Si falla la carga, usar solo el usuario actual
        if (currentUser?.id) {
          setUsuarios([currentUser]);
          setUsuarioSeleccionado(currentUser.id);
        }
        // Solo mostrar toast si tenía permisos (error real)
        if (canViewUsers) {
          setToast({
            show: true,
            message: "Error al cargar la lista de usuarios",
            variant: "warning",
          });
        }
      }
    };
  
    fetchUsuarios();
  }, [currentUser, canViewUsers]);
  
  React.useEffect(() => {
    const fetchTareasPorUsuario = async () => {
      try {
        if (!usuarioSeleccionado) return;
  
        const response = await apiRequest(`tareas_operativas?assigned_user_id=${usuarioSeleccionado}&per_page=100`, "GET");
      
        if (response && Array.isArray(response.data)) {
          setTareas(response.data);
        } else {
          setTareas([]);
        }
        
      } catch (error) {
        console.error("Error al cargar tareas por usuario:", error);
        setToast({
          show: true,
          message: "Error al cargar tareas del usuario",
          variant: "danger",
        });
      }
    };
  
    fetchTareasPorUsuario();
  }, [usuarioSeleccionado]);
  
  

  // Agrupar tareas por día según scheduled_date
  const tareasPorDia = {};
  if (Array.isArray(tareas)) {
    tareas
      .filter((t) => t && t.status !== "completed")
      .forEach((t) => {
        const fecha = t.scheduled_date ? new Date(`${t.scheduled_date}T00:00:00`) : new Date(t.created_at);
        if (fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual) {
          const dia = fecha.getDate();
          if (!tareasPorDia[dia]) tareasPorDia[dia] = [];
          tareasPorDia[dia].push(t);
        }
      });
  }
  


  const cambiarMes = (incremento) => {
    let nuevoMes = mesActual + incremento;
    let nuevoAño = añoActual;
    if (nuevoMes < 0) {
      nuevoMes = 11;
      nuevoAño -= 1;
    } else if (nuevoMes > 11) {
      nuevoMes = 0;
      nuevoAño += 1;
    }
    setMesActual(nuevoMes);
    setAñoActual(nuevoAño);
  };

  const irAHoy = () => {
    const hoy = new Date();
    setMesActual(hoy.getMonth());
    setAñoActual(hoy.getFullYear());
  };

  const esMesActual = () => {
    const hoy = new Date();
    return mesActual === hoy.getMonth() && añoActual === hoy.getFullYear();
  };

  const onDragStart = (e, tarea) => {
    if (!tarea || tarea.status === "completed") {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("tareaId", tarea.id);
  };

  const onDrop = async (e, dia) => {
    e.preventDefault();
    const tareaId = e.dataTransfer.getData("tareaId");
    if (!tareaId || !Array.isArray(tareas)) return;

    const nuevaFecha = new Date(añoActual, mesActual, dia).toISOString().split("T")[0];

    const tarea = tareas.find((t) => t && t.id === parseInt(tareaId));
    if (!tarea) return;

    let newDueDate = tarea.due_date || nuevaFecha;
    if (tarea.due_date && new Date(nuevaFecha) > new Date(tarea.due_date)) {
      newDueDate = nuevaFecha;
    }

    try {
      await apiRequest(`tareas_operativas/${tareaId}/reprogramar`, "PUT", {
        scheduled_date: nuevaFecha,
        due_date: newDueDate,
      });

      setTareas((prev) =>
        prev.map((t) =>
          t.id === tarea.id
            ? { ...t, scheduled_date: nuevaFecha, due_date: newDueDate }
            : t
        )
      );

      setToast({
        show: true,
        message: `✅ Tarea movida al ${nuevaFecha}`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error reprogramando tarea:", error);
      setToast({
        show: true,
        message: "Error al reprogramar la tarea",
        variant: "danger",
      });
    }
  };

  const onDragOver = (e) => e.preventDefault();

  const celdas = [];
  for (let i = 0; i < offsetInicio; i++) {
    celdas.push(null);
  }
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push(d);
  }

  return (
    <div className="calendario-tareas-container">
      <style>{`
        .calendar-day-card {
          user-select: none;
        }
        .calendar-day-card:hover {
          z-index: 10;
        }
        .calendar-day-card .badge {
          word-break: break-word;
          white-space: normal;
          line-height: 1.3;
        }
        @media (max-width: 768px) {
          .calendar-day-card {
            min-height: 100px !important;
          }
        }
      `}</style>
      {/* Header mejorado */}
      <Card className="mb-4 shadow-sm border-0">
        <Card.Body className="p-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            {/* Sección izquierda: Botones de acción */}
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowNuevaModal(true)}
                className="d-flex align-items-center gap-2"
              >
                <FaPlus /> Nueva Tarea
              </Button>

              {canViewUsers && (
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={() => {
                    setFechaResumen(new Date());
                    setShowResumen(true);
                  }}
                  className="d-flex align-items-center gap-2"
                >
                  <FaChartBar /> Resumen Diario
                </Button>
              )}
            </div>

            {/* Sección central: Navegación del calendario */}
            <div className="d-flex flex-column align-items-center flex-grow-1" style={{ minWidth: "200px" }}>
              <div className="d-flex align-items-center gap-3 mb-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => cambiarMes(-1)}
                  className="d-flex align-items-center justify-content-center"
                  style={{ width: "38px", height: "38px" }}
                >
                  <FaChevronLeft />
                </Button>
                
                <div className="text-center">
                  <h4 className="mb-0 text-capitalize fw-bold text-primary">
                    <FaCalendarAlt className="me-2" />
                    {nombreMes}
                  </h4>
                  {!esMesActual() && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={irAHoy}
                      className="p-0 text-decoration-none"
                      style={{ fontSize: "0.75rem" }}
                    >
                      Ir a hoy
                    </Button>
                  )}
                </div>

                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => cambiarMes(1)}
                  className="d-flex align-items-center justify-content-center"
                  style={{ width: "38px", height: "38px" }}
                >
                  <FaChevronRight />
                </Button>
              </div>

              {/* Selector de usuario mejorado */}
              <div className="d-flex align-items-center gap-2" style={{ width: "100%", maxWidth: "280px" }}>
                <FaUser className="text-muted" />
                <select
                  className="form-select form-select-sm"
                  value={usuarioSeleccionado || ""}
                  onChange={(e) => setUsuarioSeleccionado(parseInt(e.target.value))}
                  disabled={!canViewUsers}
                  style={{ flex: 1 }}
                >
                  {usuarios.length > 0 ? (
                    usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Cargando usuarios...</option>
                  )}
                </select>
              </div>
            </div>

            {/* Sección derecha: Estadísticas rápidas */}
            <div className="d-flex flex-column align-items-end gap-1">
              <div className="d-flex align-items-center gap-2">
                <FaTasks className="text-primary" />
                <span className="text-muted small">
                  {tareas.filter(t => t && t.status !== "completed").length} tareas activas
                </span>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>


      

      {/* Días de la semana mejorados */}
      <div className="d-grid mb-3 fw-bold text-center text-muted" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" }}>
        {diasSemana.map((d, idx) => (
          <div key={idx} className="p-2" style={{ fontSize: "0.9rem" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Celdas del calendario mejoradas */}
      <div className="d-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: "10px" }}>
        {celdas.map((dia, index) => {
          if (dia === null) return <div key={index}></div>;

          const tareasDia = tareasPorDia[dia] || [];
          const todasLasTareas = obtenerTodasTareasDelDia(dia);
          const esHoy = dia === hoy.getDate() && mesActual === hoy.getMonth() && añoActual === hoy.getFullYear();
          const esPasado = new Date(añoActual, mesActual, dia) < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
          const tieneTareas = tareasDia.length > 0;

          return (
            <Card
              key={dia}
              onDrop={(e) => onDrop(e, dia)}
              onDragOver={onDragOver}
              onClick={(e) => {
                if (e.target.tagName !== "SPAN" && e.target.tagName !== "SMALL") {
                  if (todasLasTareas.length > 0) {
                    abrirDetalleDia(todasLasTareas);
                  }
                }
              }}
              className="calendar-day-card p-2 text-center position-relative"
              style={{
                minHeight: "140px",
                borderRadius: "12px",
                border: esHoy 
                  ? "2px solid #0d6efd" 
                  : tieneTareas 
                    ? "1px solid #0d6efd" 
                    : "1px solid #e0e0e0",
                backgroundColor: esHoy 
                  ? "#e7f3ff" 
                  : esPasado 
                    ? "#f8f9fa" 
                    : "#fff",
                cursor: todasLasTareas.length > 0 ? "pointer" : "default",
                transition: "all 0.2s ease-in-out",
                boxShadow: esHoy 
                  ? "0 2px 8px rgba(13, 110, 253, 0.15)" 
                  : tieneTareas 
                    ? "0 1px 4px rgba(13, 110, 253, 0.1)" 
                    : "none",
              }}
              onMouseEnter={(e) => {
                if (todasLasTareas.length > 0) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(13, 110, 253, 0.2)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = esHoy 
                  ? "0 2px 8px rgba(13, 110, 253, 0.15)" 
                  : tieneTareas 
                    ? "0 1px 4px rgba(13, 110, 253, 0.1)" 
                    : "none";
              }}
            >
              {/* Indicador de día */}
              <div className="d-flex justify-content-between align-items-start mb-2">
                <strong 
                  className={esHoy ? "text-primary" : esPasado ? "text-muted" : ""}
                  style={{ fontSize: "1.1rem" }}
                >
                  {dia}
                </strong>
                {tieneTareas && (
                  <Badge 
                    bg="primary" 
                    pill 
                    style={{ fontSize: "0.65rem", minWidth: "20px" }}
                  >
                    {tareasDia.length}
                  </Badge>
                )}
              </div>

              {/* Lista de tareas */}
              <div className="mt-2" style={{ minHeight: "80px" }}>
                {tareasDia.length > 0 ? (
                  <>
                    {tareasDia.slice(0, 4).map((t) => {
                      if (!t) return null;
                      const clienteNombre = t.log?.cliente?.nombre_completo || "Sin Cliente";
                      const tooltipText = `${clienteNombre} - ${getStatusLabel(t?.status)}`;
                      
                      return (
                        <OverlayTrigger
                          key={t.id}
                          placement="top"
                          overlay={<Tooltip>{tooltipText}</Tooltip>}
                        >
                          <Badge
                            bg={getBadgeColor(t?.status)}
                            className="d-block mb-1 text-truncate"
                            style={{ 
                              fontSize: "0.7rem", 
                              cursor: "pointer",
                              maxWidth: "100%",
                              transition: "all 0.2s ease"
                            }}
                            draggable={t?.status !== "completed"}
                            onDragStart={(e) => onDragStart(e, t)}
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirResponderTarea(t);
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.05)";
                              e.currentTarget.style.opacity = "0.9";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.opacity = "1";
                            }}
                          >
                            {clienteNombre}
                          </Badge>
                        </OverlayTrigger>
                      );
                    })}
                    {tareasDia.length > 4 && (
                      <small
                        className="text-primary fw-bold d-block mt-1"
                        style={{ 
                          cursor: "pointer", 
                          fontSize: "0.75rem",
                          textDecoration: "underline"
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirDetalleDia(tareasDia);
                        }}
                      >
                        +{tareasDia.length - 4} más
                      </small>
                    )}
                  </>
                ) : (
                  <div className="text-muted" style={{ fontSize: "0.75rem", paddingTop: "20px" }}>
                    <FaCalendarCheck className="opacity-50" />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Toast */}
      <ToastContainer position="bottom-end" className="p-3">
        <Toast bg={toast.variant} show={toast.show} onClose={() => setToast({ ...toast, show: false })} delay={3000} autohide>
          <Toast.Body className="text-white">{toast.message}</Toast.Body>
        </Toast>
      </ToastContainer>

      {/* Modal Detalle mejorado */}
      <Modal 
        show={showDetalleModal} 
        onHide={() => setShowDetalleModal(false)} 
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title className="d-flex align-items-center gap-2">
            <FaCalendarAlt />
            Tareas del día
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {Array.isArray(tareasDetalle) && tareasDetalle.length > 0 ? (
            <ListGroup variant="flush">
              {tareasDetalle.map((t) => {
                if (!t) return null;
                return (
                  <ListGroup.Item
                    key={t.id}
                    className="d-flex justify-content-between align-items-center p-3 border-bottom"
                    style={{ 
                      transition: "background-color 0.2s ease",
                      cursor: "pointer"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8f9fa";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                    onClick={() => {
                      abrirResponderTarea(t);
                      setShowDetalleModal(false);
                    }}
                  >
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <Badge bg={getBadgeColor(t?.status)} className="px-2 py-1">
                          {getStatusLabel(t?.status)}
                        </Badge>
                        <span className="fw-bold text-dark">
                          {t.log?.concept?.name || "Tarea"}
                        </span>
                      </div>
                      <div className="text-muted d-flex align-items-center gap-1" style={{ fontSize: "0.9rem" }}>
                        <FaUser className="opacity-50" style={{ fontSize: "0.75rem" }} />
                        {t.log?.cliente?.nombre_completo || "Sin Cliente"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      className="ms-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirResponderTarea(t);
                        setShowDetalleModal(false);
                      }}
                    >
                      Ver / Responder
                    </Button>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          ) : (
            <div className="text-center py-5">
              <FaCalendarCheck className="text-muted mb-3" style={{ fontSize: "3rem", opacity: 0.3 }} />
              <p className="text-muted mb-0">No hay tareas para este día</p>
            </div>
          )}
        </Modal.Body>
      </Modal>


      {/* Modales */}
      {showResponderModal && tareaSeleccionada && (
  <ResponderTareaModal
    show={showResponderModal}
    onHide={() => setShowResponderModal(false)}
    tarea={tareaSeleccionada}
    onUpdated={(tareaActualizada) => {
      onUpdated(tareaActualizada); // ✅ Actualiza en el estado
      setShowResponderModal(false); // ✅ Cierra modal después
    }}
  />
)}

{showNuevaModal && (
  <NuevaTareaModal
    show={showNuevaModal}
    onHide={() => setShowNuevaModal(false)}
    onCreated={(nuevaTarea) => {
      onCreated(nuevaTarea); // ✅ Agrega la nueva tarea al estado
      setShowNuevaModal(false); // ✅ Cierra modal después
    }}
  />
)}

<ResumenTareasModal
  show={showResumen}
  onHide={() => setShowResumen(false)}
  tareas={tareas}
  usuarios={usuarios}
  fecha={fechaResumen}
  setFecha={setFechaResumen}
/>



    </div>
  );
};

const getBadgeColor = (status) => {
  switch (status) {
    case "pending": return "warning";
    case "in_progress": return "info";
    case "completed": return "success";
    default: return "secondary";
  }
};
const getStatusLabel = (status) => {
  switch (status) {
    case "pending": return "Pendiente";
    case "in_progress": return "En Progreso";
    case "completed": return "Completada";
    default: return "Desconocido";
  }
};


export default CalendarioTareas;
