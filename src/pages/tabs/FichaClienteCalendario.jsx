import React from "react";
import CalendarioTareas from "../../components/Tareas/CalendarioTareas";

export default function FichaClienteCalendario() {
  // Obtener el usuario actual desde localStorage (mismo método que Dashboard)
  const currentUser = JSON.parse(localStorage.getItem("user")) || null;

  return (
    <div className="mt-3">
      <CalendarioTareas tareas={[]} currentUser={currentUser} />
    </div>
  );
}



