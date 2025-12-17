/**
 * Utilidades para normalización y manejo de permisos
 * Compatible con permisos nuevos (module.action) y legacy (lenguaje natural)
 */

/**
 * Normaliza un permiso a formato estándar
 * - trim
 * - lowercase
 * - colapsa espacios múltiples
 * @param {string|object} permission - Permiso a normalizar (puede ser string o objeto con .slug o .name)
 * @returns {string} Permiso normalizado
 */
export const normalizePermission = (permission) => {
  if (!permission) return "";
  
  // Si es un objeto, extraer slug o name
  let permString = "";
  if (typeof permission === "object") {
    permString = permission.slug || permission.name || permission.permission || "";
  } else {
    permString = String(permission);
  }
  
  // Normalizar: trim, lowercase, colapsar espacios múltiples
  return permString
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
};

/**
 * Mapa de aliases para compatibilidad con permisos legacy
 * Los permisos legacy (ej: "manage users") habilitan los permisos nuevos correspondientes
 */
export const PERMISSION_ALIASES = {
  // Usuarios - legacy "manage users" habilita todos los permisos de usuarios
  "users.view": ["manage users", "view users"],
  "users.create": ["manage users", "create users"],
  "users.edit": ["manage users", "edit users", "users.update", "update users"],
  "users.disable": ["manage users", "disable users", "users.toggle-status", "toggle status", "users.toggle_status"],
  "users.assign_roles": ["manage users", "assign roles", "users.assign-roles", "users.assign_roles", "assign user roles"],
  
  // Roles - legacy "manage users" también habilita roles (comportamiento común)
  "roles.view": ["manage users", "view roles"],
  "roles.create": ["manage users", "create roles"],
  "roles.edit": ["manage users", "edit roles", "roles.update", "update roles"],
  "roles.delete": ["manage users", "delete roles"],
  "roles.assign_permissions": ["manage users", "assign permissions", "roles.manage-permissions", "roles.manage_permissions", "manage role permissions"],
  
  // Permisos - legacy "manage users" también habilita permisos
  "permissions.view": ["manage users", "view permissions"],
  "permissions.manage": ["manage users", "manage permissions"],
  
  // Tareas
  "tasks.view": ["view tasks"],
  "tasks.create": ["create tasks"],
  "tasks.edit": ["edit tasks"],
  "tasks.delete": ["delete tasks"],
  
  // Reportes
  "reports.view": ["view reports"],
};

/**
 * Obtiene todos los aliases posibles para un permiso
 * @param {string} permission - Permiso normalizado
 * @returns {string[]} Array de aliases (incluye el permiso original)
 */
export const getPermissionAliases = (permission) => {
  const normalized = normalizePermission(permission);
  const aliases = PERMISSION_ALIASES[normalized] || [];
  return [normalized, ...aliases];
};

/**
 * Verifica si un permiso tiene un alias específico
 * @param {string} permission - Permiso a verificar
 * @param {string} alias - Alias a buscar
 * @returns {boolean}
 */
export const hasAlias = (permission, alias) => {
  const aliases = getPermissionAliases(permission);
  return aliases.some(a => normalizePermission(a) === normalizePermission(alias));
};

/**
 * Normaliza un array de permisos (puede contener strings u objetos)
 * @param {Array} permissions - Array de permisos
 * @returns {string[]} Array de permisos normalizados
 */
export const normalizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  
  return permissions
    .map(normalizePermission)
    .filter(perm => perm !== ""); // Filtrar permisos vacíos
};

