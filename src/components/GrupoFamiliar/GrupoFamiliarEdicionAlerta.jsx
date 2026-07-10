import React from "react";

const formatHoraDesde = (iso) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const joinNames = (nombres) => {
  const list = (nombres || []).filter(Boolean);
  if (list.length === 0) return "Otro usuario";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} y ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} y ${list[list.length - 1]}`;
};

/** Reconstruye el mensaje con hora local del navegador (evita desfase UTC del servidor). */
export const buildEdicionMensaje = (edicion) => {
  if (!edicion) return null;

  if (edicion.tipo === "inactivo") {
    return edicion.mensaje;
  }

  const editores = edicion.editores ?? [];
  if (editores.length > 0) {
    const sujeto = joinNames(editores.map((e) => e.nombre));
    const hora = formatHoraDesde(editores[0]?.desde);

    if (hora && editores.length === 1) {
      return `${sujeto} tiene abierto este grupo familiar desde las ${hora}.`;
    }
    if (hora) {
      return `${sujeto} tienen abierto este grupo familiar (desde las ${hora}).`;
    }
    return `${sujeto} tiene abierto este grupo familiar.`;
  }

  return edicion.mensaje;
};

/**
 * Banner no invasivo: avisa si otro usuario está editando el grupo familiar.
 */
const GrupoFamiliarEdicionAlerta = ({ edicion }) => {
  const mensaje = buildEdicionMensaje(edicion);

  if (!edicion?.alerta || !mensaje) return null;

  const inactivo = edicion.tipo === "inactivo";

  return (
    <div
      className={`alert ${inactivo ? "alert-light border" : "alert-warning"} py-2 px-3 mb-3 d-flex align-items-start gap-2`}
      role="status"
      style={{ fontSize: "0.9rem" }}
    >
      <i
        className={`fas ${inactivo ? "fa-clock" : "fa-user-edit"} mt-1 flex-shrink-0`}
        aria-hidden="true"
      />
      <div>
        <div>{mensaje}</div>
        {!inactivo && (
          <div className="text-muted mt-1" style={{ fontSize: "0.82rem" }}>
            Solo se guardarán los campos que modifiques en este formulario.
          </div>
        )}
      </div>
    </div>
  );
};

export default GrupoFamiliarEdicionAlerta;
