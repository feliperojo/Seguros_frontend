/**
 * Normaliza valores de cliente guardados en BD (variantes EN/ES, mayúsculas, typos)
 * hacia los valores canónicos de los <select> del formulario.
 */

import { STATUS_MIGRATORIO_OPTIONS } from "../constants/statusMigratorio";

const GENERO_SELECT_VALUES = ["Masculino", "Femenino", "Otro"];

const GENERO_ALIASES = {
  female: "Femenino",
  f: "Femenino",
  femenino: "Femenino",
  mujer: "Femenino",
  woman: "Femenino",
  male: "Masculino",
  m: "Masculino",
  masculino: "Masculino",
  hombre: "Masculino",
  man: "Masculino",
  other: "Otro",
  otro: "Otro",
  "non-binary": "Otro",
  nonbinary: "Otro",
};

/** @type {Record<string, string>} clave normalizada → valor canónico del select */
const STATUS_ALIASES = {
  // Citizen
  citizen: "Citizen",
  ciudadano: "Citizen",
  "us citizen": "Citizen",
  "u.s. citizen": "Citizen",
  citizenship: "Citizen",
  // Permanent Resident / Resident
  "permanent resident": "Permanent Resident",
  "permanet resident": "Permanent Resident",
  "legal permanent resident": "Permanent Resident",
  lpr: "Permanent Resident",
  "green card": "Permanent Resident",
  resident: "Resident",
  residente: "Resident",
  // EAD
  "ead (employment authorization document)": "EAD (Employment Authorization Document)",
  ead: "EAD (Employment Authorization Document)",
  "employment authorization document": "EAD (Employment Authorization Document)",
  "employment authorization": "EAD (Employment Authorization Document)",
  "work permit": "EAD (Employment Authorization Document)",
  "permit to work": "EAD (Employment Authorization Document)",
  "p. trabajo": "EAD (Employment Authorization Document)",
  "p trabajo": "EAD (Employment Authorization Document)",
  // I-797 / I797C
  "i-797": "I-797",
  i797: "I-797",
  i797c: "I797C",
  // I-485 / I-589 / I-862
  i485: "I485",
  "i-485": "I485",
  "i-589 asylum": "I-589 ASILUM",
  "i-589 asilum": "I-589 ASILUM",
  i589: "I-589 ASILUM",
  asylum: "I-589 ASILUM",
  "i-862": "I-862",
  i862: "I-862",
  // Visas
  "visa f1": "VISA F1",
  f1: "VISA F1",
  estudiante: "VISA F1",
  student: "VISA F1",
  "visa f2": "VISA F2",
  f2: "VISA F2",
  "visa j1": "VISA J1",
  "visa j": "VISA J1",
  j1: "VISA J1",
  "visa j-1": "VISA J1",
  "visa j2": "VISA J2",
  j2: "VISA J2",
  "visa e2": "VISA E2",
  "visa e-2": "VISA E2",
  e2: "VISA E2",
  "visa tn": "VISA TN",
  tn: "VISA TN",
  "visa r td": "VISA R TD",
  "visa r-td": "VISA R TD",
  // Otros / legacy
  otro: "OTRO",
  other: "OTRO",
  tps: "OTRO",
  "i-94": "OTRO",
  i94: "OTRO",
  "visa k1": "OTRO",
  "visa k-1": "OTRO",
  k1: "OTRO",
};

function normKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function compactKey(value) {
  return normKey(value).replace(/[.\-()]/g, "").replace(/\s+/g, "");
}

function matchSelectOption(value, options) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const exact = options.find((opt) => opt.toLowerCase() === raw.toLowerCase());
  return exact ?? "";
}

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function normalizeGeneroForSelect(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const fromSelect = matchSelectOption(raw, GENERO_SELECT_VALUES);
  if (fromSelect) return fromSelect;

  const key = normKey(raw);
  if (GENERO_ALIASES[key]) return GENERO_ALIASES[key];

  if (key.includes("fem") || key === "f") return "Femenino";
  if (key.includes("masc") || key === "m") return "Masculino";

  return raw;
}

/**
 * @param {string|null|undefined} value
 * @returns {string} Valor canónico del select de estatus migratorio
 */
export function normalizeStatusMigratorioForSelect(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const fromSelect = matchSelectOption(raw, STATUS_MIGRATORIO_OPTIONS);
  if (fromSelect) return fromSelect;

  const key = normKey(raw);
  if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];

  const compact = compactKey(raw);
  for (const [alias, mapped] of Object.entries(STATUS_ALIASES)) {
    if (compactKey(alias) === compact) return mapped;
  }

  // Coincidencia parcial por prefijo (ej. "Citizen " extra)
  for (const opt of STATUS_MIGRATORIO_OPTIONS) {
    if (compactKey(opt) === compact) return opt;
  }

  return raw;
}
