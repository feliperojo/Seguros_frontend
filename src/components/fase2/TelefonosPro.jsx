// src/components/TelefonosPro.jsx
import Select from "react-select";

import React, { useMemo, useCallback } from "react";
import countryCodes from "../../services/countryCodes";
import { formatPhone334 } from "../../utils/formatters";

/* Helpers */
function ensureOnePrimary(arr = []) {
  let seen = false;
  return (arr || []).map((p) => {
    const next = { ...p, principal: !!p.principal };
    if (next.principal) {
      if (!seen) seen = true;
      else next.principal = false;
    }
    return next;
  });
}
const norm = (s) => String(s ?? "").trim();
const cleanNumber = (s) => String(s ?? "").replace(/[^\d-]/g, "");

const codeToIso = new Map();
(countryCodes || []).forEach((c) => {
  const code = String(c.code || "").replace(/\D+/g, "");
  const iso = String(c.iso || "").toLowerCase();
  if (!codeToIso.has(code) || iso === "us") {
    codeToIso.set(code, iso);
  }
});
const isoToCode = new Map(
  (countryCodes || []).map((c) => [
    String(c.iso || "").toLowerCase(),
    String(c.code || "").replace(/\D+/g, ""),
  ])
);

// Función mejorada para generar banderas compatible con todos los navegadores
const isoToFlag = (iso) => {
  const x = String(iso || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(x)) return "🏳️";
  
  try {
    // Método 1: Usar String.fromCodePoint (más moderno)
    const codePoints = [...x].map((ch) => 0x1f1e6 - 65 + ch.charCodeAt(0));
    const flag = String.fromCodePoint(...codePoints);
    
    // Verificar que el emoji se generó correctamente
    if (flag && flag.length > 0 && flag !== String.fromCharCode(0x1f1e6)) {
      return flag;
    }
  } catch (e) {
    // Si falla, continuar con método alternativo
  }
  
  try {
    // Método 2: Usar String.fromCharCode (más compatible)
    const char1 = String.fromCharCode(0x1f1e6 - 65 + x.charCodeAt(0));
    const char2 = String.fromCharCode(0x1f1e6 - 65 + x.charCodeAt(1));
    const flag = char1 + char2;
    if (flag && flag.length > 0) {
      return flag;
    }
  } catch (e) {
    // Si falla, continuar con método alternativo
  }
  
  try {
    // Método 3: Usar escape Unicode (más compatible con builds)
    const cp1 = 0x1f1e6 - 65 + x.charCodeAt(0);
    const cp2 = 0x1f1e6 - 65 + x.charCodeAt(1);
    return String.fromCodePoint(cp1, cp2);
  } catch (e) {
    // Si todo falla, retornar bandera genérica
  }
  
  return "🏳️";
};

// Generar opciones de países con banderas de forma más robusta
const COUNTRY_OPTIONS = (countryCodes || []).map((c) => {
  const iso = String(c.iso || "").toLowerCase();
  const code = String(c.code || "").replace(/\D+/g, "");
  
  // Priorizar bandera del objeto, luego generar una
  let flag = c.flag;
  if (!flag || flag.trim() === "") {
    flag = isoToFlag(iso);
  }
  
  // Asegurar que la bandera sea un string válido
  if (typeof flag !== "string" || flag.trim() === "") {
    flag = "🏳️";
  }
  
  const label = `${flag} ${iso.toUpperCase()} (+${code})`;
  return { value: iso, label, iso, code, flag, name: c.name || iso.toUpperCase() };
});

function completeIsoIndic({ iso, indicativo }, fallbackIso = "us", applyFallback = false) {
  let outIso = String(iso || "").toLowerCase();
  let outInd = String(indicativo || "").replace(/\D+/g, "");
  if (!outIso && outInd) outIso = codeToIso.get(outInd) || "";
  if (!outInd && outIso) outInd = isoToCode.get(outIso) || "";
  if (applyFallback && !outIso && !outInd) {
    outIso = fallbackIso;
    outInd = isoToCode.get(outIso) || "";
  }
  return { iso: outIso, indicativo: outInd };
}

/* Country select */
/* Country select con react-select (banderas compatibles con Chrome/Firefox) */
const countrySelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "calc(1.5em + .5rem + 2px)",
    height: "calc(1.5em + .5rem + 2px)",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    borderColor: state.isFocused ? "#3b82f6" : "#d1d5db",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(59, 130, 246, 0.1)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "#3b82f6" : "#9ca3af",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 8px",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    padding: "0 4px",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
    position: "absolute",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
  menuList: (base) => ({
    ...base,
    maxHeight: "200px",
    padding: "4px",
  }),
  option: (base, state) => ({
    ...base,
    fontSize: "0.875rem",
    padding: "8px 12px",
    backgroundColor: state.isSelected
      ? "#3b82f6"
      : state.isFocused
      ? "#eff6ff"
      : "white",
    color: state.isSelected ? "white" : "#1f2937",
    cursor: "pointer",
    "&:active": {
      backgroundColor: "#3b82f6",
      color: "white",
    },
  }),
};

// Componente para renderizar opciones con banderas de forma más robusta
const formatOptionLabel = (option) => {
  if (!option) return "";
  
  const flag = option.flag || "";
  const iso = String(option.iso || "").toLowerCase();
  const code = String(option.code || "").replace(/\D+/g, "");
  
  // Asegurar que la bandera se renderice correctamente
  let displayFlag = flag;
  if (!displayFlag || typeof displayFlag !== "string" || displayFlag.trim() === "") {
    displayFlag = isoToFlag(iso);
  }
  if (!displayFlag || displayFlag.trim() === "") {
    displayFlag = "🏳️";
  }
  
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span 
        style={{ 
          fontSize: "1.2em", 
          lineHeight: "1", 
          display: "inline-block",
          minWidth: "1.5em",
          textAlign: "center"
        }}
        role="img"
        aria-label={`Bandera de ${iso.toUpperCase()}`}
      >
        {displayFlag}
      </span>
      <span>{iso.toUpperCase()} (+{code})</span>
    </div>
  );
};

function CountrySelectWithFlags({ value, onChange, disabled }) {
  const iso = String(value || "").toLowerCase();

  const selectedOption =
    COUNTRY_OPTIONS.find((opt) => opt.iso === iso) || null;

  const handleChange = (option) => {
    // mantenemos la API: devolvemos solo el ISO en minúsculas
    onChange?.(option ? String(option.iso || option.value || "").toLowerCase() : "");
  };

  // Asegurar que document.body esté disponible
  const menuPortalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <Select
      classNamePrefix="tp-country-select"
      className="tp-country-select-wrapper"
      options={COUNTRY_OPTIONS}
      getOptionValue={(opt) => opt.iso}
      formatOptionLabel={formatOptionLabel}
      value={selectedOption}
      onChange={handleChange}
      isDisabled={disabled}
      styles={countrySelectStyles}
      menuPlacement="auto"
      isSearchable={true}
      menuPortalTarget={menuPortalTarget}
      menuShouldScrollIntoView={false}
    />
  );
}


/* Row */
function PhoneRow({ item, index, onPatch, onRemove, onMakePrimary, readOnly }) {
  const local = useMemo(() => item || {}, [item]);
  const patch = (p) => onPatch?.(index, p);

  const handleIso = (newIso) => {
    // Forzamos a que el indicativo se recalcule a partir del ISO seleccionado
    const pair = completeIsoIndic({ iso: newIso, indicativo: "" });
    patch({ iso: pair.iso, indicativo: pair.indicativo });
  };
  

  const handleIndicativo = (e) => {
    const val = String(e.target.value || "").replace(/\D+/g, "");
    const pair = completeIsoIndic({ iso: local.iso, indicativo: val });
    patch({ indicativo: pair.indicativo, iso: pair.iso });
  };

  // aplica formato visual mientras escribe
  const handleNumero = (e) => {
    const formatted = formatPhone334(String(e.target.value || ""));
    patch({ numero: formatted });
  };

  const handleTipo = (e) => patch({ tipo: norm(e.target.value) || "Móvil" });
  const handlePrimary = () => onMakePrimary?.(index);
  const handleRemove = () => onRemove?.(index);

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-3 transition-all duration-200 hover:shadow-md hover:border-gray-300 overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-200">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="radio"
            name="telefono-principal"
            id={`principal-${index}`}
            checked={!!local.principal}
            onChange={handlePrimary}
            disabled={readOnly}
            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-xs font-medium text-gray-600">Principal</span>
        </label>
        {!readOnly && (
          <button
            type="button"
            className="p-1 text-red-500 hover:text-red-700 transition-opacity opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded"
            onClick={handleRemove}
            title="Eliminar teléfono"
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
        )}
      </div>

      <div className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
              Tipo
            </label>
            <select
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:cursor-not-allowed bg-white"
              value={local.tipo || "Móvil"}
              onChange={handleTipo}
              disabled={readOnly}
            >
              <option value="Móvil">Móvil</option>
              <option value="Trabajo">Trabajo</option>
              <option value="Casa">Casa</option>
              <option value="Whatsapp">Whatsapp</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
              País
            </label>
            <CountrySelectWithFlags
              value={local.iso}
              onChange={handleIso}
              disabled={readOnly}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
              Número
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">
                +{local.indicativo || ""}
              </span>
              <input
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                value={local.numero || ""}
                onChange={handleNumero}
                disabled={readOnly}
                placeholder="333-333-3333"
                inputMode="tel"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Principal */
export default function TelefonosPro({
  value = [],
  onChange = () => {},
  readOnly = false,
  fallbackIso = "us",
  addLabel = "Agregar teléfono",
}) {
  const data = useMemo(() => {
    const base = Array.isArray(value) ? value : [];
    const mapped = base.map((p, i) => {
      const iso = String(p?.iso || "").toLowerCase();
      const indicativo = String(p?.indicativo || "").replace(/\D+/g, "");
      const completed = completeIsoIndic({ iso, indicativo }, fallbackIso, !iso && !indicativo);
      const numeroFormatted = formatPhone334(String(p?.numero ?? "")); // mostrar formateado
      return {
        id: p.id ?? `ph-${i}`,
        tipo: norm(p?.tipo) || "Móvil",
        numero: numeroFormatted,
        principal: !!p?.principal,
        iso: completed.iso,
        indicativo: completed.indicativo,
      };
    });
    return ensureOnePrimary(mapped);
  }, [value, fallbackIso]);

  const emit = useCallback(
    (arr) => {
      const cleaned = ensureOnePrimary(arr).map((p) => ({
        id: p.id,
        tipo: p.tipo || "Móvil",
        numero: String(p.numero || ""), // mantenemos el formato visual
        principal: !!p.principal,
        iso: String(p.iso || "").toLowerCase(),
        indicativo: String(p.indicativo || "").replace(/\D+/g, ""),
      }));
      onChange(cleaned);
    },
    [onChange]
  );

  const addPhone = () => {
    const { iso: newIso, indicativo: newIndic } = completeIsoIndic(
      { iso: "", indicativo: "" },
      fallbackIso,
      true
    );
    emit([
      ...data,
      {
        id: `ph-${Date.now().toString(36)}`,
        iso: newIso,
        indicativo: newIndic,
        numero: "",
        tipo: "Móvil",
        principal: data.length === 0,
      },
    ]);
  };

  const removeAt = (idx) => {
    const next = data.filter((_, i) => i !== idx);
    if (!next.some((x) => x.principal) && next[0]) next[0].principal = true;
    emit(next);
  };

  const patchAt = (idx, patch) => {
    const next = data.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    emit(next);
  };

  const makePrimary = (idx) => {
    const next = data.map((it, i) => ({ ...it, principal: i === idx }));
    emit(next);
  };

  return (
    <div className="space-y-3">
      {data.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
          No hay teléfonos registrados
        </div>
      ) : (
        data.map((item, idx) => (
          <PhoneRow
            key={item.id ?? idx}
            item={item}
            index={idx}
            onPatch={patchAt}
            onRemove={removeAt}
            onMakePrimary={makePrimary}
            readOnly={readOnly}
          />
        ))
      )}

      {!readOnly && (
        <button
          type="button"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 hover:border-blue-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={addPhone}
        >
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
          </svg>
          {addLabel}
        </button>
      )}
    </div>
  );
}
