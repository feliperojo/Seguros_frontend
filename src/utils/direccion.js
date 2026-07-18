export const buildDireccion = (src) =>
  [src.calle, src.apto, src.ciudad, src.condado, src.estado, src.codigo_postal]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
