import React, { useState } from "react";
import { Card, Badge, Button, Toast, ToastContainer, Modal, ListGroup } from "react-bootstrap";
import apiRequest from "../../services/api";
import NuevaTareaModal from "../Tareas/NuevaTareaModal";
import ResponderTareaModal from "../Tareas/ResponderTareaModal";

const CalendarioTareas = ({ tareas: tareasIniciales, currentUser }) => {

  const hoy = new Date();
  const [mesActual, setMesActual] = useState(hoy.getMonth());
  const [añoActual, setAñoActual] = useState(hoy.getFullYear());

  const [tareas, setTareas] = useState(tareasIniciales);
  const [showNuevaModal, setShowNuevaModal] = useState(false);
  const [showResponderModal, setShowResponderModal] = useState(false);
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null);

  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [tareasDetalle, setTareasDetalle] = useState([]);

  const [toast, setToast] = useState({ show: false, message: "", variant: "success" });

  const diasSemana = ["L", "M", "X", "J", "V", "S", "D"];
  const diasEnMes = new Date(añoActual, mesActual + 1, 0).getDate();
  const primerDiaSemana = new Date(añoActual, mesActual, 1).getDay();
  const offsetInicio = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(currentUser?.id || null);

const [usuarios, setUsuarios] = useState([]); // Lista de usuarios


  const nombreMes = new Date(añoActual, mesActual).toLocaleString("es-ES", {
    month: "long",
    year: "numeric",
  });

  const abrirResponderTarea = (tarea) => {
    setTareaSeleccionada(tarea);
    setShowResponderModal(true);
  };

  const abrirDetalleDia = (lista) => {
    setTareasDetalle(lista);
    setShowDetalleModal(true);
  };

  const onCreated = (nuevaTarea) => {
    setTareas((prev) => [...prev, nuevaTarea]);
    setToast({ show: true, message: "✅ Nueva tarea agregada", variant: "success" });
  };

  const onUpdated = (tareaActualizada) => {
    setTareas((prev) =>
      prev.map((t) => (t.id === tareaActualizada.id ? tareaActualizada : t))
    );
    setToast({ show: true, message: "✅ Tarea actualizada", variant: "info" });
  };

  const obtenerTodasTareasDelDia = (dia) => {
    return tareas.filter((t) => {
      const fecha = t.scheduled_date ? new Date(`${t.scheduled_date}T00:00:00`) : new Date(t.created_at);
      return fecha.getDate() === dia && fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
    });
  };

  React.useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const response = await apiRequest("users", "GET");
        if (response && Array.isArray(response)) {
          setUsuarios(response);
  
          // ✅ Si el usuario logueado está en la lista, selecciónalo por defecto
          const usuarioDefault = response.find(u => u.id === currentUser.id);
          setUsuarioSeleccionado(usuarioDefault ? usuarioDefault.id : response[0].id);
        }
      } catch (error) {
        console.error("Error cargando usuarios:", error);
      }
    };
  
    fetchUsuarios();
  }, [currentUser]);
  
  
  
  const tareasFiltradas = tareas.filter((t) => 
    !usuarioSeleccionado || t.assigned_user_id === usuarioSeleccionado
  );
  
  

  // Agrupar tareas por día según scheduled_date
  const tareasPorDia = {};
  tareasFiltradas
  .filter((t) => t.status !== "completed") // ✅ Filtramos tareas completadas
  .forEach((t) => {
    const fecha = t.scheduled_date ? new Date(`${t.scheduled_date}T00:00:00`) : new Date(t.created_at);
    if (fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual) {
      const dia = fecha.getDate();
      if (!tareasPorDia[dia]) tareasPorDia[dia] = [];
      tareasPorDia[dia].push(t);
    }
  });


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

  const onDragStart = (e, tarea) => {
    if (tarea.status === "completed") {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("tareaId", tarea.id);
  };

  const onDrop = async (e, dia) => {
    e.preventDefault();
    const tareaId = e.dataTransfer.getData("tareaId");
    if (!tareaId) return;

    const nuevaFecha = new Date(añoActual, mesActual, dia).toISOString().split("T")[0];

    const tarea = tareas.find((t) => t.id === parseInt(tareaId));
    if (!tarea) return;

    let newDueDate = tarea.due_date;
    if (new Date(nuevaFecha) > new Date(tarea.due_date)) {
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
    <div>
     <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
  <div className="d-flex gap-2">
    {/* Botón Nueva Tarea */}
    <Button
      variant="primary"
      size="sm"
      onClick={() => setShowNuevaModal(true)}
    >
      ➕ Nueva Tarea
    </Button>

    {/* Botón Anterior */}
    <Button
      variant="outline-primary"
      size="sm"
      onClick={() => cambiarMes(-1)}
    >
      ◀ Anterior
    </Button>
  </div>

  {/* Mes y Selector de Usuario */}
  <div className="d-flex flex-column align-items-center">
    <h5 className="mb-2 text-capitalize fw-bold">{nombreMes}</h5>
    <select
      className="form-select form-select-sm"
      style={{ width: "220px" }}
      value={usuarioSeleccionado || ""}
      onChange={(e) => setUsuarioSeleccionado(parseInt(e.target.value))}
      disabled={!(currentUser.name === "Admin" || currentUser.name === "Auxiliar" || currentUser.name === "Catalina")}

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

  {/* Botón Siguiente */}
  <Button variant="outline-primary" size="sm" onClick={() => cambiarMes(1)}>
    Siguiente ▶
  </Button>
</div>


      

      {/* Días de la semana */}
      <div className="d-grid mb-2 fw-bold text-center" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" }}>
        {diasSemana.map((d, idx) => <div key={idx}>{d}</div>)}
      </div>

      {/* Celdas */}
      <div className="d-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" }}>
        {celdas.map((dia, index) => {
          if (dia === null) return <div key={index}></div>;

          const tareasDia = tareasPorDia[dia] || [];
          console.log("tareasDia",tareasDia)
          const esHoy = dia === hoy.getDate() && mesActual === hoy.getMonth() && añoActual === hoy.getFullYear();

          return (
            <Card
            key={dia}
            onDrop={(e) => onDrop(e, dia)}
            onDragOver={onDragOver}
            onClick={(e) => {
              // Si el click no viene de una Badge, abre el modal
              if (e.target.tagName !== "SPAN") {
                const todasLasTareas = obtenerTodasTareasDelDia(dia);
                if (todasLasTareas.length > 0) {
                  abrirDetalleDia(todasLasTareas);
                }
              }
            }}
             // ✅ Ahora abre modal siempre que haya tareas
            className="p-2 text-center"
            style={{
              minHeight: "130px",
              borderRadius: "8px",
              border: esHoy ? "2px solid #28a745" : "1px solid #ddd",
              backgroundColor: esHoy ? "#eafbea" : "#fff",
              cursor: tareasDia.length > 0 ? "pointer" : "default", // Indicador visual
            }}
          
            >
              <strong>{dia}</strong>
              <div className="mt-2">
                {tareasDia.length > 0 ? (
                  <>
                    {tareasDia.slice(0, 5).map((t) => (
                      <Badge
                        key={t.id}
                        bg={getBadgeColor(t.status)}
                        className="d-block mb-1"
                        style={{ fontSize: "0.75rem", cursor: "pointer" }}
                        draggable={t.status !== "completed"}
                        onDragStart={(e) => onDragStart(e, t)}
                        onClick={(e) => {
                          e.stopPropagation(); // Evita abrir el modal de detalle
                          abrirResponderTarea(t); // Abre modal de responder
                        }}
                        
                        
                      >
                         {t.log.cliente?.nombre_completo || "Sin Cliente"}
                      </Badge>
                    ))}
                    {tareasDia.length > 5 && (
                      <small
                        className="text-primary"
                        style={{ cursor: "pointer", fontSize: "0.8rem" }}
                        onClick={() => abrirDetalleDia(tareasDia)}
                      >
                        +{tareasDia.length - 5} más
                      </small>
                    )}
                  </>
                ) : (
                  <small className="text-muted">-</small>
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

      {/* Modal Detalle */}
      <Modal show={showDetalleModal} onHide={() => setShowDetalleModal(false)} size="lg">
  <Modal.Header closeButton>
    <Modal.Title>Tareas del día</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    <ListGroup>
      {tareasDetalle.map((t) => (
        <ListGroup.Item
          key={t.id}
          className="d-flex justify-content-between align-items-center"
        >
          <div>
            <Badge bg={getBadgeColor(t.status)} className="me-2">
              {getStatusLabel(t.status)}
            </Badge>
            <div className="fw-bold">
              {t.log?.concept?.name || "Tarea"}
            </div>
            <div className="text-muted" style={{ fontSize: "0.85rem" }}>
              {t.log?.cliente?.nombre_completo || "Sin Cliente"}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline-primary"
            onClick={() => abrirResponderTarea(t)}
          >
            Ver / Responder
          </Button>
        </ListGroup.Item>
      ))}
    </ListGroup>
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
