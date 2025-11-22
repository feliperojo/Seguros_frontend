// src/components/TelefonosPro.jsx
import Select from "react-select";

import React, { useMemo, useCallback } from "react";
import countryCodes from "../../services/countryCodes";
import { formatPhone334 } from "../../utils/formatters";
import "../../styles/TelefonosPro.css";

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

const codeToIso = new Map(
  (countryCodes || []).map((c) => [
    String(c.code || "").replace(/\D+/g, ""),
    String(c.iso || "").toLowerCase(),
  ])
);
const isoToCode = new Map(
  (countryCodes || []).map((c) => [
    String(c.iso || "").toLowerCase(),
    String(c.code || "").replace(/\D+/g, ""),
  ])
);

const isoToFlag = (iso) => {
  const x = String(iso || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(x)) return "🏳️";
  const codePoints = [...x].map((ch) => 0x1f1e6 - 65 + ch.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const COUNTRY_OPTIONS = (countryCodes || []).map((c) => {
  const iso = String(c.iso || "").toLowerCase();
  const code = String(c.code || "").replace(/\D+/g, "");
  const flag = c.flag || isoToFlag(iso);
  const label = `${flag} ${iso.toUpperCase()} (+${code})`;
  return { value: iso, label, iso, code, flag, name: c.name || iso.toUpperCase() };
});

function completeIsoIndic({ iso, indicativo }, fallbackIso = "co") {
  let outIso = String(iso || "").toLowerCase();
  let outInd = String(indicativo || "").replace(/\D+/g, "");
  if (!outIso && outInd) outIso = codeToIso.get(outInd) || fallbackIso;
  if (!outInd && outIso) outInd = isoToCode.get(outIso) || "";
  return { iso: outIso, indicativo: outInd };
}

/* Country select */
/* Country select con react-select (banderas compatibles con Chrome/Firefox) */
const countrySelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "calc(1.5em + .5rem + 2px)",     // tamaño tipo form-select-sm
    height: "calc(1.5em + .5rem + 2px)",
    borderRadius: "0.2rem",
    fontSize: "0.875rem",
    boxShadow: state.isFocused ? base.boxShadow : "none",
    borderColor: state.isFocused ? "#80bdff" : base.borderColor,
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
    zIndex: 9999, // para que no quede debajo de otros elementos
  }),
};

function CountrySelectWithFlags({ value, onChange, disabled }) {
  const iso = String(value || "").toLowerCase();

  const selectedOption =
    COUNTRY_OPTIONS.find((opt) => opt.iso === iso) || null;

  const handleChange = (option) => {
    // mantenemos la API: devolvemos solo el ISO en minúsculas
    onChange?.(option ? String(option.iso || option.value || "").toLowerCase() : "");
  };

  return (
    <Select
      classNamePrefix="tp-country-select"
      // para que se vea como un input normal de Bootstrap
      className="tp-country-select-wrapper"
      options={COUNTRY_OPTIONS}
      // usamos nuestras propiedades internas
      getOptionLabel={(opt) => opt.label} // "🇨🇴 CO (+57)"
      getOptionValue={(opt) => opt.iso}
      value={selectedOption}
      onChange={handleChange}
      isDisabled={disabled}
      styles={countrySelectStyles}
      menuPlacement="auto"
      isSearchable={true}
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
    <div className="tp-phone-card">
      <div className="tp-card-header">
        <div className="form-check m-0">
          <input
            className="form-check-input"
            type="radio"
            name="telefono-principal"
            id={`principal-${index}`}
            checked={!!local.principal}
            onChange={handlePrimary}
            disabled={readOnly}
          />
          <label className="form-check-label small text-muted" htmlFor={`principal-${index}`}>
            Principal
          </label>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="btn btn-sm btn-link text-danger p-0 tp-btn-delete"
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

      <div className="tp-card-body">
        <div className="row g-2">
          <div className="col-12 col-sm-6 col-lg-4">
            <label className="form-label small mb-1 text-muted">Tipo</label>
            <select
              className="form-select form-select-sm"
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

          <div className="col-12 col-sm-6 col-lg-4">
            <label className="form-label small mb-1 text-muted">País</label>
            <CountrySelectWithFlags
  value={local.iso}
  onChange={handleIso}
  disabled={readOnly}
/>

          </div>

          <div className="col-12 col-lg-4">
            <label className="form-label small mb-1 text-muted">Número</label>
            <div className="input-group input-group-sm">
              <span className="input-group-text tp-indicativo">+{local.indicativo || ""}</span>
              <input
                className="form-control form-control-sm"
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
  fallbackIso = "co",
  addLabel = "Agregar teléfono",
}) {
  const data = useMemo(() => {
    const base = Array.isArray(value) ? value : [];
    const mapped = base.map((p, i) => {
      const iso = String(p?.iso || "").toLowerCase();
      const indicativo = String(p?.indicativo || "").replace(/\D+/g, "");
      const completed = completeIsoIndic({ iso, indicativo }, fallbackIso);
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
    const firstIso = data?.[0]?.iso || fallbackIso;
    const firstIndic = isoToCode.get(firstIso) || "";
    emit([
      ...data,
      {
        id: `ph-${Date.now().toString(36)}`,
        iso: firstIso,
        indicativo: firstIndic,
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
    <div className="telefonos-pro-wrapper">
      {data.length === 0 ? (
        <div className="text-muted small text-center py-3">No hay teléfonos registrados</div>
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
          className="btn btn-outline-primary btn-sm w-100"
          onClick={addPhone}
        >
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: 6 }}>
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
          </svg>
          {addLabel}
        </button>
      )}
    </div>
  );
}
