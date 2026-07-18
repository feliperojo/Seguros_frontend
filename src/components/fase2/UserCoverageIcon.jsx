// src/components/fase2/UserCoverageIcon.jsx
import React from "react";
import { formatDateForDisplay } from "../../utils/formatters";

const UserCoverageIcon = React.memo(function UserCoverageIcon({
  status,
  size = 28,
  className = "",
  style,
  showCheck: showCheckProp,
  color: colorProp,
  title = "Estado de cobertura",
  // 🔹 props para la lógica
  fechaRetiro,
  fechaCancelacion,
  fechaActivacion,   // 👈 NUEVO
  fueRenovado = false,
}) {
  const normalizedStatus = String(status || "").toLowerCase();
  const hasRetiro = !!fechaRetiro;
  const hasCancel = !!fechaCancelacion;

  const shortDate = (d) => {
    if (!d) return "";
    const s = String(d).slice(0, 10);
    const formatted = formatDateForDisplay(s);
    return formatted === "-" ? "" : formatted;
  };

  /* ================== COLOR ================== */
  let color = colorProp;

  if (!color) {
    if (fueRenovado) {
      // Color del estado real (no azul de “renovación”)
      color = hasCancel ? "#ffc107" : "#6c757d";
    } else if (hasRetiro) {
      // RETIRADO
      color = "#6c757d"; // gris
    } else if (hasCancel && !hasRetiro) {
      // CANCELADO (cuando hay cancelación y NO hay retiro)
      color = "#ffc107"; // amarillo
    } else if (normalizedStatus === "sí") {
      // ACTIVO
      color = "#1aa860"; // verde
    } else if (
      normalizedStatus === "no" ||
      normalizedStatus === "medicare" ||
      normalizedStatus === "medicaid"
    ) {
      // INACTIVO / MEDICARE / MEDICAID sin cancel ni retiro
      color = "#dc3545"; // rojo
    } else if (!status || status === "") {
      // SIN DATO
      color = "#6c757d"; // gris
    } else {
      color = "#6c757d";
    }
  }

  /* ================== CHECK ================== */
  const showCheck =
    typeof showCheckProp === "boolean"
      ? showCheckProp
      : !hasRetiro && !hasCancel && normalizedStatus === "sí";

  /* ================== ETIQUETA ================== */
  let label = "";

  if (fueRenovado) {
    label = hasCancel ? "Cancelado - Renovado" : "Retirado - Renovado";
  } else if (hasRetiro) {
    // Prioridad 1: Si tiene fecha de retiro → Retirado
    label = "Retirado";
  } else if (hasCancel && !hasRetiro) {
    // Prioridad 2: Si tiene fecha de cancelación y NO tiene retiro → Cancelado
    label = "Cancelado";
  } else if (normalizedStatus === "sí") {
    label = "Vigente";
  } else if (
    normalizedStatus === "no" ||
    normalizedStatus === "medicare" ||
    normalizedStatus === "medicaid"
  ) {
    if (normalizedStatus === "medicare") {
      label = "Medicare";
    } else if (normalizedStatus === "medicaid") {
      label = "Medicaid";
    } else {
      label = "Sin cobertura";
    }
  } else if (!status || status === "") {
    label = "Sin estado";
  }

  /* ================== FECHA A MOSTRAR ================== */
  let dateLabel = "";

  if (hasRetiro && fechaRetiro) {
    // 👇 prioridad total cuando está retirado
    dateLabel = `${shortDate(fechaRetiro)}`;
  } else if (!hasRetiro && hasCancel && fechaCancelacion) {
    // 👇 solo cancelación cuando no hay retiro
    dateLabel = `${shortDate(fechaCancelacion)}`;
  } else if (
    !hasRetiro &&
    !hasCancel &&
    normalizedStatus === "sí" &&
    fechaActivacion
  ) {
    // 👇 solo activación cuando está activo sin retiro ni cancelación
    dateLabel = `${shortDate(fechaActivacion)}`;
  }

  /* ================== LAYOUT ================== */
  const wrapperStyle = {
    width: size,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    ...style,
  };

  const iconWrapperStyle = {
    position: "relative",
    width: size,
    height: size * 0.86,
  };

  return (
    <div
      className={`${className || ""}`}
      style={wrapperStyle}
      role="img"
      aria-label={title}
      title={title}
    >
      {/* Icono de usuario */}
      <div style={iconWrapperStyle}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          style={{ display: "block" }}
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="3.25" stroke={color} strokeWidth="1.8" />
          <path
            d="M5 19c1.5-3 4.2-4.2 7-4.2S17.5 16 19 19"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Check (si aplica) */}
        {showCheck && (
          <svg
            className="position-absolute"
            width={size * 0.4}
            height={size * 0.4}
            viewBox="0 0 24 24"
            style={{
              left: size * 0.65,
              top: size * -0.1,
            }}
            aria-hidden="true"
          >
            <path
              d="M20 6L9 17l-5-5"
              fill="none"
              stroke={color}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Etiqueta + fecha bajo el icono */}
      {(label || dateLabel) && (
        <div
          className="text-muted small text-center"
          style={{ fontSize: size * 0.3, lineHeight: 1.15 }}
        >
          {label && <div>{label}</div>}
          {dateLabel && <div>{dateLabel}</div>}
        </div>
      )}
    </div>
  );
});

export default UserCoverageIcon;
