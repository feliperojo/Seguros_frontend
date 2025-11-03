// utils/phones.js

export function ensureOnePrimary(arr = []) {
    let seen = false;
    return (arr || []).map(p => {
      const next = { ...p, principal: !!p.principal };
      if (next.principal) {
        if (!seen) seen = true;
        else next.principal = false;
      }
      return next;
    });
  }
  
  export function normalizePhones(arr = [], formatFn) {
    const cleaned = (Array.isArray(arr) ? arr : []).map((p, i) => ({
      id: p.id ?? `${i}-${p.tipo ?? ""}-${p.numero ?? ""}`,
      tipo: (p.tipo || "").trim() || "Móvil",
      numero: formatFn ? formatFn(String(p.numero || "")) : String(p.numero || "").trim(),
      principal: !!p.principal
    }));
    return ensureOnePrimary(cleaned);
  }
  
  export function toStructuredPhones(legacy = {}) {
    const out = [];
    if (legacy.telefono) out.push({ id: "legacy-1", tipo: "Móvil", numero: String(legacy.telefono), principal: true });
    if (legacy.secundario) out.push({ id:"legacy-2", tipo:"Trabajo", numero:String(legacy.secundario), principal: !out.length });
    if (legacy.whatsapp_num) out.push({ id:"legacy-3", tipo:"Whatsapp", numero:String(legacy.whatsapp_num), principal: !out.length });
    return ensureOnePrimary(out);
  }
  
  export function toLegacyFields(phones = []) {
    const arr = Array.isArray(phones) ? phones : [];
    const principal = arr.find(p => p.principal)?.numero || "";
    const movil = arr.find(p => (p.tipo || "").toLowerCase().includes("móvil"))?.numero || "";
    const trabajo = arr.find(p => (p.tipo || "").toLowerCase().includes("trabajo"))?.numero || "";
    const whatsapp = arr.find(p => (p.tipo || "").toLowerCase().includes("whatsapp"))?.numero || "";
    return {
      telefono: movil || principal || "",
      secundario: trabajo || "",
      whatsapp_num: whatsapp || "",
      principal
    };
  }
  