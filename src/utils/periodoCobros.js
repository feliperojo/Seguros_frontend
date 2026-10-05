export const MESES_COBRO = [
  { value: "01", etiqueta: "Enero", corto: "Ene" },
  { value: "02", etiqueta: "Febrero", corto: "Feb" },
  { value: "03", etiqueta: "Marzo", corto: "Mar" },
  { value: "04", etiqueta: "Abril", corto: "Abr" },
  { value: "05", etiqueta: "Mayo", corto: "May" },
  { value: "06", etiqueta: "Junio", corto: "Jun" },
  { value: "07", etiqueta: "Julio", corto: "Jul" },
  { value: "08", etiqueta: "Agosto", corto: "Ago" },
  { value: "09", etiqueta: "Septiembre", corto: "Sep" },
  { value: "10", etiqueta: "Octubre", corto: "Oct" },
  { value: "11", etiqueta: "Noviembre", corto: "Nov" },
  { value: "12", etiqueta: "Diciembre", corto: "Dic" },
];

export function normalizarMes(mes) {
  const numero = Number(mes);
  if (!Number.isInteger(numero) || numero < 1 || numero > 12) return "";
  return String(numero).padStart(2, "0");
}

export function etiquetaMes(mes) {
  const clave = normalizarMes(mes);
  return MESES_COBRO.find((item) => item.value === clave)?.etiqueta || "";
}

export function esPeriodoAnterior(anio, mes, anioActual, mesActual) {
  const anioNum = Number(anio);
  const mesNum = Number(mes);
  const anioVigente = Number(anioActual);
  const mesVigente = Number(mesActual);
  if (![anioNum, mesNum, anioVigente, mesVigente].every(Number.isFinite)) return false;
  if (anioNum < anioVigente) return true;
  return anioNum === anioVigente && mesNum < mesVigente;
}

export function formatearInstante(iso, timeZone) {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toLocaleString("es-CO", {
    timeZone: timeZone || "America/Bogota",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
