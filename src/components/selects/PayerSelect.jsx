import React from "react";

/** options: [{value,label}] */
export default function PayerSelect({ options = [], value, onChange, disabled, className = "form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm" }) {
  return (
    <select
      className={className}
      name="pagador_id"
      value={value ?? ""}
      onChange={(e) => onChange({ target: { name: "pagador_id", value: Number(e.target.value) || "", type: "select-one" } })}
      disabled={disabled}
    >
      <option value="">Seleccione un pagador</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
