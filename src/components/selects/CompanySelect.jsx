import React from "react";

export default function CompanySelect({ companies = [], value, onChange, disabled }) {
  return (
    <select
      className="form-select form-select-sm"
      name="compania_id"
      value={value ?? ""}
      onChange={(e) => onChange({ target: { name: "compania_id", value: Number(e.target.value) || "", type: "select-one" } })}
      disabled={disabled}
    >
      <option value="">Seleccione…</option>
      {companies.map(c => (
        <option key={c.id} value={c.id}>{c.nombre}</option>
      ))}
    </select>
  );
}
