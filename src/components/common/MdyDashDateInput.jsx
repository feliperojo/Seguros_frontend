import React from "react";
import { flushSync } from "react-dom";
import { Button, Form, InputGroup } from "react-bootstrap";
import {
  formatDateForDisplay,
  normalizeDateForInput,
  onlyDigits,
  chunkJoin,
} from "../../utils/formatters";

const isoYmd = (v) => {
  if (v == null || v === "") return "";
  const s = String(v).trim().split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : normalizeDateForInput(s) || "";
};

const formatMdyFromDigits = (digits) => chunkJoin(digits.slice(0, 8), [2, 2, 4]);

const countDigitsBefore = (s, idx) => {
  const end = Math.max(0, Math.min(idx ?? 0, s?.length ?? 0));
  let n = 0;
  for (let i = 0; i < end; i++) {
    const c = s[i];
    if (c >= "0" && c <= "9") n++;
  }
  return n;
};

const caretFromDigitIndex = (formatted, digitIndex) => {
  const target = Math.max(0, digitIndex ?? 0);
  let seen = 0;
  for (let i = 0; i < (formatted?.length ?? 0); i++) {
    const c = formatted[i];
    if (c >= "0" && c <= "9") {
      seen++;
      if (seen >= target) return i + 1;
    }
  }
  return formatted?.length ?? 0;
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
    const f = formatDateForDisplay(iso);
    return f === "-" ? "" : f;
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

  const iso = isoYmd(valueIso);
  const syncedDisplay = React.useMemo(() => {
    if (!iso) return "";
    const f = formatDateForDisplay(iso);
    return f === "-" ? "" : f;
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
      setText(syncedDisplay);
      return;
    }
    if (r.iso !== iso) {
      emitIso(r.iso);
    }
    const disp = formatDateForDisplay(r.iso);
    setText(disp === "-" ? "" : disp);
  }, [text, tryParseCommitted, syncedDisplay, iso, emitIso]);

  const handleTextChange = (e) => {
    const inputEl = e.currentTarget;
    const raw = e.target.value;
    const selStart = inputEl?.selectionStart ?? raw.length;
    const selEnd = inputEl?.selectionEnd ?? raw.length;
    const tryNorm = normalizeDateForInput(raw);
    if (
      tryNorm &&
      /^\d{4}-\d{2}-\d{2}$/.test(tryNorm) &&
      isWithinBounds(tryNorm)
    ) {
      const disp = formatDateForDisplay(tryNorm);
      if (disp !== "-") {
        pendingSelectionRef.current = { start: disp.length, end: disp.length };
        setText(disp);
        return;
      }
    }
    const d = onlyDigits(raw).slice(0, 8);
    const next = formatMdyFromDigits(d);
    const startDigits = countDigitsBefore(raw, selStart);
    const endDigits = countDigitsBefore(raw, selEnd);
    const nextStart = caretFromDigitIndex(next, startDigits);
    const nextEnd = caretFromDigitIndex(next, endDigits);
    pendingSelectionRef.current = { start: nextStart, end: nextEnd };
    setText(next);
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
          size={size}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={text}
          disabled={disabled}
          required={required}
          tabIndex={disabled ? -1 : 0}
          title={title || "Formato: MM-DD-YYYY. Escriba o use el calendario."}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
            commitText();
          }}
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
        value={iso}
        onChange={(e) => {
          const next = e.target.value;
          const input = e.currentTarget;
          emitIso(next);
          if (!next) {
            setText("");
          } else {
            const disp = formatDateForDisplay(next);
            if (disp !== "-") setText(disp);
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
 * Campo de fecha con calendario nativo, pero visual fijo MM-DD-YYYY.
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
