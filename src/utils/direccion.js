export const buildDireccion = (src) =>
  [src.calle, src.apto, src.ciudad, src.condado, src.estado, src.codigo_postal]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeDireccion = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const resolveClienteDireccion = (cliente = {}) => {
  const built = buildDireccion(cliente);
  if (built) return built;

  const stored = String(cliente?.direccion || "")
    .replace(/\s+/g, " ")
    .trim();
  if (stored) return stored;

  return String(cliente?.dir_correspondencia || "")
    .replace(/\s+/g, " ")
    .trim();
};
