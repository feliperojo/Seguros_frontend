// src/utils/phone-mappers.js
import countryCodes from "../services/countryCodes";
import { toStructuredPhones } from "./phones";

const codeToIso = new Map();
countryCodes.forEach((c) => {
  const code = String(c.code).replace(/\D+/g, "");
  const iso = String(c.iso || "").toLowerCase();
  if (!codeToIso.has(code) || iso === "us") {
    codeToIso.set(code, iso);
  }
});
const isoToCode = new Map(
  countryCodes.map((c) => [
    String(c.iso || "").toLowerCase(),
    String(c.code || "").replace(/\D+/g, ""),
  ])
);

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const cleanIndicativo = (v) => String(v ?? "").replace(/\D+/g, "");

/** Extrae indicativo desde campos posibles en BD/API */
export function extractIndicativo(p = {}) {
  return cleanIndicativo(
    p.indicativo ?? p.cod_tel ?? p.country_code ?? p.codigo ?? ""
  );
}

export function extractIso(p = {}) {
  return String(p.iso || "").toLowerCase();
}

/**
 * Sincroniza iso ↔ indicativo.
 * El fallback solo aplica cuando applyFallback=true (teléfonos nuevos vacíos).
 */
export function resolveIsoIndic(
  iso = "",
  indicativo = "",
  fallbackIso = "us",
  applyFallback = false
) {
  let outIso = String(iso || "").toLowerCase();
  let outInd = cleanIndicativo(indicativo);

  if (!outIso && outInd) outIso = codeToIso.get(outInd) || "";
  if (!outInd && outIso) outInd = isoToCode.get(outIso) || "";

  if (applyFallback && !outIso && !outInd) {
    outIso = fallbackIso;
    outInd = isoToCode.get(outIso) || "";
  }

  return { iso: outIso, indicativo: outInd };
}

/** Completa indicativo faltante desde cod_tel_1/2/3 legacy del cliente */
function mergeLegacyCodTelIntoPhones(phones = [], source = {}, fallbackIso = "us") {
  const codBySlot = [
    source.cod_tel_1,
    source.cod_tel_2,
    source.cod_tel_3,
  ].map((c) => cleanIndicativo(c));

  return phones.map((p, i) => {
    const existingInd = extractIndicativo(p);
    const existingIso = extractIso(p);

    if (existingInd) {
      const synced = resolveIsoIndic(existingIso, existingInd, "us", false);
      return { ...p, iso: synced.iso, indicativo: synced.indicativo };
    }

    const tipo = String(p.tipo || "").toLowerCase();
    let cod = "";
    if (/whatsapp/.test(tipo)) cod = codBySlot[2];
    else if (/trabajo/.test(tipo)) cod = codBySlot[1];
    else if (p.principal || /móvil|movil/.test(tipo) || i === 0) cod = codBySlot[0];
    else if (i < codBySlot.length) cod = codBySlot[i];

    if (!cod) {
      if (String(p.numero || "").trim() && !existingIso) {
        const synced = resolveIsoIndic("", "", fallbackIso, true);
        return { ...p, iso: synced.iso, indicativo: synced.indicativo };
      }
      return p;
    }

    const synced = resolveIsoIndic("", cod, "us", false);
    return { ...p, iso: synced.iso, indicativo: synced.indicativo };
  });
}

export function fromApiPhones(arr = [], fallbackIso = "us") {
  if (!Array.isArray(arr)) return [];
  return arr.map((p) => {
    if (!p || typeof p !== "object") {
      return {
        id: uid(),
        tipo: "Móvil",
        numero: "",
        principal: false,
        iso: fallbackIso,
        indicativo: isoToCode.get(fallbackIso) || "",
      };
    }

    const numero = String(p.numero || "");
    const isoRaw = extractIso(p);
    const ccRaw = extractIndicativo(p);
    const hasCountryInfo = !!ccRaw || !!isoRaw;

    const { iso, indicativo } = resolveIsoIndic(
      isoRaw,
      ccRaw,
      fallbackIso,
      !hasCountryInfo
    );

    return {
      id: p.id || uid(),
      tipo: p.tipo || "Móvil",
      numero,
      principal: !!p.principal,
      iso,
      indicativo,
    };
  });
}

export function inflatePhones(raw, fallbackIso = "us") {
  let base = [];
  if (Array.isArray(raw)) {
    base = raw.filter((p) => p != null);
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        base = parsed.filter((p) => p != null);
      }
    } catch (_) {
      /* ignore */
    }
  }

  return fromApiPhones(base, fallbackIso).map((p) => {
    if (!p || typeof p !== "object") return p;
    const synced = resolveIsoIndic(
      extractIso(p),
      extractIndicativo(p),
      fallbackIso,
      !extractIndicativo(p) && !extractIso(p)
    );
    return { ...p, iso: synced.iso, indicativo: synced.indicativo };
  });
}

/**
 * Resuelve teléfonos para UI: array JSON/BD → formato TelefonosPro;
 * si el arreglo está vacío, reconstruye desde telefono/secundario/whatsapp_num legacy.
 */
export function resolveClienteTelefonos(source = {}, fallbackIso = "us") {
  const raw = source?.telefonos ?? source?.phones ?? null;
  let list = inflatePhones(raw, fallbackIso);

  if (!list.length) {
    list = inflatePhones(
      toStructuredPhones({
        telefono: source?.telefono,
        secundario: source?.secundario,
        whatsapp_num: source?.whatsapp_num,
        cod_tel_1: source?.cod_tel_1,
        cod_tel_2: source?.cod_tel_2,
        cod_tel_3: source?.cod_tel_3,
      }),
      fallbackIso
    );
  } else {
    list = mergeLegacyCodTelIntoPhones(list, source, fallbackIso);
  }

  return list;
}

export function toApiPhones(phones = []) {
  const list = Array.isArray(phones) ? phones : [];
  return list.map((p) => ({
    id: p.id,
    tipo: p.tipo || "Móvil",
    numero: String(p.numero || ""),
    principal: !!p.principal,
    iso: String(p.iso || "").toLowerCase(),
    indicativo: cleanIndicativo(p.indicativo),
  }));
}
