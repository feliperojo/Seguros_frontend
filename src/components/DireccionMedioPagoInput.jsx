import React from "react";

export const CopiarDireccionClienteCheck = ({
  id,
  checked,
  onChange,
  disabled = false,
  className = "",
  title,
}) => (
  <div
    className={`form-check mb-0 ${className}`.trim()}
    title={title}
  >
    <input
      className="form-check-input"
      type="checkbox"
      id={id}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
    />
    <label className="form-check-label text-nowrap" htmlFor={id}>
      Del cliente
    </label>
  </div>
);

const DireccionMedioPagoInput = ({
  id = "direccion",
  value,
  onChange,
  copiarDireccion,
  onToggleCopiar,
  clienteDireccion,
}) => {
  const hasClienteDireccion = Boolean(String(clienteDireccion || "").trim());

  return (
    <div className="form-group mb-3">
      <label htmlFor={id}>Dirección</label>
      <div className="input-group">
        <input
          type="text"
          className="form-control"
          id={id}
          name="direccion"
          value={value || ""}
          onChange={onChange}
        />
        <div className="input-group-text bg-white">
          <CopiarDireccionClienteCheck
            id={`${id}_copiar`}
            checked={copiarDireccion}
            onChange={onToggleCopiar}
            disabled={!hasClienteDireccion}
            title={
              hasClienteDireccion
                ? "Usar la dirección configurada del cliente"
                : "El cliente no tiene dirección configurada"
            }
          />
        </div>
      </div>
    </div>
  );
};

export default DireccionMedioPagoInput;
