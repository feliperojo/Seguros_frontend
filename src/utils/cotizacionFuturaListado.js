import { formatDateMMDDYYYY } from "./formatters.js";

export function anioActivacion(fecha) {
  const match = String(fecha ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return year;
}

export function esActivacionFutura(fecha, anioOperacion) {
  const anio = Number(anioOperacion);
  const activacion = anioActivacion(fecha);
  if (!Number.isInteger(anio) || activacion === null) return false;
  return activacion > anio;
}

export function etiquetaActivacionPrevista(fecha, anioOperacion) {
  if (!esActivacionFutura(fecha, anioOperacion)) return null;
  const texto = formatDateMMDDYYYY(fecha);
  if (!texto) return null;
  return `Activación prevista: ${texto}`;
}

export function coberturasCotizacionFuturaVisibles(items, coberturasAnio, anioOperacion) {
  const idsAnio = new Set((coberturasAnio || []).map((item) => item?.id).filter((id) => id != null));
  return (items || []).filter((item) => {
    if (item?.id != null && idsAnio.has(item.id)) return false;
    return esActivacionFutura(item?.fecha_activacion, anioOperacion);
  });
}

export function vistaExpandidaCotizacion({
  coberturasAnio = [],
  cotizacionFutura = [],
  anioOperacion = null,
} = {}) {
  const futuras = coberturasCotizacionFuturaVisibles(
    cotizacionFutura,
    coberturasAnio,
    anioOperacion
  );
  const hayAnio = coberturasAnio.length > 0;
  const hayFutura = futuras.length > 0;

  return {
    futuras,
    mostrarSinProducto: !hayAnio && !hayFutura,
    mostrarSinCoberturas: !hayAnio && !hayFutura,
    mostrarConteoCoberturaVigente: hayAnio,
    etiquetas: futuras.map((item) => etiquetaActivacionPrevista(item.fecha_activacion, anioOperacion)),
  };
}
