import { formatDisplayName } from "./names";
import { mergeClientePreferNonEmpty, unwrapClienteFromApi } from "./mergeClientePreferNonEmpty";
import { resolveClienteTelefonos } from "./phone-mappers";
import { computeAnnual, formatMoney2 } from "../services/ingresos";

const calcAge = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a;
};

const date10 = (v) => (v ? String(v).slice(0, 10) : "");

const hydrateIngresoOcasionalAnual = (cli = {}) => {
  const raw = cli.ingreso_ocasional_anual;
  if (raw != null && String(raw).trim() !== "") return raw;
  const n = computeAnnual(cli.periodo_ingreso_ocasional, cli.ingreso_por_periodo_ocasional);
  if (!n) return "";
  return formatMoney2(n);
};

/**
 * Construye un miembro con todos los datos del cliente (GET cliente/:id) + cobertura recién creada.
 * Alineado con mapFullToMembers de GrupoFamiliarDetail para que la UI muestre la ficha completa.
 */
export function buildMemberFromClienteExistente({
  clienteRaw,
  cobertura = {},
  payload = {},
} = {}) {
  const cli = mergeClientePreferNonEmpty(
    unwrapClienteFromApi(clienteRaw) ?? clienteRaw ?? {},
    {}
  );
  const cov = cobertura && typeof cobertura === "object" ? cobertura : {};

  const primer = formatDisplayName((cli.primer_nombre || cli.nombre || "").trim());
  const segundo = formatDisplayName((cli.segundo_nombre || "").trim());
  const apell = formatDisplayName((cli.apellidos || cli.apellido || "").trim());
  const fecha = cli.fecha_nacimiento || "";
  const edad = calcAge(fecha);
  const nombreCompleto = formatDisplayName(
    cli.nombre_completo || [primer, segundo, apell].filter(Boolean).join(" ")
  );

  const clienteFormateado = {
    id: cli.id ?? payload.cliente_id ?? null,
    primer_nombre: primer,
    segundo_nombre: segundo,
    apellidos: apell,
    nombre_completo: nombreCompleto,
    genero: cli.genero || "",
    fecha_nacimiento: fecha,
    edad,
    idioma: cli.idioma || "",
    pais_origen: cli.pais_origen || "",
    peso: cli.peso || "",
    altura: cli.altura || "",
    pulgadas: cli.pulgadas || "",
    telefono: cli.telefono || "",
    secundario: cli.secundario || "",
    whatsapp_num: cli.whatsapp_num || "",
    email: cli.email || "",
    nota: cli.nota || "",
    telefonos: resolveClienteTelefonos(cli, "us"),
    direccion: cli.direccion || "",
    calle: cli.calle || "",
    apto: cli.apto || "",
    ciudad: cli.ciudad || "",
    estado: cli.estado || "",
    codigo_postal: cli.codigo_postal || "",
    condado: cli.condado || "",
    dir_correspondencia: cli.dir_correspondencia || "",
    social: cli.social || "",
    status: cli.status || "",
    auscis: cli.auscis || "",
    tarjeta_numero: cli.tarjeta_numero || "",
    fecha_emision: cli.fecha_emision || "",
    fecha_expiracion: cli.fecha_expiracion || "",
    categoria: cli.categoria || "",
    tipo_ingreso: cli.tipo_ingreso || "",
    actividad_economica: cli.actividad_economica || "",
    empleador: cli.empleador || "",
    telefono_empleador: cli.telefono_empleador || "",
    periodo_ingreso: cli.periodo_ingreso || "",
    ingreso_por_periodo: cli.ingreso_por_periodo || "",
    ingreso_anual: cli.ingreso_anual || "",
    nota_ingreso_ocasional: cli.nota_ingreso_ocasional || "",
    periodo_ingreso_ocasional: cli.periodo_ingreso_ocasional || "",
    ingreso_por_periodo_ocasional: cli.ingreso_por_periodo_ocasional || "",
    ingreso_ocasional_anual: hydrateIngresoOcasionalAnual(cli),
    whatsapp: !!cli.whatsapp,
    telegram: !!cli.telegram,
    texto_sms: !!cli.texto_sms,
  };

  return {
    id: cli.id ?? `temp-${Date.now()}-${Math.random()}`,
    cliente_id: cli.id ?? payload.cliente_id ?? null,
    cobertura_id: cov.id ?? null,
    primer_nombre: primer,
    segundo_nombre: segundo,
    apellidos: apell,
    nombreCompleto,
    nombre_completo: nombreCompleto,
    genero: cli.genero || "",
    fecha_nacimiento: fecha,
    edad,
    idioma: cli.idioma || "",
    pais_origen: cli.pais_origen || "",
    peso: cli.peso || "",
    altura: cli.altura || "",
    pulgadas: cli.pulgadas || "",
    ingreso_anual: cli.ingreso_anual || "",
    nota: cli.nota || "",
    periodo_ingreso: cli.periodo_ingreso || "",
    ingreso_por_periodo: cli.ingreso_por_periodo || "",
    tipo_ingreso: cli.tipo_ingreso || "",
    actividad_economica: cli.actividad_economica || "",
    empleador: cli.empleador || "",
    telefono_empleador: cli.telefono_empleador || "",
    nota_ingreso_ocasional: cli.nota_ingreso_ocasional || "",
    periodo_ingreso_ocasional: cli.periodo_ingreso_ocasional || "",
    ingreso_por_periodo_ocasional: cli.ingreso_por_periodo_ocasional || "",
    ingreso_ocasional_anual: hydrateIngresoOcasionalAnual(cli),
    telefono: cli.telefono || "",
    secundario: cli.secundario || "",
    whatsapp_num: cli.whatsapp_num || "",
    email: cli.email || "",
    direccion: cli.direccion || "",
    calle: cli.calle || "",
    apto: cli.apto || "",
    ciudad: cli.ciudad || "",
    estado: cli.estado || "",
    codigo_postal: cli.codigo_postal || "",
    condado: cli.condado || "",
    dir_correspondencia: cli.dir_correspondencia || "",
    social: cli.social || "",
    status: cli.status || "",
    auscis: cli.auscis || "",
    tarjeta_numero: cli.tarjeta_numero || "",
    fecha_emision: cli.fecha_emision || "",
    fecha_expiracion: cli.fecha_expiracion || "",
    categoria: cli.categoria || "",
    whatsapp: !!cli.whatsapp,
    telegram: !!cli.telegram,
    texto_sms: !!cli.texto_sms,
    parentesco: cov.parentesco || payload.tipo || "Tomador",
    tipo: cov.parentesco || payload.tipo || "Tomador",
    estado_cobertura: cov.estado_cobertura || payload.estado_cobertura || "Sí",
    cobertura_tipo: cov.cobertura_tipo || payload.cobertura_tipo || "Plan de salud",
    ano_cobertura: cov.ano_cobertura || new Date().getFullYear(),
    fecha_activacion: date10(cov.fecha_activacion),
    plan: cov.plan ?? null,
    metal: cov.metal ?? null,
    red: cov.red ?? null,
    codigo_poliza: cov.codigo_poliza ?? "",
    policy_number: cov.policy_number ?? "",
    elegibilidad: cov.elegibilidad ?? "",
    precio: cov.precio ?? "",
    tipo_pago: cov.tipo_pago ?? null,
    dia_pago: cov.dia_pago ?? "",
    grupo: cov.grupo ?? "",
    compania_id: cov.compania_id ?? null,
    agente: cov.agente ?? "",
    pagador_id: cov.pagador_id ?? null,
    activo: cov.activo !== undefined && cov.activo !== null ? cov.activo : true,
    vigente: cov.vigente !== undefined && cov.vigente !== null ? cov.vigente : true,
    fecha_cancelacion: date10(cov.fecha_cancelacion),
    fecha_retiro: date10(cov.fecha_retiro) || null,
    origen: "existente",
    _remote_created: true,
    cliente: clienteFormateado,
  };
}

export function extractCoberturaFromCreateResponse(res = {}) {
  const miembro = res?.miembro ?? res?.data?.miembro ?? null;
  return (
    miembro?.cobertura ??
    res?.data?.cobertura ??
    (res?.data?.id ? res.data : null) ??
    res?.cobertura ??
    res?.data ??
    res
  );
}
