// apiMappers.js
import { normalizePhones } from "../utils/phones";
import { formatPhone334 } from "../utils/formatters";
import { parseMoney } from "../services/ingresos";

export function normalizeMemberForApi(m) {
  // Convierte posibles strings a Number, deja null si procede
  const ingresoAnual =
    typeof m.ingreso_anual === "number"
      ? m.ingreso_anual
      : parseMoney(m.ingreso_anual);

  const ingresoPorPeriodo =
    m.ingreso_por_periodo != null
      ? (typeof m.ingreso_por_periodo === "number"
          ? m.ingreso_por_periodo
          : parseMoney(m.ingreso_por_periodo))
      : null;

  return {
    ...m,
    ingreso_anual: Number.isFinite(ingresoAnual) ? ingresoAnual : 0,
    ingreso_por_periodo: ingresoPorPeriodo,
    // si envías algo anidado en cliente:
    cliente: m.cliente
      ? {
          ...m.cliente,
          ingreso_anual: Number.isFinite(ingresoAnual) ? ingresoAnual : 0,
        }
      : undefined,
  };
}

export function buildPayloadForApi({ familyMembers, ...rest }) {
  return {
    ...rest,
    members: (familyMembers || []).map(normalizeMemberForApi),
  };
}
// adapters/apiMappers.js
import { normalizePhones } from "../utils/phones";
import { formatPhone334 } from "../utils/formatters";

export function mapClienteForAPI(cliente = {}) {
  const c = { ...cliente };

  // Solo nos importa que el backend reciba telefonos (array)
  const telefonos = Array.isArray(c.telefonos)
    ? normalizePhones(c.telefonos, formatPhone334)
    : [];

  // No tocamos legacy aquí; el objetivo es guardar NUEVO formato
  const clean = {
    ...c,
    telefonos,
  };

  // Opcional: remover legacy del payload si tu backend ya no los necesita
  // delete clean.telefono;
  // delete clean.secundario;
  // delete clean.whatsapp_num;

  return clean;
}

export function mapMemberForAPI(member = {}) {
  const m = { ...member };
  const c = m.cliente ? mapClienteForAPI(m.cliente) : undefined;
  return {
    ...m,
    ...(c ? { cliente: c } : {}),
  };
}

export function mapGrupoForAPI(grupo = {}) {
  // ejemplo si tu payload requiere "miembros"
  const miembros = Array.isArray(grupo.miembros)
    ? grupo.miembros.map(mapMemberForAPI)
    : [];

  return {
    ...grupo,
    miembros,
  };
}
