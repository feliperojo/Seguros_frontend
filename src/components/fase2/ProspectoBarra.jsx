// components/fase2/ProspectoBarra.jsx
import React from "react";
import "../../styles/ProspectoBarra.css";

const STEPS = [
  { code: "PROSPECTO",       label: "PROSPECTO" },
  { code: "COTIZACION",      label: "COTIZACIÓN" },
  { code: "SEGUIMIENTO",     label: "SEGUIMIENTO" },
  { code: "TOMA_DATOS",      label: "TOMA DE DATOS" },
  { code: "INSCRIPCION_INI", label: "INSCRIPCIÓN INICIAL" },
  { code: "GRUPO_FAMILIAR",       label: "TERMINADO" },
  { code: "DESCARTADO",      label: "DESCARTADO" },
];

const ProspectoBarra = ({ currentCode, grupoId, onDescartar, onReactivarSeguimiento }) => {
  const safeCode = (currentCode || "PROSPECTO").toUpperCase();
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.code === safeCode));
  
  // Determinar si se puede cambiar a DESCARTADO (hasta INSCRIPCION_INI inclusive)
  const inscripcionIniIndex = STEPS.findIndex((s) => s.code === "INSCRIPCION_INI");
  const puedeDescartar =
    safeCode !== "DESCARTADO" &&
    currentIndex <= inscripcionIniIndex &&
    grupoId &&
    onDescartar;
  const puedeReactivarSeguimiento = safeCode === "DESCARTADO" && grupoId && onReactivarSeguimiento;

  const handleDescartar = async () => {
    if (!window.confirm("¿Está seguro de que desea marcar este prospecto como DESCARTADO?")) {
      return;
    }
    
    if (onDescartar) {
      try {
        await onDescartar();
      } catch (error) {
        console.error("Error al cambiar estado a DESCARTADO:", error);
        alert("Error al cambiar el estado a DESCARTADO");
      }
    }
  };

  const handleReactivarSeguimiento = async () => {
    if (!window.confirm("¿Desea reactivar este grupo familiar y volverlo a SEGUIMIENTO?")) {
      return;
    }

    if (onReactivarSeguimiento) {
      try {
        await onReactivarSeguimiento();
      } catch (error) {
        console.error("Error al cambiar estado a SEGUIMIENTO:", error);
        alert("Error al cambiar el estado a SEGUIMIENTO");
      }
    }
  };

  return (
    <div className="mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="flex-grow-1">
          <ul className="progressbar d-flex justify-content-between list-unstyled mb-0">
            {STEPS.map((s, idx) => {
              // Mostrar DESCARTADO solo si se puede descartar desde aquí
              // o cuando el grupo ya está efectivamente en estado DESCARTADO.
              if (s.code === "DESCARTADO" && !puedeDescartar && safeCode !== "DESCARTADO") {
                return null;
              }
              
              const isActive = idx === currentIndex;
              const isDone = idx < currentIndex;
              return (
                <li
                  key={s.code}
                  className={`step ${isActive ? "active" : ""} ${isDone ? "done" : ""} ${s.code === "DESCARTADO" && safeCode === "DESCARTADO" ? "discarded" : ""}`}
                  title={s.code}
                >
                  <span>{s.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
        {puedeDescartar && (
          <button
            type="button"
            className="btn btn-outline-danger ms-3"
            onClick={handleDescartar}
            title="Marcar como descartado"
          >
            <i className="fas fa-times-circle me-2"></i>
            Marcar como Descartado
          </button>
        )}
        {puedeReactivarSeguimiento && (
          <button
            type="button"
            className="btn btn-outline-primary ms-3"
            onClick={handleReactivarSeguimiento}
            title="Volver a seguimiento"
          >
            <i className="fas fa-undo me-2"></i>
            Reactivar en Seguimiento
          </button>
        )}
      </div>
    </div>
  );
};

export default ProspectoBarra;
