import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  caretIndexFromDigitCount,
  countDigitsBeforeCaret,
  formatDateMMDDYYYY,
  formatMdySlashTyping,
  normalizeDateForInput,
  onlyDigits,
  parseMMDDYYYYToYmd,
} from "../../utils/formatters";

/**
 * Campo de fecha con texto MM/DD/YYYY, calendario nativo y valor interno YYYY-MM-DD.
 * Al escribir, los / se insertan solos (08182026 → 08/18/2026).
 */
export default function DateInputWithCalendar({
  valueIso = "",
  onChangeIso,
  disabled = false,
  size,
  minIso,
  maxIso,
  className = "",
  inputName,
  placeholder = "MM/DD/YYYY",
  title = "Seleccionar fecha",
  highlightWarning = false,
}) {
  const pickerRef = useRef(null);
  const textRef = useRef(null);
  const focusedRef = useRef(false);
  const pendingSelectionRef = useRef(null);
  const [displayText, setDisplayText] = useState("");

  const iso = normalizeDateForInput(valueIso);

  useEffect(() => {
    if (focusedRef.current) return;
    setDisplayText(iso ? formatDateMMDDYYYY(iso) : "");
  }, [iso]);

  useLayoutEffect(() => {
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
  }, [displayText]);

  const applyIso = (ymd) => {
    const normalized = ymd ? normalizeDateForInput(ymd) : "";
    onChangeIso?.(normalized);
    setDisplayText(normalized ? formatDateMMDDYYYY(normalized) : "");
  };

  const handleTextChange = (e) => {
    const inputEl = e.currentTarget;
    const raw = e.target.value;
    const selStart = inputEl?.selectionStart ?? raw.length;
    const selEnd = inputEl?.selectionEnd ?? raw.length;
    const next = formatMdySlashTyping(raw);
    pendingSelectionRef.current = {
      start: caretIndexFromDigitCount(next, countDigitsBeforeCaret(raw, selStart)),
      end: caretIndexFromDigitCount(next, countDigitsBeforeCaret(raw, selEnd)),
    };
    setDisplayText(next);

    const parsed = parseMMDDYYYYToYmd(next);
    if (parsed) {
      onChangeIso?.(parsed);
    } else if (!next) {
      onChangeIso?.("");
    }
  };

  const handleKeyDown = (e) => {
    const el = e.currentTarget;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start == null || end == null || start !== end) return;
    const v = el.value ?? "";

    if (e.key === "Backspace" && start > 0 && v[start - 1] === "/") {
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

    if (e.key === "Delete" && start < v.length && v[start] === "/") {
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

  const handleTextBlur = () => {
    focusedRef.current = false;
    const trimmed = displayText.trim();
    if (!trimmed) {
      applyIso("");
      return;
    }
    const parsed = parseMMDDYYYYToYmd(trimmed);
    if (parsed) {
      applyIso(parsed);
      return;
    }
    const digitCount = onlyDigits(trimmed).length;
    if (digitCount > 0 && digitCount < 8) {
      setDisplayText(iso ? formatDateMMDDYYYY(iso) : "");
      return;
    }
    setDisplayText(iso ? formatDateMMDDYYYY(iso) : "");
  };

  const handleCalendarChange = (e) => {
    applyIso(e.target.value);
  };

  const openPicker = () => {
    if (disabled) return;
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === "function") {
      picker.showPicker();
    } else {
      picker.click();
    }
  };

  const controlSize = size === "sm" ? "form-control-sm" : "";
  const btnSize = size === "sm" ? "btn-sm" : "";
  const warningInputClass = highlightWarning ? "bg-warning bg-opacity-10 border-warning" : "";
  const warningBtnClass = highlightWarning ? "btn-outline-warning" : "btn-outline-secondary";

  return (
    <div className={className}>
      <div className="input-group">
        <input
          ref={textRef}
          type="text"
          className={`form-control ${controlSize} ${warningInputClass}`.trim()}
          name={inputName}
          value={displayText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={handleTextBlur}
          disabled={disabled}
          placeholder={placeholder}
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          title="Formato: MM/DD/YYYY. Escriba o use el calendario."
        />
        <button
          type="button"
          className={`btn ${warningBtnClass} ${btnSize}`.trim()}
          onClick={openPicker}
          disabled={disabled}
          title={title}
          aria-label={title}
        >
          <i className="fas fa-calendar-alt" />
        </button>
        <input
          ref={pickerRef}
          type="date"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          value={iso}
          min={minIso ? normalizeDateForInput(minIso) : undefined}
          max={maxIso ? normalizeDateForInput(maxIso) : undefined}
          onChange={handleCalendarChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
