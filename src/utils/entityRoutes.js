/**
 * Rutas de ficha/edición según el tipo de entidad en actividad de usuarios.
 */
export function getEntityPath(entityType, entityId) {
  if (!entityType || entityId == null || entityId === "") {
    return null;
  }

  const type = String(entityType).trim().toLowerCase();

  if (type === "cliente") {
    return `/clientes/${entityId}/ficha`;
  }

  if (type === "grupofamiliar") {
    return `/grupo_familiar/${entityId}`;
  }

  return null;
}

export function isEntityLinkable(entityType, entityId) {
  return Boolean(getEntityPath(entityType, entityId));
}
