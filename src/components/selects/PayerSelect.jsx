import React from "react";

/** options: [{value,label}] */
export default function PayerSelect({ options = [], value, onChange, disabled }) {
  return (
    <select
      className="form-select form-select-sm"
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
