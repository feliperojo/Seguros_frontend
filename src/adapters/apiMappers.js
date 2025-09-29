// apiMappers.js
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
