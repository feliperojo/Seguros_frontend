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

const frasePresencia = (personas, accion, hora) => {
  const sujeto = joinNames(personas.map((e) => e.nombre));
  const verbo = personas.length === 1 ? "está" : "están";

  if (hora && personas.length === 1) {
    return `${sujeto} ${verbo} ${accion} este grupo familiar desde las ${hora}.`;
  }
  if (hora) {
    return `${sujeto} ${verbo} ${accion} este grupo familiar (desde las ${hora}).`;
  }
  return `${sujeto} ${verbo} ${accion} este grupo familiar.`;
};

/** Reconstruye el mensaje con hora local del navegador (evita desfase UTC del servidor). */
export const buildEdicionMensaje = (edicion) => {
  if (!edicion) return null;

  if (edicion.tipo === "inactivo") {
    return edicion.mensaje;
  }

  const editores = edicion.editores ?? [];
  if (editores.length > 0) {
    const editando = editores.filter((e) => e.modo === "editando");
    const viendo = editores.filter((e) => e.modo !== "editando");
    const hora = formatHoraDesde(editores[0]?.desde);

    if (editando.length > 0 && viendo.length > 0) {
      const verboEdita = editando.length === 1 ? "está" : "están";
      const verboVe = viendo.length === 1 ? "está" : "están";
      return `${joinNames(editando.map((e) => e.nombre))} ${verboEdita} editando este grupo familiar. ${joinNames(viendo.map((e) => e.nombre))} ${verboVe} solo visualizando.`;
    }

    if (editando.length > 0) {
      return frasePresencia(editando, "editando", hora);
    }

    return frasePresencia(viendo, "visualizando", hora);
  }

  return edicion.mensaje;
};

export const otroUsuarioEstaEditando = (edicion) => {
  if (!edicion) return false;
  if (edicion.bloquea_edicion === true) return true;
  return (edicion.editores ?? []).some(
    (editor) => editor.modo === "editando" && editor.activo !== false
  );
};

/**
 * Banner no invasivo al abrir el grupo: avisa si otro usuario lo tiene abierto.
 * No bloquea el guardado (eso lo maneja el toast de conflicto al Guardar).
 */
const GrupoFamiliarEdicionAlerta = ({ edicion }) => {
  const mensaje = buildEdicionMensaje(edicion);

  if (!edicion?.alerta || !mensaje) return null;

  const inactivo = edicion.tipo === "inactivo";
  const editando = otroUsuarioEstaEditando(edicion);
  const varios = (edicion.editores ?? []).length > 1;

  return (
    <div
      className={`alert ${inactivo ? "alert-light border" : "alert-warning"} py-2 px-3 mb-3 d-flex align-items-start gap-2`}
      role="status"
      style={{ fontSize: "0.9rem" }}
    >
      <i
        className={`fas ${inactivo ? "fa-clock" : editando ? "fa-user-edit" : "fa-eye"} mt-1 flex-shrink-0`}
        aria-hidden="true"
      />
      <div>
        <div>{mensaje}</div>
        {!inactivo && (
          <div className="text-muted mt-1" style={{ fontSize: "0.82rem" }}>
            {editando
              ? `Mientras ${varios ? "estén editando" : "esté editando"}, el botón Editar permanece inactivo para no pisar sus cambios.`
              : `${varios ? "Están" : "Está"} solo visualizando. Puedes editar y guardar con normalidad.`}
          </div>
        )}
      </div>
    </div>
  );
};

export default GrupoFamiliarEdicionAlerta;
