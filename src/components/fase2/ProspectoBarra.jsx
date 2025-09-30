// components/fase2/ProspectoBarra.jsx
import React from "react";
import "../../styles/ProspectoBarra.css";

const STEPS = [
  { code: "PROSPECTO",       label: "PROSPECTO" },
  { code: "COTIZACION",      label: "COTIZACIÓN" },
  { code: "SEGUIMIENTO",     label: "SEGUIMIENTO" },
  { code: "TOMA_DATOS",      label: "TOMA DE DATOS" },
  { code: "INSCRIPCION_INI", label: "INSCRIPCIÓN INICIAL" },
  { code: "TERMINADO",       label: "TERMINADO" },
  { code: "DESCARTADO",      label: "DESCARTADO" },
];

const ProspectoBarra = ({ currentCode }) => {
  const safeCode = (currentCode || "PROSPECTO").toUpperCase();
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.code === safeCode));

  return (
    <div className="mb-4">
      <ul className="progressbar d-flex justify-content-between list-unstyled">
        {STEPS.map((s, idx) => {
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
  );
};

export default ProspectoBarra;
