import React, { useState } from "react";
import { Card, Badge, Button, Toast, ToastContainer } from "react-bootstrap";
import apiRequest from "../../services/api";
import NuevaTareaModal from "../Tareas/NuevaTareaModal";
import ResponderTareaModal from "../Tareas/ResponderTareaModal";

const CalendarioTareas = ({ tareas: tareasIniciales }) => {
  const hoy = new Date();
  const [mesActual, setMesActual] = useState(hoy.getMonth());
  const [añoActual, setAñoActual] = useState(hoy.getFullYear());

  const [tareas, setTareas] = useState(tareasIniciales);
  const [showNuevaModal, setShowNuevaModal] = useState(false);
  const [showResponderModal, setShowResponderModal] = useState(false);
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null);

  const [toast, setToast] = useState({ show: false, message: "", variant: "success" });

  const diasSemana = ["L", "M", "X", "J", "V", "S", "D"];
  const diasEnMes = new Date(añoActual, mesActual + 1, 0).getDate();
  const primerDiaSemana = new Date(añoActual, mesActual, 1).getDay();
  const offsetInicio = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

  const nombreMes = new Date(añoActual, mesActual).toLocaleString("es-ES", {
    month: "long",
    year: "numeric",
  });

  const abrirResponderTarea = (tarea) => {
    setTareaSeleccionada(tarea);
    setShowResponderModal(true);
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

  // Agrupar tareas por día según scheduled_date
  const tareasPorDia = {};
  tareas.forEach((t) => {
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
      const response = await apiRequest(`tareas_operativas/${tareaId}/reprogramar`, "PUT", {
        scheduled_date: nuevaFecha,
        due_date: newDueDate,
      });
  
      // ✅ Actualizamos estado local manualmente
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
      {/* Botón Nueva Tarea */}
      <div className="d-flex justify-content-between align-items-end mb-3">
        <Button variant="primary" onClick={() => setShowNuevaModal(true)}>
          + Nueva Tarea
        </Button>
      </div>

      {/* Encabezado calendario */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Button variant="outline-primary" size="sm" onClick={() => cambiarMes(-1)}>◀ Anterior</Button>
        <h5 className="mb-0 text-capitalize">{nombreMes}</h5>
        <Button variant="outline-primary" size="sm" onClick={() => cambiarMes(1)}>Siguiente ▶</Button>
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
          const esHoy = dia === hoy.getDate() && mesActual === hoy.getMonth() && añoActual === hoy.getFullYear();

          return (
            <Card
              key={dia}
              onDrop={(e) => onDrop(e, dia)}
              onDragOver={onDragOver}
              className="p-2 text-center"
              style={{
                minHeight: "130px",
                borderRadius: "8px",
                border: esHoy ? "2px solid #28a745" : "1px solid #ddd",
                backgroundColor: esHoy ? "#eafbea" : "#fff",
              }}
            >
              <strong>{dia}</strong>
              <div className="mt-2">
                {tareasDia.length > 0 ? (
                  tareasDia.slice(0, 5).map((t) => (
                    <Badge
                      key={t.id}
                      bg={getBadgeColor(t.status)}
                      className="d-block mb-1"
                      style={{ fontSize: "0.75rem", cursor: "pointer" }}
                      draggable={t.status !== "completed"}
                      onDragStart={(e) => onDragStart(e, t)}
                      onDoubleClick={() => abrirResponderTarea(t)}
                    >
                      {t.log?.concept?.name || "Tarea"}
                    </Badge>
                  ))
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

      {/* Modales */}
      {showResponderModal && tareaSeleccionada && (
        <ResponderTareaModal
          show={showResponderModal}
          onHide={() => setShowResponderModal(false)}
          tarea={tareaSeleccionada}
          onUpdated={onUpdated} // ✅ Se pasa al modal
        />
      )}
      {showNuevaModal && (
        <NuevaTareaModal
          show={showNuevaModal}
          onHide={() => setShowNuevaModal(false)}
          onCreated={onCreated} // ✅ Se pasa al modal
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

export default CalendarioTareas;
