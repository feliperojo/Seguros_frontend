import React, { useEffect, useRef, useState } from "react";
import {
  formatDateMMDDYYYY,
  normalizeDateForInput,
  parseMMDDYYYYToYmd,
} from "../../utils/formatters";

/**
 * Campo de fecha con texto MM/DD/YYYY, calendario nativo y valor interno YYYY-MM-DD.
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
  const [displayText, setDisplayText] = useState("");

  const iso = normalizeDateForInput(valueIso);

  useEffect(() => {
    setDisplayText(iso ? formatDateMMDDYYYY(iso) : "");
  }, [iso]);

  const applyIso = (ymd) => {
    const normalized = ymd ? normalizeDateForInput(ymd) : "";
    onChangeIso?.(normalized);
    setDisplayText(normalized ? formatDateMMDDYYYY(normalized) : "");
  };

  const handleTextChange = (e) => {
    setDisplayText(e.target.value);
  };

  const handleTextBlur = () => {
    applyIso(parseMMDDYYYYToYmd(displayText));
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
          type="text"
          className={`form-control ${controlSize} ${warningInputClass}`.trim()}
          name={inputName}
          value={displayText}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          disabled={disabled}
          placeholder={placeholder}
          inputMode="numeric"
          autoComplete="off"
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
