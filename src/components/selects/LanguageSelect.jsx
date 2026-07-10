import React from "react";
import useLanguages from "../../hooks/useLanguages";

export default function LanguageSelect({
  name = "idioma",
  value,
  onChange,
  disabled = false,
  className = "form-select form-select-sm",
  placeholder = "Seleccione",
  includeOther = true,         // agrega “Otro”
  includeEmpty = true,         // agrega opción vacía
  getLabel = (l) => l.name,    // cómo mostrar
  getValue = (l) => l.name,    // qué guardar (puedes usar l.code si prefieres)
}) {
  const { languages, loading } = useLanguages();

  return (
    <select
      name={name}
      className={className}
      value={value ?? ""}
      onChange={onChange}
      disabled={disabled || loading}
    >
      {includeEmpty && <option value="">{placeholder}</option>}
      {languages.map((l) => (
        <option key={l.code} value={getValue(l)}>
          {getLabel(l)}
        </option>
      ))}
      {includeOther && <option value="Otro">Otro</option>}
    </select>
  );
}
