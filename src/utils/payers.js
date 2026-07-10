// utils/payers.js
/** fullName compatible con tu normalización */
export function fullNameFromMember(m) {
    const c = m?.cliente ?? m ?? {};
    const composed = [c.primer_nombre?.trim(), c.segundo_nombre?.trim(), c.apellidos?.trim()]
      .filter(Boolean).join(" ");
    return composed || c.nombre_completo || m?.nombreCompleto || "Sin nombre";
  }
  
  /**
   * Genera opciones únicas de pagador
   * @param {Array} normalizedMembers -> miembros normalizados (root + cliente)
   * @returns [{ value: cliente_id, label: 'Nombre' }]
   */
  export function buildPayerOptions(normalizedMembers = []) {
    // Solo miembros con cliente válido y (opcional) activos
    const valid = normalizedMembers.filter(m => m?.cliente?.id || m?.cliente_id);
    // Colapsamos por cliente_id
    const map = new Map();
    for (const m of valid) {
      const id = m?.cliente?.id ?? m?.cliente_id;
      if (!id) continue;
      if (!map.has(id)) {
        map.set(id, { value: id, label: fullNameFromMember(m) });
      }
    }
    return Array.from(map.values());
  }
  