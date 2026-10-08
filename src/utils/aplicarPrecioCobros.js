import { parseMoney } from "../services/ingresos.js";
import { etiquetaMes } from "./periodoCobros.js";

export const MENSAJE_COBERTURA_SIN_GUARDAR = "Guarda la cobertura antes de aplicar el precio.";
export const MENSAJE_PRECIO_SIN_GUARDAR = "Guarda la cobertura antes de aplicar el nuevo precio.";

export function precioNumerico(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "string" && valor.trim() === "") return null;
  const numero = typeof valor === "number" ? valor : parseMoney(valor);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100) / 100;
}

export function preciosDifieren(digitado, guardado) {
  const actual = precioNumerico(digitado);
  const persistido = precioNumerico(guardado);
  if (actual === null && persistido === null) return false;
  if (actual === null || persistido === null) return true;
  return actual.toFixed(2) !== persistido.toFixed(2);
}

export function mapaPreciosGuardados(members) {
  const mapa = {};
  (members || []).forEach((member) => {
    if (member?.cobertura_id) mapa[String(member.cobertura_id)] = member.precio;
    if (member?.coberturaDental?.cobertura_id) {
      mapa[String(member.coberturaDental.cobertura_id)] = member.coberturaDental.precio;
    }
  });
  return mapa;
}

export function estadoBotonAplicarPrecio({ coberturaId, precioDigitado, preciosGuardados }) {
  const id = Number(coberturaId);
  if (!Number.isInteger(id) || id <= 0) {
    return { habilitado: false, explicacion: MENSAJE_COBERTURA_SIN_GUARDAR };
  }
  if (preciosGuardados && Object.prototype.hasOwnProperty.call(preciosGuardados, String(id))) {
    if (preciosDifieren(precioDigitado, preciosGuardados[String(id)])) {
      return { habilitado: false, explicacion: MENSAJE_PRECIO_SIN_GUARDAR };
    }
  }
  return { habilitado: true, explicacion: "" };
}

export function filaElegible(fila, mesDesde) {
  if (!fila?.seleccionable || fila?.sin_cobro || fila?.pago_id == null) return false;
  const mes = String(fila.mes || "");
  return mes !== "" && mes >= String(mesDesde || "");
}

export function idsPendientesElegibles(filas, mesDesde) {
  return (filas || []).filter((fila) => filaElegible(fila, mesDesde)).map((fila) => fila.pago_id);
}

export function resumenSeleccion(filas, seleccion) {
  const elegidas = (filas || []).filter((fila) => seleccion.includes(fila.pago_id));
  return {
    cantidad: elegidas.length,
    cambios: elegidas.map((fila) => ({
      pagoId: fila.pago_id,
      mes: fila.mes,
      monto: fila.monto,
      nuevo: fila.nuevo_importe,
    })),
  };
}

export function motivoValido(motivo) {
  return String(motivo || "").trim().length >= 5 && String(motivo || "").trim().length <= 500;
}

export function cobrosGenerados(filas) {
  return (filas || []).filter((fila) => fila?.pago_id != null && !fila.sin_cobro);
}

function rangoMeses(meses) {
  const nombres = (meses || []).map((mes) => etiquetaMes(mes)).filter(Boolean);
  if (nombres.length === 0) return "";
  if (nombres.length === 1) return nombres[0].toLowerCase();
  return `${nombres[0].toLowerCase()} a ${nombres[nombres.length - 1].toLowerCase()}`;
}

/**
 * Un solo texto cuando no hay cobros a los que aplicar el precio.
 * Cadena vacía si sí hay cobros en el alcance del mes elegido.
 */
export function mensajeSinPagos({ filas, meses, anio, mesDesde }) {
  const cobros = cobrosGenerados(filas);
  const anioTexto = anio ? ` de ${anio}` : "";
  const rango = rangoMeses(meses);

  if (cobros.length === 0) {
    if (!rango) {
      return "No hay cobros generados en la vigencia de esta cobertura. Desde aquí no se crea ninguno.";
    }
    const donde = meses.length === 1 ? `en ${rango}${anioTexto}` : `de ${rango}${anioTexto}`;
    return `No hay cobros generados ${donde}. Desde aquí no se crea ninguno: solo se cambia el importe de cobros que ya existen.`;
  }

  const desde = String(mesDesde || "");
  const enAlcance = cobros.filter((fila) => String(fila.mes || "") >= desde);
  if (desde && enAlcance.length === 0) {
    const nombre = etiquetaMes(desde).toLowerCase();
    return `Desde ${nombre}${anioTexto} no hay cobros generados. Elija un mes anterior para ver los que ya existen.`;
  }

  return "";
}
