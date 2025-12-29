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

const ProspectoBarra = ({ currentCode, grupoId, onDescartar }) => {
  const safeCode = (currentCode || "PROSPECTO").toUpperCase();
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.code === safeCode));
  
  // Determinar si se puede cambiar a DESCARTADO (solo en COTIZACION o SEGUIMIENTO)
  const puedeDescartar = (safeCode === "COTIZACION" || safeCode === "SEGUIMIENTO") && grupoId && onDescartar;

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

  return (
    <div className="mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="flex-grow-1">
          <ul className="progressbar d-flex justify-content-between list-unstyled mb-0">
            {STEPS.map((s, idx) => {
              // Ocultar DESCARTADO en la barra si no se puede cambiar a ese estado
              if (s.code === "DESCARTADO" && !puedeDescartar) {
                return null;
              }
              
              const isActive = idx === currentIndex;
              const isDone = idx < currentIndex;
              return (
                <li
                  key={s.code}
                  className={`step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
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
      </div>
    </div>
  );
};

export default ProspectoBarra;
