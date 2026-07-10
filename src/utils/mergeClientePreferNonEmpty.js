/**
 * Varias rutas GET `cliente/:id` devuelven el recurso en `data` y otras en la raíz
 * (p. ej. MainLayout y ContactosAdmin usan `detail?.data || detail`).
 */
export function unwrapClienteFromApi(res) {
  if (res == null || typeof res !== "object") return res ?? null;
  const d = res.data;
  if (d != null && typeof d === "object" && !Array.isArray(d)) {
    return d;
  }
  return res;
}

/**
 * Combina datos de cliente: base (p. ej. GET cliente/:id) + overlay (p. ej. miembro.cliente del API).
 * No pisa campos de base con null, undefined o strings solo espacio, para que un {} o payload
 * parcial del backend no borre nombre, género, etc.
 */
export function mergeClientePreferNonEmpty(base = {}, overlay = {}) {
  const out = { ...(base && typeof base === "object" ? base : {}) };
  if (!overlay || typeof overlay !== "object") return out;
  for (const [k, v] of Object.entries(overlay)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && !v.trim()) continue;
    out[k] = v;
  }
  return out;
}
