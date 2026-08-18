import React from "react";
import { flushSync } from "react-dom";
import { Button, Form, InputGroup } from "react-bootstrap";
import {
  caretIndexFromDigitCount,
  countDigitsBeforeCaret,
  formatDateMMDDYYYY,
  formatMdySlashTyping,
  normalizeDateForInput,
  onlyDigits,
} from "../../utils/formatters";

const isoYmd = (v) => {
  if (v == null || v === "") return "";
  const s = String(v).trim().split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : normalizeDateForInput(s) || "";
};

const formatMdyFromDigits = (digits) => formatMdySlashTyping(digits);

/**
 * Fecha “cerrada” para parsear con `normalizeDateForInput`.
 * Evita que `new Date()` complete años cortos al escribir (p. ej. "04-15-20" → 2020).
 */
const isStructurallyCompleteDateInput = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  if (/[a-zA-Z]/.test(s)) return true;
  if (/^\d{4}-\d{2}-\d{2}(?!\d)/.test(s)) return true;
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return true;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return true;
  return false;
};

function MdyDashDateInputReadonly({
  valueIso,
  onChangeIso,
  disabled,
  required,
  minIso,
  maxIso,
  size,
  className,
  buttonVariant,
  buttonTitle,
  title,
}) {
  const dateRef = React.useRef(null);
  const textRef = React.useRef(null);

  const iso = isoYmd(valueIso);
  const syncedDisplay = React.useMemo(() => {
    if (!iso) return "";
    return formatDateMMDDYYYY(iso) || "";
  }, [iso]);

  const emitIso = React.useCallback(
    (nextIso) => {
      onChangeIso?.(nextIso);
    },
    [onChangeIso]
  );

  return (
    <div style={{ position: "relative" }}>
      <InputGroup className={className}>
        <Form.Control
          ref={textRef}
          size={size}
          type="text"
          value={syncedDisplay}
          disabled={disabled}
          readOnly
          tabIndex={disabled ? -1 : 0}
          title={title || "Formato: MM/DD/YYYY"}
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
          emitIso(next);
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

function MdyDashDateInputEditable({
  valueIso,
  onChangeIso,
  disabled,
  required,
  minIso,
  maxIso,
  size,
  className,
  buttonVariant,
  buttonTitle,
  title,
}) {
  const dateRef = React.useRef(null);
  const textRef = React.useRef(null);
  const focusedRef = React.useRef(false);
  const pendingSelectionRef = React.useRef(null);
  const stableName = React.useId();

  const iso = isoYmd(valueIso);
  const syncedDisplay = React.useMemo(() => {
    if (!iso) return "";
    return formatDateMMDDYYYY(iso) || "";
  }, [iso]);

  const [text, setText] = React.useState(syncedDisplay);

  const isWithinBounds = React.useCallback(
    (ymd) => {
      if (!ymd) return true;
      const min = minIso ? isoYmd(minIso) : "";
      const max = maxIso ? isoYmd(maxIso) : "";
      if (min && ymd < min) return false;
      if (max && ymd > max) return false;
      return true;
    },
    [minIso, maxIso]
  );

  const tryParseCommitted = React.useCallback(
    (raw) => {
      const trimmed = String(raw ?? "").trim();
      if (!trimmed) return { ok: true, iso: "" };
      if (!isStructurallyCompleteDateInput(trimmed)) {
        return { ok: false };
      }
      const normalized = normalizeDateForInput(trimmed);
      if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        return { ok: false };
      }
      if (!isWithinBounds(normalized)) return { ok: false };
      return { ok: true, iso: normalized };
    },
    [isWithinBounds]
  );

  const emitIso = React.useCallback(
    (nextIso) => {
      onChangeIso?.(nextIso);
    },
    [onChangeIso]
  );

  React.useLayoutEffect(() => {
    if (!focusedRef.current) {
      setText(syncedDisplay);
    }
  }, [syncedDisplay]);

  React.useLayoutEffect(() => {
    const sel = pendingSelectionRef.current;
    if (!sel) return;
    pendingSelectionRef.current = null;
    const el = textRef.current;
    if (!el) return;
    try {
      el.setSelectionRange(sel.start, sel.end);
    } catch {
      // noop
    }
  }, [text]);

  const commitText = React.useCallback(() => {
    const r = tryParseCommitted(text);
    if (!text.trim()) {
      emitIso("");
      setText("");
      return;
    }
    if (!r.ok) {
      const digitCount = onlyDigits(text).length;
      if (digitCount > 0 && digitCount < 8) {
        return;
      }
      setText(syncedDisplay);
      return;
    }
    if (r.iso !== iso) {
      emitIso(r.iso);
    }
    const disp = formatDateMMDDYYYY(r.iso);
    setText(disp || "");
  }, [text, tryParseCommitted, syncedDisplay, iso, emitIso]);

  const handleTextChange = (e) => {
    const inputEl = e.currentTarget;
    const raw = e.target.value;
    const selStart = inputEl?.selectionStart ?? raw.length;
    const selEnd = inputEl?.selectionEnd ?? raw.length;
    const tryNorm = normalizeDateForInput(raw);
    if (
      isStructurallyCompleteDateInput(raw) &&
      tryNorm &&
      /^\d{4}-\d{2}-\d{2}$/.test(tryNorm) &&
      isWithinBounds(tryNorm)
    ) {
      const disp = formatDateMMDDYYYY(tryNorm);
      if (disp) {
        pendingSelectionRef.current = { start: disp.length, end: disp.length };
        setText(disp);
        if (tryNorm !== iso) emitIso(tryNorm);
        return;
      }
    }
    const d = onlyDigits(raw).slice(0, 8);
    const next = formatMdyFromDigits(d);
    const startDigits = countDigitsBeforeCaret(raw, selStart);
    const endDigits = countDigitsBeforeCaret(raw, selEnd);
    const nextStart = caretIndexFromDigitCount(next, startDigits);
    const nextEnd = caretIndexFromDigitCount(next, endDigits);
    pendingSelectionRef.current = { start: nextStart, end: nextEnd };
    setText(next);
    const committed = tryParseCommitted(next);
    if (committed.ok && committed.iso !== iso) {
      emitIso(committed.iso);
    }
  };

  const handleKeyDown = (e) => {
    const el = e.currentTarget;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start == null || end == null) return;
    if (start !== end) return;
    const v = el.value ?? "";

    if (e.key === "Backspace" && start > 0 && (v[start - 1] === "/" || v[start - 1] === "-")) {
      e.preventDefault();
      const nextPos = start - 1;
      pendingSelectionRef.current = { start: nextPos, end: nextPos };
      requestAnimationFrame(() => {
        try {
          el.setSelectionRange(nextPos, nextPos);
        } catch {
          // noop
        }
      });
      return;
    }

    if (e.key === "Delete" && start < v.length && (v[start] === "/" || v[start] === "-")) {
      e.preventDefault();
      const nextPos = start + 1;
      pendingSelectionRef.current = { start: nextPos, end: nextPos };
      requestAnimationFrame(() => {
        try {
          el.setSelectionRange(nextPos, nextPos);
        } catch {
          // noop
        }
      });
    }
  };

  const openNativePicker = React.useCallback(() => {
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
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <InputGroup className={className}>
        <Form.Control
          ref={textRef}
          name={`mdy-date-${stableName}`}
          size={size}
          type="text"
          inputMode="numeric"
          // Chrome a veces ignora "off" y auto-rellena fechas por heurística.
          // "new-password" suele desactivar el autofill sin afectar UX.
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={10}
          value={text}
          disabled={disabled}
          required={required}
          tabIndex={disabled ? -1 : 0}
          title={title || "Formato: MM/DD/YYYY. Escriba o use el calendario."}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
            commitText();
          }}
          onKeyDown={handleKeyDown}
          onChange={handleTextChange}
        />
        <Button
          variant={buttonVariant}
          type="button"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          onClick={() => {
            const r = tryParseCommitted(text);
            if (text.trim() && r.ok && r.iso !== iso) {
              flushSync(() => emitIso(r.iso));
            }
            openNativePicker();
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
        autoComplete="off"
        value={iso}
        onChange={(e) => {
          const next = e.target.value;
          const input = e.currentTarget;
          emitIso(next);
          if (!next) {
            setText("");
          } else {
            const disp = formatDateMMDDYYYY(next);
            if (disp) setText(disp);
          }
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

/**
 * Campo de fecha con calendario nativo, pero visual fijo MM/DD/YYYY.
 * Internamente mantiene YYYY-MM-DD (ideal para API/forms).
 *
 * @param {boolean} [allowManualEntry=false] — Si es true, el usuario puede escribir o pegar además del calendario.
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
  title,
  allowManualEntry = false,
}) {
  const common = {
    valueIso,
    onChangeIso,
    disabled,
    required,
    minIso,
    maxIso,
    size,
    className,
    buttonVariant,
    buttonTitle,
    title,
  };

  if (allowManualEntry) {
    return <MdyDashDateInputEditable {...common} />;
  }
  return <MdyDashDateInputReadonly {...common} />;
}
