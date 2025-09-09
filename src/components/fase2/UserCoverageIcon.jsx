import React from "react";



const UserCoverageIcon = React.memo(function UserCoverageIcon({
  status,
  size = 28,
  className = "",
  style,
  showCheck: showCheckProp,
  color: colorProp,
  title = "Estado de cobertura",
}) {
  // Decidir color por estado si no te pasan color
  let color = colorProp;
  if (!color) {
    if (status === "Sí") color = "#1aa860";      // verde
    else if (!status || status === "") color = "#6c757d"; // gris
    else color = "#dc3545";                       // rojo
  }

  // Decidir si mostrar check si no te lo pasan
  let showCheck = typeof showCheckProp === "boolean"
    ? showCheckProp
    : status === "Sí";

  // Ajustes de layout del wrapper
  const wrapperStyle = {
    width: size,
    height: size * 0.86, // relación que imitaba el mock
    ...style,
  };

  return (
    <div
      className={`position-relative ${className || ""}`}
      style={wrapperStyle}
      role="img"
      aria-label={title}
      title={title}
    >
      {/* Usuario (cabeza + hombros) */}
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
    width={size * 0.40}   // un poco más pequeño que antes
    height={size * 0.40}
    viewBox="0 0 24 24"
    style={{
      left: size * 0.65,  // lo mueve más a la derecha
      top: size * -0.10,  // lo sube un poco más
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
  );
});

export default UserCoverageIcon;
