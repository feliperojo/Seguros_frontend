import React from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import { formatDateForDisplay, normalizeDateForInput } from "../../utils/formatters";

const isoYmd = (v) => {
  if (v == null || v === "") return "";
  const s = String(v).trim().split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : normalizeDateForInput(s) || "";
};

/**
 * Campo de fecha con calendario nativo, pero visual fijo MM-DD-YYYY.
 * Internamente mantiene YYYY-MM-DD (ideal para API/forms).
 */
export default function MdyDashDateInput({
  valueIso,
  onChangeIso,
  disabled = false,
  required = false,
  minIso,
  maxIso,
  size,
  className,
  buttonVariant = "outline-secondary",
  buttonTitle = "Seleccionar fecha",
  /** Texto nativo del control (tooltip / accesibilidad) */
  title,
}) {
  const dateRef = React.useRef(null);
  /** Devuelve foco al control visible para cerrar bien el picker (sobre todo WebKit). */
  const textRef = React.useRef(null);

  const iso = isoYmd(valueIso);
  const display = React.useMemo(() => {
    if (!iso) return "";
    const f = formatDateForDisplay(iso);
    return f === "-" ? "" : f;
  }, [iso]);

  return (
    <div style={{ position: "relative" }}>
      <InputGroup className={className}>
        <Form.Control
          ref={textRef}
          size={size}
          type="text"
          value={display}
          disabled={disabled}
          readOnly
          tabIndex={disabled ? -1 : 0}
          title={title || "Formato: MM-DD-YYYY"}
        />
        <Button
          variant={buttonVariant}
          type="button"
          disabled={disabled}
          onClick={() => {
            const el = dateRef.current;
            if (!el) return;
            try {
              el.focus({ preventScroll: true });
            } catch {
              el.focus();
            }
            if (typeof el.showPicker === "function") {
              const p = el.showPicker();
              if (p && typeof p.then === "function") p.catch(() => {});
            } else {
              el.click();
            }
          }}
          title={buttonTitle}
          aria-label={buttonTitle}
        >
          <i className="bi bi-calendar3" aria-hidden />
        </Button>
      </InputGroup>

      <input
        ref={dateRef}
        type="date"
        value={iso}
        onChange={(e) => {
          const next = e.target.value;
          const input = e.currentTarget;
          onChangeIso?.(next);
          // Quitar foco del input nativo para cerrar el calendario emergente.
          input?.blur?.();
          requestAnimationFrame(() => {
            input?.blur?.();
            try {
              textRef.current?.focus?.({ preventScroll: true });
            } catch {
              textRef.current?.focus?.();
            }
          });
        }}
        disabled={disabled}
        required={required}
        min={minIso ? isoYmd(minIso) : undefined}
        max={maxIso ? isoYmd(maxIso) : undefined}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}

