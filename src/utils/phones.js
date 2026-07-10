// utils/phones.js
import countryCodes from "../services/countryCodes";

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
 // utils/phones.js
export function normalizePhones(arr = [], formatFn) {
    return arr.map((p, i) => {
      const cleanIndic = String(p.indicativo ?? "").replace(/\D+/g, "");
      const cleanNum   = formatFn ? formatFn(p.numero ?? "") : (p.numero ?? "");
      return {
        id: p.id ?? `ph-${i}`,
        tipo: (p.tipo || "Móvil").trim(),
        numero: cleanNum,
        principal: !!p.principal,
        iso: (p.iso || "").toLowerCase(),
        indicativo: cleanIndic,
      };
    });
  }
  
  
  export function toStructuredPhones(legacy = {}) {
    const codeToIsoMap = new Map(
      countryCodes?.map?.((c) => [
        String(c.code || "").replace(/\D+/g, ""),
        String(c.iso || "").toLowerCase(),
      ]) ?? []
    );
    const codFor = (n) => String(legacy[`cod_tel_${n}`] || "").replace(/\D+/g, "");
    const isoForCod = (cod) => (cod ? codeToIsoMap.get(cod) || "" : "");

    const push = (id, tipo, numero, cod, principal) => {
      if (!numero) return;
      out.push({
        id,
        tipo,
        numero: String(numero),
        principal,
        iso: isoForCod(cod),
        indicativo: cod,
      });
    };

    const out = [];
    push("legacy-1", "Móvil", legacy.telefono, codFor(1), true);
    push("legacy-2", "Trabajo", legacy.secundario, codFor(2), !out.length);
    push("legacy-3", "Whatsapp", legacy.whatsapp_num, codFor(3), !out.length);
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
  