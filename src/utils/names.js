// Convierte la primera letra de cada palabra en mayúscula y el resto en minúscula
function toTitleCase(str = "") {
    return str
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }

/** Nombre para mostrar: primera letra en mayúscula, resto en minúscula (soporta acentos). */
export function formatDisplayName(str = "") {
  const t = String(str || "").trim();
  if (!t) return "";
  return t
    .toLowerCase()
    .replace(/(^|\s|['-])(\p{L})/gu, (_, pre, c) => pre + c.toUpperCase());
}
  
  // Une nombres y apellidos en un solo string bien formateado
  export function joinNameParts(nombres = "", apellidos = "") {
    const full = [nombres, apellidos].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    return toTitleCase(full);
  }
  
  // Separa un nombre completo en nombres y apellidos, aplicando capitalización
  export function splitFullName(full = "") {
    const parts = (full || "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  
    if (parts.length === 0) return { nombres: "", apellidos: "" };
    if (parts.length === 1)
      return { nombres: toTitleCase(parts[0]), apellidos: "" };
    if (parts.length === 2)
      return {
        nombres: toTitleCase(parts[0]),
        apellidos: toTitleCase(parts[1]),
      };
  
    // 3+ palabras → las dos últimas son apellidos
    const apellidos = parts.slice(-2).join(" ");
    const nombres = parts.slice(0, -2).join(" ");
    return {
      nombres: toTitleCase(nombres),
      apellidos: toTitleCase(apellidos),
    };
  }
  