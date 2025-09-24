// CompanySelect.jsx
import React from "react";

function CompanySelect({
  companies = [],
  value,
  onChange,
  disabled,
  name = "compania_id",       // <-- default field name
}) {
  const handleChange = (e) => {
    const raw = e.target.value;
    // Keep as number if numeric, else empty string
    const numeric = Number(raw);
    const val = raw === "" ? "" : (Number.isNaN(numeric) ? raw : numeric);

    // Emit event-like shape so onChangeFactory can read e.target.*
    onChange({
      target: { name, value: val, type: "select-one" },
    });
  };

  return (
    <select
      className="form-select"
      name={name}
      value={value ?? ""}
      onChange={handleChange}
      disabled={disabled}
    >
      <option value="">Seleccione…</option>
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </select>
  );
}
export default CompanySelect;
