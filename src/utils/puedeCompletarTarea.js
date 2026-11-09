function idUsuarioPositivo(valor) {
  if (typeof valor === "number") {
    return Number.isSafeInteger(valor) && valor > 0 ? valor : null;
  }
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  if (!/^\d+$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

function idResponsable(tarea) {
  if (tarea == null || typeof tarea !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(tarea, "assigned_user_id")) {
    return idUsuarioPositivo(tarea.assigned_user_id);
  }
  return (
    idUsuarioPositivo(tarea.assigned_user?.id) ??
    idUsuarioPositivo(tarea.assign_to_user?.id) ??
    idUsuarioPositivo(tarea.assign_to_user_id)
  );
}

export function puedeCompletarTarea(usuario, tarea) {
  const usuarioId = idUsuarioPositivo(usuario?.id ?? usuario?.user_id ?? usuario?.userId);
  const responsableId = idResponsable(tarea);
  return usuarioId != null && responsableId != null && usuarioId === responsableId;
}
