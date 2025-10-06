import React from "react";
import { FaChevronDown } from "react-icons/fa";

/**
 * ProductosButtons
 * - Renderiza los 3 botones de Productos.
 * - Puedes pasar callbacks para cada botón.
 */
export default function ProductosButtons({
  className = "",
  onPolizaSalud = () => {},
  onPolizaDental = () => {},
  onPolizaVida = () => {},
}) {
  const Item = ({ label, onClick }) => (
    <button
      type="button"
      className="btn btn-light border w-100 d-flex justify-content-between align-items-center btn-sm py-2 mb-2 rounded-1"
      onClick={onClick}
    >
      <span className="fw-semibold">{label}</span>
      <FaChevronDown className="opacity-50" />
    </button>
  );

  return (
    <div className={`card ${className}`}>
      <div className="card-body">
        <h6 className="text-center fw-semibold mb-3">Productos</h6>
        <Item label="Póliza Salud" onClick={onPolizaSalud} />
        <Item label="Póliza Dental" onClick={onPolizaDental} />
        <Item label="Póliza de Vida" onClick={onPolizaVida} />
      </div>
    </div>
  );
}
