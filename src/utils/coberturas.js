// utils/coberturas.js
export const getCoberturaId = (m = {}) =>
    m.cobertura_id ?? m?.cobertura?.id ?? m?.id_cobertura ?? null;
  
  const isTomador = (m = {}) => {
    const v1 = String(m.tipo || "").toLowerCase();
    const v2 = String(m.parentesco || "").toLowerCase();
    return v1 === "tomador" || v2 === "tomador";
  };
  
  export const canDeleteMember = (member, { readOnly = false } = {}) => {
    if (readOnly) return false;
    if (isTomador(member)) return false;            // 🚫 seguridad: no borrar tomador
    // Permitimos borrar locales y remotos
    return true;
  };
  
  export async function deleteCoberturaFlow(
    member,
    { service, removeLocal, confirmFn = (nombre) => window.confirm(`¿Eliminar la cobertura de "${nombre}"?`) }
  ) {
    const covId = getCoberturaId(member);
    const nombre =
      member.nombreCompleto ||
      member?.cliente?.nombre_completo ||
      [member.primer_nombre, member.segundo_nombre, member.apellidos].filter(Boolean).join(" ") ||
      "miembro";
  
    if (!confirmFn(nombre)) return false;
  
    if (covId) {
      await service.deleteCobertura(covId);         // 🔌 DELETE /cobertura/{id}
    }
    removeLocal(member.id);                          // 🧼 quita del estado
    return true;
  }
  