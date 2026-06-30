export const getCurrentYear = () => new Date().getFullYear();

export const isValidYearName = (nombre = "") => /^(19|20)\d{2}$/.test(String(nombre).trim());

export const parseYear = (nombre = "") => {
  const trimmed = String(nombre).trim();
  return isValidYearName(trimmed) ? parseInt(trimmed, 10) : null;
};

export const getRootFolder = (carpeta, carpetas = []) => {
  if (!carpeta) return null;

  let actual = carpeta;
  const lista = Array.isArray(carpetas) ? carpetas : [];

  while (actual) {
    const parentId = actual.parent_id ?? actual.parentId ?? null;
    if (!parentId) return actual;
    actual = lista.find((c) => c.id === parentId);
    if (!actual) break;
  }

  return carpeta;
};

export const requiresSuperPasswordForYear = (year, transitionMode = false) => {
  if (transitionMode) return false;
  if (year == null) return false;
  return year < getCurrentYear();
};

export const requiresSuperPasswordForFolder = (carpeta, carpetas = [], transitionMode = false) => {
  const root = getRootFolder(carpeta, carpetas);
  const year = parseYear(root?.nombre);
  return requiresSuperPasswordForYear(year, transitionMode);
};

export const isYearControlledRootName = (nombre = "") => isValidYearName(String(nombre).trim());

export const validarNombreCarpetaRaiz = (nombre, transitionMode = false) => {
  const trimmed = String(nombre || "").trim();

  if (!trimmed) {
    return "El nombre de la carpeta es requerido.";
  }

  if (trimmed.toLowerCase() === "eliminados") {
    return 'El nombre "Eliminados" está reservado por el sistema.';
  }

  const year = parseYear(trimmed);

  // Nombres libres (ej: soportes): sin restricción de año.
  if (year === null) {
    return null;
  }

  if (requiresSuperPasswordForYear(year, transitionMode)) {
    return { needsSuperPassword: true, year };
  }

  return null;
};
