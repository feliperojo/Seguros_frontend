const ZONA = "America/Bogota";
const AVISO_PREFIJO = "Sandbox · Fecha de operación simulada:";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function relojReal(ahora = new Date()) {
  return {
    simulacionPermitida: false,
    activa: false,
    fecha: ahora,
    anio: ahora.getFullYear(),
    mes: ahora.getMonth() + 1,
    aviso: null,
    zonaHoraria: ZONA,
  };
}

/**
 * Interpreta "AAAA-MM-DD HH:MM:SS" como hora de pared, sin convertir zona.
 * Así getFullYear/getMonth/getDate coinciden con America/Bogota.
 */
export function parseFechaPared(valor) {
  const texto = String(valor || "").trim();
  const match = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/
  );
  if (!match) return null;
  const [, anio, mes, dia, hora, minuto, segundo] = match.map(Number);
  const fecha = new Date(anio, mes - 1, dia, hora, minuto, segundo);
  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return null;
  }
  return fecha;
}

export function formatearAviso(fecha) {
  const hora = String(fecha.getHours()).padStart(2, "0");
  const minuto = String(fecha.getMinutes()).padStart(2, "0");
  return `${AVISO_PREFIJO} ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}, ${hora}:${minuto}. Desactivarla devuelve la fecha real y no revierte operaciones ya realizadas.`;
}

/**
 * El año operativo lo define el backend. Sin simulación activa se conserva el reloj del navegador.
 */
export function resolverFechaOperacion(payload, ahora = new Date()) {
  const real = relojReal(ahora);
  if (!payload || typeof payload !== "object") {
    return real;
  }

  const permitida = payload.simulacion_permitida === true;
  const fecha = parseFechaPared(payload.fecha);
  const activa = permitida && payload.activa === true && fecha != null;
  if (!activa) {
    return { ...real, simulacionPermitida: permitida };
  }

  const anio = Number(payload.anio);
  return {
    simulacionPermitida: true,
    activa: true,
    fecha,
    anio: Number.isInteger(anio) && anio > 1900 ? anio : fecha.getFullYear(),
    mes: fecha.getMonth() + 1,
    aviso: typeof payload.aviso === "string" && payload.aviso.startsWith(AVISO_PREFIJO)
      ? payload.aviso
      : formatearAviso(fecha),
    zonaHoraria: payload.zona_horaria || ZONA,
  };
}

let snapshot = relojReal();

export function publicarFechaOperacion(payload, ahora = new Date()) {
  snapshot = resolverFechaOperacion(payload, ahora);
  return snapshot;
}

export function leerFechaOperacion() {
  return snapshot;
}

export function fechaParaConsulta() {
  return snapshot.activa ? new Date(snapshot.fecha.getTime()) : new Date();
}

export function anioOperacion() {
  return snapshot.activa ? snapshot.anio : new Date().getFullYear();
}

/**
 * Identifica el instante operativo para recargar consultas.
 * Cambia también cuando solo cambia el día, dentro del mismo mes.
 */
export function claveFechaOperacion(fecha = snapshot) {
  if (!fecha?.activa || !(fecha.fecha instanceof Date)) return "real";
  const valor = fecha.fecha;
  const dos = (numero) => String(numero).padStart(2, "0");
  return [
    valor.getFullYear(),
    dos(valor.getMonth() + 1),
    dos(valor.getDate()),
    dos(valor.getHours()),
    dos(valor.getMinutes()),
    dos(valor.getSeconds()),
  ].join("-");
}

/**
 * Destino por defecto para preparar una renovación: año operativo + 1.
 * Es el mismo cálculo con fecha real o simulada. Continuar un lote usa su id.
 */
export function anioDestinoRenovacionPorDefecto(fecha = snapshot) {
  const anio = Number(fecha?.anio);
  const base = Number.isInteger(anio) && anio > 1900 ? anio : new Date().getFullYear();
  return base + 1;
}
