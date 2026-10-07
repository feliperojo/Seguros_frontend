import * as XLSX from "xlsx";
import { formatDateForDisplay } from "./formatters.js";
import { detalleSnapshotCobro } from "./pagosGrupoFamiliarConsulta.js";
import { indicadorMorosidadPagosPorMes, pickEstadoFechaActualizacionPago } from "./pagosMorosidad.js";

export const HOJA_RESUMEN = "Resumen anual";
export const HOJA_DETALLE = "Detalle de cobros";
/** Fila 0 del metadato; el encabezado de la tabla queda en esta fila (base 0). */
export const FILA_ENCABEZADO = 8;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const FORMATO_MONEDA = '"$"#,##0.00';

const ENCABEZADOS_RESUMEN = [
  "ID de grupo familiar",
  "ID interno de cobertura",
  "Identificador de póliza",
  "Cliente",
  "Pagador",
  "Compañía",
  "Plan",
  "Situación",
  ...MESES.flatMap((mes) => [`${mes} monto`, `${mes} estado`]),
];

const ENCABEZADOS_DETALLE = [
  "ID del cobro",
  "ID interno de cobertura",
  "ID de grupo familiar",
  "Cliente",
  "Año de generación",
  "Mes de generación",
  "Fecha de pago",
  "Monto",
  "Estado",
  "Fecha de actualización",
  "Snapshot",
  "Compañía del snapshot",
  "Plan del snapshot",
  "Pagador del snapshot",
  "Identificador de póliza del snapshot",
  "Fecha de activación",
  "Tipo de pago",
  "Día de pago",
];

function celdaTexto(valor) {
  if (valor == null || valor === "") return undefined;
  return { t: "s", v: String(valor) };
}

function celdaTextoFijo(valor) {
  return { t: "s", v: valor == null ? "" : String(valor) };
}

function celdaMoneda(valor) {
  if (valor == null || valor === "") return undefined;
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n)) return undefined;
  return { t: "n", v: Math.round(n * 100) / 100, z: FORMATO_MONEDA };
}

function celdaEntero(valor) {
  if (valor == null || valor === "") return undefined;
  const n = Number(valor);
  if (!Number.isInteger(n)) return celdaTexto(valor);
  return { t: "n", v: n };
}

function celdaPoliza(valor, vacioVisible) {
  if (valor == null || String(valor).trim() === "") {
    return vacioVisible ? { t: "s", v: "—" } : undefined;
  }
  return { t: "s", v: String(valor), z: "@" };
}

function textoInforme(valor) {
  if (valor == null || String(valor).trim() === "") return "—";
  return String(valor);
}

function etiquetaEstadoFiltro(estado) {
  const clave = String(estado ?? "").trim().toLowerCase();
  if (!clave) return "Todos los estados";
  const conocidos = {
    pendiente: "Pendiente",
    pagado: "Pagado",
    cancelado: "Cancelado",
    procesando: "Procesando",
  };
  return conocidos[clave] || String(estado).trim();
}

function filtroTexto(valor, vacio) {
  const texto = valor == null ? "" : String(valor).trim();
  return texto === "" ? vacio : texto;
}

export function fechaDescargaLocal(fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function nombreArchivoInformePagos(anio, fechaDescarga) {
  return `informe-pagos-${anio}-${fechaDescarga}.xlsx`;
}

export function cobrosDeFilas(filas) {
  const lista = [];
  for (const fila of filas || []) {
    const pagos = Array.isArray(fila?.pagos) ? fila.pagos : [];
    for (let indice = 0; indice < 12; indice += 1) {
      const cobros = pagos[indice]?.cobros;
      if (!Array.isArray(cobros) || cobros.length === 0) continue;
      for (const cobro of cobros) lista.push({ fila, mes: indice + 1, cobro });
    }
  }
  return lista;
}

export function montoResumenMes(cobros) {
  if (!Array.isArray(cobros) || cobros.length === 0) return null;
  const numeros = cobros
    .map((cobro) => Number(cobro?.monto))
    .filter((n) => Number.isFinite(n));
  if (numeros.length === 0) return null;
  const total = numeros.reduce((acc, n) => acc + n, 0);
  return Math.round(total * 100) / 100;
}

export function estadoResumenMes(cobros) {
  if (!Array.isArray(cobros) || cobros.length === 0) return "";
  const estados = cobros.map((cobro) => (cobro?.estado == null ? "" : String(cobro.estado)));
  return estados.every((estado) => estado === estados[0]) ? estados[0] : "Varios estados";
}

function situacionInforme(pagosPorMes) {
  return indicadorMorosidadPagosPorMes(pagosPorMes).etiqueta;
}

function snapshotCobro(cobro) {
  const detalle = detalleSnapshotCobro(cobro);
  if (!detalle.disponible) {
    return {
      aviso: "Snapshot no disponible",
      compania: "",
      plan: "",
      pagador: "",
      poliza: "",
      activacion: "",
      tipo: "",
      dia: "",
    };
  }
  const porEtiqueta = new Map(detalle.campos.map((campo) => [campo.etiqueta, campo.valor]));
  const leer = (etiqueta) => porEtiqueta.get(etiqueta) || "";
  return {
    aviso: detalle.nota || "",
    compania: leer("Compañía"),
    plan: leer("Plan"),
    pagador: leer("Pagador"),
    poliza: leer("Número de póliza"),
    activacion: leer("Fecha de activación"),
    tipo: leer("Tipo de pago"),
    dia: leer("Día de pago"),
  };
}

function fechaActualizacionVisible(cobro) {
  const fecha = pickEstadoFechaActualizacionPago(cobro);
  if (!fecha) return "";
  return formatDateForDisplay(fecha);
}

function filasMetadato({ filtros, fechaDescarga, coberturas, cobros }) {
  const anio = Number(filtros?.anio);
  return [
    [celdaTextoFijo("Año consultado"), Number.isFinite(anio) ? { t: "n", v: anio } : celdaTextoFijo(filtros?.anio)],
    [celdaTextoFijo("Filtro de cliente"), celdaTextoFijo(filtroTexto(filtros?.cliente, "Todos"))],
    [celdaTextoFijo("Filtro de compañía o plan"), celdaTextoFijo(filtroTexto(filtros?.compania, "Todas"))],
    [celdaTextoFijo("Filtro de estado"), celdaTextoFijo(etiquetaEstadoFiltro(filtros?.estado))],
    [celdaTextoFijo("Fecha de descarga"), celdaTextoFijo(fechaDescarga)],
    [celdaTextoFijo("Coberturas exportadas"), { t: "n", v: coberturas }],
    [celdaTextoFijo("Cobros exportados"), { t: "n", v: cobros }],
    [],
  ];
}

function filaResumen(fila) {
  const celdas = [
    fila?.grupo_familiar_id ? celdaEntero(fila.grupo_familiar_id) : celdaTextoFijo("—"),
    celdaEntero(fila?.cobertura_id),
    celdaPoliza(fila?.codigo_poliza, true),
    celdaTextoFijo(textoInforme(fila?.cliente)),
    celdaTextoFijo(textoInforme(fila?.pagador)),
    celdaTextoFijo(textoInforme(fila?.compania)),
    celdaTexto(fila?.plan),
    celdaTextoFijo(situacionInforme(fila?.pagos)),
  ];
  for (let indice = 0; indice < 12; indice += 1) {
    const cobros = fila?.pagos?.[indice]?.cobros;
    if (!Array.isArray(cobros) || cobros.length === 0) {
      celdas.push(undefined, undefined);
      continue;
    }
    celdas.push(celdaMoneda(montoResumenMes(cobros)), celdaTexto(estadoResumenMes(cobros)));
  }
  return celdas;
}

function filaDetalle({ fila, mes, cobro }) {
  const snap = snapshotCobro(cobro);
  return [
    celdaEntero(cobro?.id),
    celdaEntero(fila?.cobertura_id),
    fila?.grupo_familiar_id ? celdaEntero(fila.grupo_familiar_id) : celdaTextoFijo("—"),
    celdaTextoFijo(textoInforme(fila?.cliente)),
    celdaEntero(cobro?.anio_generado),
    celdaEntero(mes),
    celdaTexto(cobro?.fecha_pago),
    celdaMoneda(cobro?.monto),
    celdaTexto(cobro?.estado),
    celdaTexto(fechaActualizacionVisible(cobro)),
    celdaTexto(snap.aviso),
    celdaTexto(snap.compania),
    celdaTexto(snap.plan),
    celdaTexto(snap.pagador),
    celdaPoliza(snap.poliza, false),
    celdaTexto(snap.activacion),
    celdaTexto(snap.tipo),
    celdaTexto(snap.dia),
  ];
}

function anchos(encabezados) {
  return encabezados.map((titulo) => ({
    wch: Math.min(42, Math.max(14, String(titulo).length + 2)),
  }));
}

function hojaDesdeFilas(aoa, encabezados, filasDatos) {
  const hoja = XLSX.utils.aoa_to_sheet(aoa);
  hoja["!cols"] = anchos(encabezados);
  const ultimaFila = filasDatos === 0 ? FILA_ENCABEZADO : FILA_ENCABEZADO + filasDatos - 1;
  hoja["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: FILA_ENCABEZADO, c: 0 },
      e: { r: ultimaFila, c: encabezados.length - 1 },
    }),
  };
  return hoja;
}

export function crearLibroInformePagos({ filas, filtros, fechaDescarga }) {
  const coberturas = Array.isArray(filas) ? filas : [];
  const cobros = cobrosDeFilas(coberturas);
  const metadato = () => filasMetadato({
    filtros,
    fechaDescarga,
    coberturas: coberturas.length,
    cobros: cobros.length,
  });
  const resumen = [
    ...metadato(),
    ENCABEZADOS_RESUMEN.map(celdaTextoFijo),
    ...coberturas.map(filaResumen),
  ];
  const detalle = [
    ...metadato(),
    ENCABEZADOS_DETALLE.map(celdaTextoFijo),
    ...cobros.map(filaDetalle),
  ];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    libro,
    hojaDesdeFilas(resumen, ENCABEZADOS_RESUMEN, coberturas.length),
    HOJA_RESUMEN,
  );
  XLSX.utils.book_append_sheet(
    libro,
    hojaDesdeFilas(detalle, ENCABEZADOS_DETALLE, cobros.length),
    HOJA_DETALLE,
  );
  return libro;
}
