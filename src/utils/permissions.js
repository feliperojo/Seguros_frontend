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
  // Manejar explícitamente cuando slug es null (usar name en su lugar)
  let permString = "";
  if (typeof permission === "object") {
    // Si slug existe y no es null/undefined, usarlo; si no, usar name
    permString = (permission.slug != null && permission.slug !== "") 
      ? permission.slug 
      : (permission.name || permission.permission || "");
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
 * Mapa de aliases para compatibilidad con permisos legacy y diferentes formatos
 * Mapea entre formatos del backend (users.read, users.update) y frontend (users.view, users.edit)
 * Los permisos legacy (ej: "manage users") habilitan los permisos nuevos correspondientes
 */
export const PERMISSION_ALIASES = {
  // Usuarios - mapeo entre backend (read/update) y frontend (view/edit)
  "users.view": ["users.read", "manage users", "view users"],
  "users.read": ["users.view", "manage users", "view users"], // Bidireccional
  "users.create": ["manage users", "create users"],
  "users.edit": ["users.update", "manage users", "edit users", "update users"],
  "users.update": ["users.edit", "manage users", "edit users", "update users"], // Bidireccional
  "users.delete": ["manage users", "delete users"],
  "users.disable": ["manage users", "disable users", "users.toggle-status", "toggle status", "users.toggle_status"],
  "users.assign_roles": ["manage users", "assign roles", "users.assign-roles", "users.assign_roles", "assign user roles"],
  
  // Roles - mapeo entre backend (read/update) y frontend (view/edit)
  "roles.view": ["roles.read", "manage users", "view roles"],
  "roles.read": ["roles.view", "manage users", "view roles"], // Bidireccional
  "roles.create": ["manage users", "create roles"],
  "roles.edit": ["roles.update", "manage users", "edit roles", "update roles"],
  "roles.update": ["roles.edit", "manage users", "edit roles", "update roles"], // Bidireccional
  "roles.delete": ["manage users", "delete roles"],
  "roles.assign_permissions": ["manage users", "assign permissions", "roles.manage-permissions", "roles.manage_permissions", "manage role permissions"],
  
  // Permisos - mapeo entre backend (read) y frontend (view)
  "permissions.view": ["permissions.read", "manage users", "view permissions"],
  "permissions.read": ["permissions.view", "manage users", "view permissions"], // Bidireccional
  "permissions.create": ["manage users", "create permissions"],
  "permissions.update": ["permissions.edit", "manage users", "edit permissions", "update permissions"],
  "permissions.edit": ["permissions.update", "manage users", "edit permissions", "update permissions"], // Bidireccional
  "permissions.delete": ["manage users", "delete permissions"],
  "permissions.manage": ["manage users", "manage permissions"],
  
  // Auditoría
  "audit.view": ["audit.read", "view audit", "view audit logs"],
  "audit.read": ["audit.view", "view audit", "view audit logs"], // Bidireccional
  
  // Tareas
  "tasks.view": ["tasks.read", "view tasks"],
  "tasks.read": ["tasks.view", "view tasks"], // Bidireccional
  "tasks.create": ["create tasks"],
  "tasks.edit": ["tasks.update", "edit tasks", "update tasks"],
  "tasks.update": ["tasks.edit", "edit tasks", "update tasks"], // Bidireccional
  "tasks.delete": ["delete tasks"],
  
  // Reportes
  "reports.view": ["reports.read", "view reports"],
  "reports.read": ["reports.view", "view reports"], // Bidireccional
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

