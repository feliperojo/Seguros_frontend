import React, { useEffect, useRef, useState } from "react";
import { formatMoney2, parseMoney } from "../../services/ingresos";

/**
 * Campo de precio para coberturas: formato es-CO (miles + 2 decimales),
 * mismo comportamiento que ingresos en TomaDeDatos (escribir → parsear → formatear al salir).
 */
export default function CoveragePriceInput({
  value = "",
  onChange,
  disabled = false,
  size,
  className = "form-control",
  placeholder = "0,00",
  name = "precio",
}) {
  const focusedRef = useRef(false);
  const [typingValue, setTypingValue] = useState(undefined);

  useEffect(() => {
    if (!focusedRef.current) {
      setTypingValue(undefined);
    }
  }, [value]);

  const displayValue =
    typingValue !== undefined
      ? typingValue
      : value
        ? formatMoney2(value)
        : "";

  const sizeClass = size === "sm" ? "form-control-sm" : "";

  return (
    <input
      type="text"
      inputMode="decimal"
      name={name}
      className={`${className} ${sizeClass}`.trim()}
      value={displayValue}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setTypingValue(raw);
        const parsed = parseMoney(raw);
        onChange?.(parsed === 0 ? "" : String(parsed));
      }}
      onBlur={() => {
        focusedRef.current = false;
        const current = value ?? "";
        if (!String(current).trim() && !String(typingValue ?? "").trim()) {
          setTypingValue(undefined);
          onChange?.("");
          return;
        }
        const formatted = formatMoney2(current || typingValue);
        setTypingValue(undefined);
        onChange?.(formatted);
      }}
    />
  );
}
