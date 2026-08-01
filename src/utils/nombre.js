export const buildNombreCompleto = (src = {}) =>
  [src.primer_nombre, src.segundo_nombre, src.apellidos]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
