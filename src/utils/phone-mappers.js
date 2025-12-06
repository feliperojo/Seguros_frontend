// src/utils/phone-mappers.js
import countryCodes from "../services/countryCodes";

const codeToIso = new Map(countryCodes.map(c => [String(c.code).replace(/\D+/g, ""), c.iso]));
const isoToCode = new Map(countryCodes.map(c => [String(c.iso).toLowerCase(), String(c.code).replace(/\D+/g, "")]));

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;

// --- ya la tienes ---
export function fromApiPhones(arr = [], fallbackIso = "co") {
  if (!Array.isArray(arr)) return [];
  return arr.map((p, i) => {
    // Validar que p no sea null o undefined
    if (!p || typeof p !== "object") {
      return {
        id: uid(),
        tipo: "Móvil",
        numero: "",
        principal: false,
        iso: fallbackIso,
        indicativo: ""
      };
    }
    const iso = String(p.iso || "").toLowerCase();
    const cc  = String(p.indicativo || "").replace(/\D+/g, "") || (isoToCode.get(iso) || "");
    return {
      id: p.id || uid(),
      tipo: p.tipo || "Móvil",
      numero: String(p.numero || ""),
      principal: !!p.principal,
      iso: iso || (codeToIso.get(cc) || fallbackIso),
      indicativo: cc
    };
  });
}

// ✅ nuevo: acepta array o string JSON y rellena iso/indicativo
export function inflatePhones(raw, fallbackIso = "co") {
  let base = [];
  if (Array.isArray(raw)) {
    // Filtrar valores null/undefined antes de procesar
    base = raw.filter(p => p != null);
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        base = parsed.filter(p => p != null);
      }
    } catch (_) { /* ignore */ }
  }

  const arr = fromApiPhones(base, fallbackIso);
  return arr.map(p => {
    if (!p || typeof p !== "object") {
      return {
        id: uid(),
        tipo: "Móvil",
        numero: "",
        principal: false,
        iso: fallbackIso,
        indicativo: ""
      };
    }
    let iso = (p.iso || "").toLowerCase();
    let indicativo = String(p.indicativo || "").replace(/\D+/g, "");
    if (!iso && indicativo) iso = (codeToIso.get(indicativo) || fallbackIso);
    if (!indicativo && iso) indicativo = (isoToCode.get(iso) || "");
    return { ...p, iso, indicativo };
  });
}

// ✅ nuevo: para enviar al backend
export function toApiPhones(phones = []) {
  const list = Array.isArray(phones) ? phones : [];
  return list.map(p => ({
    id: p.id,
    tipo: p.tipo || "Móvil",
    numero: String(p.numero || ""),
    principal: !!p.principal,
    iso: String(p.iso || "").toLowerCase(),
    indicativo: String(p.indicativo || "").replace(/\D+/g, "")
  }));
}
