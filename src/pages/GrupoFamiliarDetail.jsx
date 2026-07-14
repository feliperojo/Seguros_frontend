import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Alert, Form } from "react-bootstrap";
import ProspectoBarra from "../components/fase2/ProspectoBarra";
import Prospectogrupo from "../components/fase2/Prospectogrupo";
import ProspectoDatos from "../components/fase2/ProspectoDatos";
import TomaDeDatos from "../components/fase2/TomaDeDatos";
import ProductoCotizacionModal from "../components/fase2/ProductoCotizacionModal";
import RetiroCancelacionModal from "../components/RetiroCancelacionModal";
import GrupoFamiliarService from "../services/GrupoFamiliarService";
import { calcIngresoFamiliar, parseMoney, computeAnnual, formatMoney2 } from '../services/ingresos';
import { mapGrupoFromForm, mapClienteFromMember, mapCoberturaFromMember, stripNulls, cleanDate } from "../adapters/prospecto.mapper";
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { deriveCounts } from "../utils/groupCounters";
import { formatDisplayName } from "../utils/names";
import useGrupoFamiliarEdicionPresencia from "../hooks/useGrupoFamiliarEdicionPresencia";
import GrupoFamiliarEdicionAlerta from "../components/GrupoFamiliar/GrupoFamiliarEdicionAlerta";
import { buildDeltaCambiosFromPayloads } from "../utils/grupoFamiliarConcurrentSave";


 import { resolveClienteTelefonos, toApiPhones } from "../utils/phone-mappers";

const ANIO_ACTUAL = new Date().getFullYear();

const formatFechaCorta = (value) => {
  if (!value) return "—";
  const s = String(value).slice(0, 10);
  return s || "—";
};

// ================== Helpers ==================

// --- Helpers de etapas (ajusta si tu flujo no es lineal) ---
const NEXT_OF = {
  PROSPECTO: "COTIZACION",
  COTIZACION: "SEGUIMIENTO",
  SEGUIMIENTO: "TOMA_DATOS",
  TOMA_DATOS: "INSCRIPCION_INI",
  INSCRIPCION_INI: "GRUPO_FAMILIAR",
};

const nextOf = (code) => NEXT_OF[(code || "").toUpperCase()] || null;

const canAdvance = (from, to, ctx = {}) => {
  if (!from || !to) return false;
  if (nextOf(from) !== to) return false;
  return true;
};

// Convierte cualquier forma de estado en código UPPERCASE
const toEstadoCode = (raw) => {
  if (!raw) return null;
  if (typeof raw === "string") return raw.toUpperCase();
  if (typeof raw === "object")
    return (raw.codigo || raw.code || raw.cod || raw.nombre || "").toUpperCase();
  return null;
};

const calcAge = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a;
};

const capitalizeFirst = (s = "") =>
  s ? s.trimStart().replace(/^./, (c) => c.toUpperCase()) : "";

const capitalizeWords = (s = "") =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Desempaqueta respuesta: acepta {status,data} o el objeto directo
const unwrapFull = (res) => res?.data ?? res ?? {};




 // ---- helper a nivel de módulo (visible para mapClienteForSave) ----
 const moneyToDecimal = (v) => {
  const n = parseMoney(v ?? "");
  if (!Number.isFinite(n)) return 0;
  return Math.min(Number(n.toFixed(2)), 99999999.99);
};

/** Si el backend aún no devuelve `ingreso_ocasional_anual`, se deriva del período y el monto. */
const hydrateIngresoOcasionalAnual = (cli = {}) => {
  const raw = cli.ingreso_ocasional_anual;
  if (raw != null && String(raw).trim() !== "") return raw;
  const n = computeAnnual(cli.periodo_ingreso_ocasional, cli.ingreso_por_periodo_ocasional);
  if (!n) return "";
  return formatMoney2(n);
};


// ===== Mapper local para GUARDAR campos del cliente =====
// IMPORTANTE: Para clientes existentes, solo envía los campos del acordeón
// para evitar borrar datos que no están en el formulario (ej: teléfono)
const mapClienteForSave = (m) => {
    // Validación de entrada
    if (!m) {
      console.error("❌ mapClienteForSave: miembro es undefined o null");
      return null;
    }

  const c = m?.cliente || {};
  const pick = (k) => (m[k] ?? c[k] ?? null);
  const date10 = (v) => (v ? String(v).slice(0, 10) : null);
  const formatName = (v) => {
    const s = (v ?? "").toString().trim();
    return s ? formatDisplayName(s) : "";
  };

  const primer_nombre = formatName(pick("primer_nombre"));
  const segundo_nombre = formatName(pick("segundo_nombre"));
  const apellidos = formatName(pick("apellidos"));
  const nombre_completo = formatDisplayName(
    buildNombreCompleto({ primer_nombre, segundo_nombre, apellidos }) ||
      pick("nombre_completo") ||
      ""
  );

  const clienteIdReal = m.cliente_id ?? c.id ?? null;
  const esClienteReal = !!clienteIdReal;  // cualquier id válido cuenta

  // ✅ CAMPOS DEL ACORDEÓN (según ProspectoDatos.jsx - MemberAccordionForm):
  // - primer_nombre
  // - segundo_nombre
  // - apellidos
  // - idioma
  // - fecha_nacimiento
  // - genero
  // - ingreso_anual
  // - nota
  // (edad es calculado, no se guarda)
  
  // Si es un cliente EXISTENTE, solo enviar campos del acordeón
  if (esClienteReal) {
    const payload = {
      id: Number(clienteIdReal),
      primer_nombre,
      segundo_nombre: segundo_nombre || null,
      apellidos,
      nombre_completo,
      fecha_nacimiento: date10(pick("fecha_nacimiento")),
      genero: pick("genero"),
      idioma: pick("idioma"),
      pais_origen: capitalizeWords(pick("pais_origen") || ""),
      // Campos antropométricos
      peso: pick("peso"),
      altura: pick("altura"),
      pulgadas: pick("pulgadas"),
      ingreso_anual: moneyToDecimal(pick("ingreso_anual")),
      nota: pick("nota"),
      direccion: pick("direccion"),
      calle: pick("calle"),
      apto: pick("apto"),
      ciudad: pick("ciudad"),
      estado: pick("estado"),
      codigo_postal: pick("codigo_postal"),
      condado: pick("condado"),
      dir_correspondencia: pick("dir_correspondencia"),
      telefonos: toApiPhones(Array.isArray(c.telefonos) ? c.telefonos : []),
      email: pick("email"),
      whatsapp: !!pick("whatsapp"),
      telegram: !!pick("telegram"),
      texto_sms: !!pick("texto_sms"),
      social: pick("social"),
      status: pick("status"),
      auscis: pick("auscis"),
      tarjeta_numero: pick("tarjeta_numero"),
      fecha_emision: date10(pick("fecha_emision")),
      fecha_expiracion: date10(pick("fecha_expiracion")),
      categoria: pick("categoria"),
      tipo_ingreso: pick("tipo_ingreso"),
      actividad_economica: pick("actividad_economica"),
      empleador: pick("empleador"),
      telefono_empleador: pick("telefono_empleador"),
      periodo_ingreso: pick("periodo_ingreso"),
      ingreso_por_periodo: moneyToDecimal(pick("ingreso_por_periodo")),
      nota_ingreso_ocasional: pick("nota_ingreso_ocasional"),
      periodo_ingreso_ocasional: pick("periodo_ingreso_ocasional"),
      ingreso_por_periodo_ocasional: moneyToDecimal(pick("ingreso_por_periodo_ocasional")),
      ingreso_ocasional_anual: moneyToDecimal(pick("ingreso_ocasional_anual")),
    };
    // Solo incluir campos que tienen valor (no null/undefined)
    // Para telefonos, siempre incluirlo aunque sea array vacío
    // Fechas de estatus migratorio: enviar null si el usuario las dejó en blanco
    const filtered = Object.fromEntries(
      Object.entries(payload).filter(([k, v]) => {
        if (k === "telefonos") return true;
        if (k === "fecha_emision" || k === "fecha_expiracion") return true;
        return v !== null && v !== undefined;
      })
    );
    return filtered;
  }

  // Si es un cliente NUEVO, incluir todos los campos necesarios
  const payload = {
    primer_nombre,
    segundo_nombre: segundo_nombre || null,
    apellidos,
    nombre_completo,
    fecha_nacimiento: date10(pick("fecha_nacimiento")),
    genero: pick("genero"),
    idioma: pick("idioma"),
    pais_origen: capitalizeWords(pick("pais_origen") || ""),
    // Campos antropométricos
    peso: pick("peso"),
    altura: pick("altura"),
    pulgadas: pick("pulgadas"),
    ingreso_anual: moneyToDecimal(pick("ingreso_anual")),
    nota: pick("nota"),
    telefono: pick("telefono"),
    secundario: pick("secundario"),
    whatsapp_num: pick("whatsapp_num"),
    telefonos: toApiPhones(Array.isArray(c.telefonos) ? c.telefonos : []),
    email: pick("email"),
    direccion: pick("direccion"),
    calle: pick("calle"),
    apto: pick("apto"),
    ciudad: pick("ciudad"),
    estado: pick("estado"),
    codigo_postal: pick("codigo_postal"),
    condado: pick("condado"),
    dir_correspondencia: pick("dir_correspondencia"),
    social: pick("social"),
    status: pick("status"),
    auscis: pick("auscis"),
    tarjeta_numero: pick("tarjeta_numero"),
    fecha_emision: date10(pick("fecha_emision")),
    fecha_expiracion: date10(pick("fecha_expiracion")),
    categoria: pick("categoria"),
    tipo_ingreso: pick("tipo_ingreso"),
    actividad_economica: pick("actividad_economica"),
    empleador: pick("empleador"),
    telefono_empleador: pick("telefono_empleador"),
    periodo_ingreso: pick("periodo_ingreso"),
    ingreso_por_periodo: moneyToDecimal(pick("ingreso_por_periodo")),
    nota_ingreso_ocasional: pick("nota_ingreso_ocasional"),
    periodo_ingreso_ocasional: pick("periodo_ingreso_ocasional"),
    ingreso_por_periodo_ocasional: moneyToDecimal(pick("ingreso_por_periodo_ocasional")),
    ingreso_ocasional_anual: moneyToDecimal(pick("ingreso_ocasional_anual")),
    whatsapp: pick("whatsapp") === true,
    telegram: pick("telegram") === true,
    texto_sms: pick("texto_sms") === true,
  };

  return stripNulls(payload);
};

const COBERTURA_CAMPOS_PROTEGIDOS = [
  "fecha_cancelacion",
  "fecha_retiro",
  "nota_cancel",
  "nota_retiro",
  "motivo_cancelacion",
  "motivo_retiro",
  "cobertura_definida",
  "activo",
  "vigente",
];

const memberTieneRetiroOCancelacion = (m = {}) =>
  m.fecha_cancelacion !== undefined ||
  m.fecha_retiro !== undefined ||
  m.activo !== undefined ||
  m.vigente !== undefined ||
  m.nota_cancel !== undefined ||
  m.nota_retiro !== undefined ||
  m.motivo_cancelacion !== undefined ||
  m.motivo_retiro !== undefined ||
  m.cobertura_definida !== undefined;

const buildCoberturasPayloadForMembers = (members, grupoId, productoCotizacion) =>
  (members || [])
    .filter((m) => m?.cliente_id && m?.cobertura_id)
    .map((m) => {
      const cobertura = mapCoberturaFromMember(m, grupoId);
      cobertura.id = m.cobertura_id;
      cobertura.cliente_id = m.cliente_id;

      if (productoCotizacion?.label) {
        cobertura.cobertura_tipo = productoCotizacion.label;
      }

      if (!memberTieneRetiroOCancelacion(m)) {
        COBERTURA_CAMPOS_PROTEGIDOS.forEach((campo) => {
          delete cobertura[campo];
        });
        return stripNulls(cobertura);
      }

      if (m.fecha_cancelacion !== undefined) {
        cobertura.fecha_cancelacion = cleanDate(m.fecha_cancelacion);
        if (m.nota_cancel !== undefined) {
          cobertura.nota_cancel = (m.nota_cancel || "").trim() || null;
        } else if (m.fecha_cancelacion) {
          cobertura.nota_cancel = null;
        }
        if (m.motivo_cancelacion !== undefined) {
          cobertura.motivo_cancelacion = (m.motivo_cancelacion || "").trim() || null;
        } else if (m.fecha_cancelacion) {
          cobertura.motivo_cancelacion = null;
        }
      }

      if (m.fecha_retiro !== undefined) {
        cobertura.fecha_retiro = cleanDate(m.fecha_retiro);
        if (m.nota_retiro !== undefined) {
          cobertura.nota_retiro = (m.nota_retiro || "").trim() || null;
        } else if (m.fecha_retiro) {
          cobertura.nota_retiro = null;
        }
        if (m.motivo_retiro !== undefined) {
          cobertura.motivo_retiro = (m.motivo_retiro || "").trim() || null;
        } else if (m.fecha_retiro) {
          cobertura.motivo_retiro = null;
        }
      }

      if (m.cobertura_definida !== undefined) {
        cobertura.cobertura_definida = (m.cobertura_definida || "").trim() || null;
      }

      const valoresProtegidos = {};
      COBERTURA_CAMPOS_PROTEGIDOS.forEach((campo) => {
        if (cobertura[campo] !== undefined) {
          valoresProtegidos[campo] = cobertura[campo];
        } else {
          if (campo === "nota_cancel" && cobertura.fecha_cancelacion) {
            valoresProtegidos[campo] = null;
          }
          if (campo === "nota_retiro" && cobertura.fecha_retiro) {
            valoresProtegidos[campo] = null;
          }
          if (campo === "motivo_cancelacion" && cobertura.fecha_cancelacion) {
            valoresProtegidos[campo] = null;
          }
          if (campo === "motivo_retiro" && cobertura.fecha_retiro) {
            valoresProtegidos[campo] = null;
          }
        }
      });

      if (valoresProtegidos.activo === undefined) {
        valoresProtegidos.activo = true;
      }
      if (valoresProtegidos.vigente === undefined) {
        valoresProtegidos.vigente = !cobertura.fecha_cancelacion;
      }

      const coberturaLimpia = stripNulls(cobertura);
      Object.keys(valoresProtegidos).forEach((campo) => {
        coberturaLimpia[campo] = valoresProtegidos[campo];
      });

      return coberturaLimpia;
    });

const buildFullUpdatePayloadParts = (formData, members, grupoId, productoCotizacion) => {
  const grupoPayload = stripNulls(mapGrupoFromForm(formData));
  // Asesor puede quedar vacío a propósito: stripNulls omite responsable=null y el valor anterior persistía.
  const asesor = String(formData?.asesor ?? "").trim();
  grupoPayload.responsable = asesor === "" ? null : asesor;
  const clientesPayload = (members || [])
    .filter((m) => m?.cliente_id)
    .map(mapClienteForSave)
    .filter(Boolean)
    .map((cli) => {
      const { fecha_emision, fecha_expiracion, ...rest } = cli;
      const cleaned = stripNulls(rest);
      // Permitir limpiar fechas de estatus migratorio (stripNulls las omitiría).
      if (fecha_emision !== undefined) cleaned.fecha_emision = fecha_emision || null;
      if (fecha_expiracion !== undefined) cleaned.fecha_expiracion = fecha_expiracion || null;
      return cleaned;
    });
  const coberturasPayload = buildCoberturasPayloadForMembers(members, grupoId, productoCotizacion);

  return { grupoPayload, clientesPayload, coberturasPayload };
};

const cloneEditSnapshot = (value) => {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

// ================== Función para obtener el producto desde coberturas ==================
const getProductoFromCoberturas = (coberturas = []) => {
  // Buscar el primer cobertura_tipo no vacío
  const coberturaTipo = coberturas.find(c => c?.cobertura_tipo)?.cobertura_tipo;
  
  if (!coberturaTipo) return null;
  
  // Mapear el cobertura_tipo a un objeto producto similar al modal
  // Ajusta estos mapeos según tus productos reales
  const productosMap = {
    "Plan de salud": { label: "Plan de salud", color: "primary" },
    "Plan Dental": { label: "Plan Dental", color: "info" },
    "Plan de vida": { label: "Plan de vida", color: "danger" },
    "Plan de Descuentos": { label: "Plan de Descuentos", color: "warning" },
    "Vision": { label: "Vision", color: "success" },
    "Seguro de vida": { label: "Seguro de vida", color: "success" },
    "Seguro dental": { label: "Seguro dental", color: "info" },
    "Seguro de accidentes": { label: "Seguro de accidentes", color: "warning" },
  };
  
  return productosMap[coberturaTipo] || { 
    label: coberturaTipo, 
    color: "secondary" 
  };
};

// ================== Mapeos ==================
// API FULL -> formData para Prospectogrupo (según tu JSON de ejemplo)
const mapFullToForm = (fullRaw) => {
  const g = unwrapFull(fullRaw);

  // persona_contacto llega como string "Nombre Apellidos"


  const tels = g.telefonos || {};

  return {
    // Información del Prospecto
    captadoPor: g.captado_por ?? "",
    cual: g.cual ?? "",
    asesor: g.responsable ?? "",

    // Persona de Contacto
    nombre: (g.persona_contacto || "").trim(),
    apellidos: (g.apellido_persona_contacto || "").trim(),
    perteneceFamilia: g.pertenece_grupo_familiar ? "Sí" : "No",
    telefono1: tels.telefono_1 ?? "",
    telefono2: tels.telefono_2 ?? "",
    nota: g.nota ?? "",
    relacion: g.relacion ?? "",

    whatsapp: !!tels.whatsapp,
    telegram: !!tels.telegram,
    sms: !!tels.mensaje_sms,

    // Económicos
    zipCode: g.zip_code ?? "",
    fechaAutorizacion: g.fecha_autorizacion
      ? String(g.fecha_autorizacion).slice(0, 10)
      : "",
    nombreAutorizado: g.nombre_autorizado ?? "",
    ingresoFamiliar: g.ingreso_familiar_anual ?? "",
    personasCobertura: g.personas_cobertura ?? "",
    personasTaxes: g.personas_taxes ?? "",

    // Tags (etiquetas): el backend envía como "tags" (array) o puede venir como "etiquetas" (compatibilidad)
    // Validar que cada tag tenga key, label y color
    etiquetas: (() => {
      try {
        // El backend puede enviar como "tags" o "etiquetas" (compatibilidad)
        const tagsRaw = g.tags || g.etiquetas;
        
        console.log("📥 [mapFullToForm] Tags recibidas del backend (raw):", {
          tieneTags: !!g.tags,
          tieneEtiquetas: !!g.etiquetas,
          tipo: typeof tagsRaw,
          valor: tagsRaw,
          esArray: Array.isArray(tagsRaw),
          esString: typeof tagsRaw === "string"
        });

        let tagsArray = [];
        
        // Si viene como array directamente
        if (Array.isArray(tagsRaw)) {
          tagsArray = tagsRaw;
          console.log("📥 [mapFullToForm] Tags recibidas como array:", tagsArray);
        } 
        // Si viene como string JSON (compatibilidad con formato antiguo)
        else if (typeof tagsRaw === "string" && tagsRaw.trim()) {
          console.log("📥 [mapFullToForm] Tags recibidas como string JSON, parseando...");
          const parsed = JSON.parse(tagsRaw);
          if (Array.isArray(parsed)) {
            tagsArray = parsed;
            console.log("📥 [mapFullToForm] Tags parseadas exitosamente:", tagsArray);
          }
        }
        
        // Validar formato de cada tag: debe tener key, label y color
        const tagsValidas = tagsArray.filter(tag => {
          return (
            tag &&
            typeof tag === "object" &&
            tag.key &&
            tag.label &&
            tag.color &&
            typeof tag.key === "string" &&
            typeof tag.label === "string" &&
            typeof tag.color === "string" &&
            /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(tag.color) // Validar formato hex color
          );
        });
        
        console.log("✅ [mapFullToForm] Tags validadas:", {
          totalRecibidas: tagsArray.length,
          totalValidas: tagsValidas.length,
          tags: tagsValidas
        });
        
        return tagsValidas;
      } catch (error) {
        console.error("❌ Error al cargar tags desde el backend:", error);
        return [];
      }
    })(),
  };
};


// API FULL -> members para ProspectoDatos/TomaDeDatos (con campos raíz)
const mapFullToMembers = (fullRaw) => {
  const g = unwrapFull(fullRaw);
  const coberturas = Array.isArray(g.coberturas) ? g.coberturas : [];
  const date10 = (v) => (v ? String(v).slice(0, 10) : "");
  
  return coberturas.map((cov, idx) => {
    const cli = cov?.cliente || {};
    const primer  = formatDisplayName((cli.primer_nombre  || "").trim());
    const segundo = formatDisplayName((cli.segundo_nombre || "").trim());
    const apell   = formatDisplayName((cli.apellidos      || "").trim());
    const fecha   = cli.fecha_nacimiento || "";
    const edad    = calcAge(fecha);
    const nombreCompleto = formatDisplayName(
      cli.nombre_completo || [primer, segundo, apell].filter(Boolean).join(" ")
    );

    return {
      // -------- raíz (lo que usa el acordeón) --------
      id: cli.id ?? idx + 1,
      cliente_id: cli.id ?? null,
      cobertura_id: cov.id ?? null,

      // datos "cliente" copiados a raíz para edición inline
      primer_nombre: primer,
      segundo_nombre: segundo,
      apellidos: apell,
      nombreCompleto,
      genero: cli.genero || "",
      fecha_nacimiento: fecha,
      edad,
      idioma: cli.idioma || "",
      pais_origen: cli.pais_origen || "",
      // Campos antropométricos
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

      // metadatos de cobertura
      parentesco: cov.parentesco || "Tomador",
      tipo: cov.parentesco || "Tomador",
      estado_cobertura: cov.estado_cobertura || "Sí",
      cobertura_tipo: cov.cobertura_tipo || "Plan de salud",
      ano_cobertura: cov.ano_cobertura || new Date().getFullYear(),
      fecha_activacion: date10(cov.fecha_activacion ?? cov.fechaActivacion ?? null),
      plan: cov.plan ?? null,
      metal: cov.metal ?? null,
      red: cov.red ?? null,
      codigo_poliza: cov.codigo_poliza ?? cov.id_poliza ?? "",
      policy_number: cov.policy_number ?? "",
      elegibilidad: cov.elegibilidad ?? "",
      precio: cov.precio ?? "",
      tipo_pago: cov.tipo_pago ?? null,
      dia_pago: cov.dia_pago ?? "",
      nota_cancel: cov.nota_cancel ?? "",
      grupo: cov.grupo ?? "",
      compania_id: cov.compania_id ?? null,
      agente: cov.agente ?? "",
      pagador_id:  cov.pagador_id  ?? null,
      fecha_cancelacion: date10(cov.fecha_cancelacion ?? cov.fechaCancelacion ?? null),
      fecha_retiro: date10(cov.fecha_retiro ?? cov.fechaRetiro ?? null),
      nota_retiro: cov.nota_retiro ?? "",
      motivo_cancelacion: cov.motivo_cancelacion ?? "",
      motivo_retiro: cov.motivo_retiro ?? "",
      cobertura_definida: cov.cobertura_definida ?? "",
      // Campo para filtrar coberturas inactivas
      // Si viene del backend, usarlo; si no, asumir true (activo por defecto)
      activo: cov.activo !== undefined && cov.activo !== null ? cov.activo : true,
      // Campo vigente: preservar valor del backend
      vigente: cov.vigente !== undefined && cov.vigente !== null ? cov.vigente : true,


      // -------- también mantenemos el objeto cliente completo --------
      cliente: {
        id: cli.id ?? null,
        primer_nombre: primer,
        segundo_nombre: segundo,
        apellidos: apell,
        nombre_completo: nombreCompleto,
        genero: cli.genero || "",
        fecha_nacimiento: fecha,
        edad,
        idioma: cli.idioma || "",
        pais_origen: cli.pais_origen || "",
        // Campos antropométricos
        peso: cli.peso || "",
        altura: cli.altura || "",
        pulgadas: cli.pulgadas || "",

        // contacto
        telefono: cli.telefono || "",
        secundario: cli.secundario || "",
        whatsapp_num: cli.whatsapp_num || "",
        email: cli.email || "",
        nota: cli.nota || "",


     // si no trae, lo reconstruimos desde legacy para que el componente funcione ya.
             // ✅ Hidratar con ISO + indicativo cuando ya vienen en arreglo (tu BD actual)
       // ✅ soporta string JSON o array; si sigue vacío, cae a legacy
       telefonos: resolveClienteTelefonos(cli, "us"),

        // dirección
        direccion: cli.direccion || "",
        calle: cli.calle || "",
        apto: cli.apto || "",
        ciudad: cli.ciudad || "",
        estado: cli.estado || "",
        codigo_postal: cli.codigo_postal || "",
        condado: cli.condado || "",
        dir_correspondencia: cli.dir_correspondencia || "",

        // migratorio
        social: cli.social || "",
        status: cli.status || "",
        auscis: cli.auscis || "",
        tarjeta_numero: cli.tarjeta_numero || "",
        fecha_emision: cli.fecha_emision || "",
        fecha_expiracion: cli.fecha_expiracion || "",
        categoria: cli.categoria || "",

        // empleo/ingreso
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
      },
    };
  });
};

const buildNombreCompleto = (o = {}) =>
  [o.primer_nombre, o.segundo_nombre, o.apellidos]
    .map(v => (v || "").toString().trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
// ================== Componente ==================
const GrupoFamiliarDetail = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const anioUrl = useMemo(() => {
    const raw = Number(searchParams.get("anio"));
    return Number.isFinite(raw) && raw > 1900 ? raw : null;
  }, [searchParams]);

  const [estadoActual, setEstadoActual] = useState("PROSPECTO");
  const [formData, setFormData] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [productoCotizacion, setProductoCotizacion] = useState(null); // 👈 Nuevo estado
  const [showProductModal, setShowProductModal] = useState(false); // 👈 Nuevo estado
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [grupoCompleto, setGrupoCompleto] = useState(null); // 👈 Grupo completo para generar PDF

const [grupoVersion, setGrupoVersion] = useState(null);
  const [editBaseline, setEditBaseline] = useState(null);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [showRetiroModal, setShowRetiroModal] = useState(false);
  const [modoHistorico, setModoHistorico] = useState(false);
  const [periodoRelativo, setPeriodoRelativo] = useState("actual");
  const [anioConsultado, setAnioConsultado] = useState(ANIO_ACTUAL);
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [cierreAnio, setCierreAnio] = useState(null);
  const [cierreLoading, setCierreLoading] = useState(false);
  const [cierreError, setCierreError] = useState("");
  const esAnioPasado = periodoRelativo === "pasado";

  const { edicion, applyEdicionMeta, refreshEdicion, touchPresencia } = useGrupoFamiliarEdicionPresencia(id, {
    registrarPresencia: !loading && Boolean(id) && !esAnioPasado,
    activo: !esAnioPasado && (isEditing || saving),
  });

  const [toast, setToast] = useState({ show: false, type: "success", title: "", message: "" });
  const showToast = (type, title, message) => {
    setToast({ show: true, type, title, message });
    // Autocierre en 3.5s
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3500);
  };

  // ✅ Callback para actualizar estado local cuando el modal de retiro/cancelación guarda cambios
  // Este callback actualiza familyMembers sin llamar al backend
  // Recibe: datosRenovacion (array de objetos con cobertura_id, cliente_id, y campos de retiro/cancelación)
  //         grupoData (objeto opcional con datos del grupo)
  const handleRetiroUpdateLocal = useCallback((datosRenovacion, grupoData) => {
    console.log("🔄 [handleRetiroUpdateLocal] Actualizando estado local con cambios de retiro/cancelación:", {
      cantidadCoberturas: datosRenovacion.length,
      datosRenovacion,
      grupoData
    });

    // Actualizar familyMembers con los cambios de retiro/cancelación
    setFamilyMembers((prevMembers) => {
      if (!Array.isArray(prevMembers)) return prevMembers;
      
      return prevMembers.map((member) => {
        // Buscar si esta cobertura tiene cambios de retiro/cancelación
        // Buscar por cobertura_id (prioritario) o por cliente_id
        const datosCobertura = datosRenovacion.find(
          datos => {
            // Comparar por cobertura_id si existe
            if (datos.cobertura_id && member.cobertura_id) {
              return datos.cobertura_id === member.cobertura_id;
            }
            // Si no, comparar por cliente_id
            if (datos.cliente_id && member.cliente_id) {
              return datos.cliente_id === member.cliente_id;
            }
            return false;
          }
        );

        if (datosCobertura) {
          console.log("✅ [handleRetiroUpdateLocal] Actualizando miembro:", {
            cobertura_id: member.cobertura_id,
            cliente_id: member.cliente_id,
            cambios: {
              fecha_cancelacion: datosCobertura.fecha_cancelacion,
              fecha_retiro: datosCobertura.fecha_retiro,
              activo: datosCobertura.activo,
              vigente: datosCobertura.vigente,
              estado_cobertura: datosCobertura.estado_cobertura,
            }
          });

          // Formatear fechas a formato YYYY-MM-DD si vienen como string ISO
          const formatDate = (dateStr) => {
            if (!dateStr) return null;
            if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              return dateStr;
            }
            try {
              const d = new Date(dateStr);
              if (isNaN(d.getTime())) return null;
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              return `${year}-${month}-${day}`;
            } catch {
              return null;
            }
          };

          // Actualizar los campos de retiro/cancelación en el miembro
          const memberActualizado = {
            ...member,
            fecha_cancelacion: formatDate(datosCobertura.fecha_cancelacion),
            fecha_retiro: formatDate(datosCobertura.fecha_retiro),
            nota_cancel: datosCobertura.nota_cancel ?? member.nota_cancel ?? null,
            nota_retiro: datosCobertura.nota_retiro || null,
            activo: datosCobertura.activo !== undefined ? datosCobertura.activo : member.activo,
            vigente: datosCobertura.vigente !== undefined ? datosCobertura.vigente : member.vigente,
            estado_cobertura: datosCobertura.estado_cobertura || member.estado_cobertura,
            motivo_cancelacion: datosCobertura.motivo_cancelacion ?? member.motivo_cancelacion ?? null,
            motivo_retiro: datosCobertura.motivo_retiro ?? null,
            cobertura_definida: datosCobertura.cobertura_definida ?? member.cobertura_definida ?? null,
          };

          // También actualizar en el objeto cobertura si existe
          if (member.cobertura) {
            memberActualizado.cobertura = {
              ...member.cobertura,
              fecha_cancelacion: formatDate(datosCobertura.fecha_cancelacion),
              fecha_retiro: formatDate(datosCobertura.fecha_retiro),
              nota_cancel: datosCobertura.nota_cancel ?? member.cobertura.nota_cancel ?? null,
              nota_retiro: datosCobertura.nota_retiro || null,
              activo: datosCobertura.activo !== undefined ? datosCobertura.activo : member.cobertura.activo,
              vigente: datosCobertura.vigente !== undefined ? datosCobertura.vigente : member.cobertura.vigente,
              estado_cobertura: datosCobertura.estado_cobertura || member.cobertura.estado_cobertura,
              motivo_cancelacion: datosCobertura.motivo_cancelacion ?? member.cobertura.motivo_cancelacion ?? null,
              motivo_retiro: datosCobertura.motivo_retiro || null,
              cobertura_definida: datosCobertura.cobertura_definida ?? member.cobertura.cobertura_definida ?? null,
            };
          }

          return memberActualizado;
        }

        return member;
      });
    });

    showToast("success", "Cambios aplicados", "Los cambios de retiro/cancelación se aplicaron localmente. Usa 'Guardar' del grupo familiar para enviarlos al backend.");
  }, [showToast]);



  // Handler de cambios (respeta capitalizaciones que pediste)
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => {
      if (!prev) return prev;
      let v = value;
      
      // Manejar etiquetas como array directamente (tipo "json")
      if (type === "json" && name === "etiquetas") {
        // value ya viene como array desde GroupTags
        return { ...prev, [name]: Array.isArray(value) ? value : [] };
      }
      
      if (name === "nombre" || name === "apellidos") v = capitalizeWords(value);
      else if (
        (type === "text" || type === "textarea") &&
        !name.toLowerCase().includes("telefono") &&
        name !== "nota"
      )
        v = capitalizeFirst(value);
      return { ...prev, [name]: type === "checkbox" ? checked : v };
    });
  };

// Mantener ingresoFamiliar sincronizado con los miembros (detalle/edición)
useEffect(() => {
  if (!Array.isArray(familyMembers)) return;

  const total = calcIngresoFamiliar(familyMembers);

  setFormData(prev => {
    const cur = prev || {}; // protege null
    if (cur.ingresoFamiliar === total) return prev; // evita renders innecesarios
    return { ...cur, ingresoFamiliar: total };
  });
}, [familyMembers]);


// ✅ usar el estado real
const total = calcIngresoFamiliar(Array.isArray(familyMembers) ? familyMembers : []);
console.log("Ingreso Familiar:", total);



  // 👈 Nuevo: Manejador para selección de producto
  const handleProductSelect = (producto) => {
    setProductoCotizacion(producto);
    setShowProductModal(false);
  };

  // 👈 Nuevo: Manejador para cerrar modal
  const handleCloseModal = () => {
    setShowProductModal(false);
  };

  const reload = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data: full, meta } = await GrupoFamiliarService.fetchFullGrupo(id, {
        anio: anioUrl,
      });
      applyEdicionMeta(meta);
      const fullData = unwrapFull(full);

      const historico =
        Boolean(fullData?.modo_historico) ||
        Boolean(meta?.modo_historico) ||
        (anioUrl != null && anioUrl !== ANIO_ACTUAL);
      const anioResuelto =
        Number(fullData?.anio_consultado ?? meta?.anio_consultado ?? anioUrl ?? ANIO_ACTUAL) ||
        ANIO_ACTUAL;
      const relativoRaw =
        fullData?.periodo_relativo ?? meta?.periodo_relativo ?? null;
      const relativo =
        relativoRaw === "pasado" ||
        relativoRaw === "actual" ||
        relativoRaw === "futuro"
          ? relativoRaw
          : anioResuelto < ANIO_ACTUAL
            ? "pasado"
            : anioResuelto > ANIO_ACTUAL
              ? "futuro"
              : "actual";

      setModoHistorico(historico);
      setPeriodoRelativo(relativo);
      setAnioConsultado(anioResuelto);
      if (relativo === "pasado") {
        setIsEditing(false);
        setEditBaseline(null);
        setShowRetiroModal(false);
      }
  
      setFormData(mapFullToForm(full));
      setGrupoVersion(meta?.grupo_version || fullData?.updated_at || fullData?.updatedAt || null);
      setFamilyMembers(mapFullToMembers(full));
      
      // 👈 Guardar grupo completo para generar PDF de confirmación
      setGrupoCompleto(fullData);

      // 👈 Nuevo: Extraer producto de las coberturas
      const producto = getProductoFromCoberturas(fullData.coberturas || []);
      setProductoCotizacion(producto);
  
      const code = toEstadoCode(fullData?.estado_actual) || "PROSPECTO";
      setEstadoActual(code);
    } catch (err) {
      console.error(err);
      setLoadError(err?.message || "No se pudo cargar el grupo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, anioUrl]);

  useEffect(() => {
    if (!id) {
      setAniosDisponibles([]);
      return;
    }

    let cancelled = false;
    const loadAnios = async () => {
      try {
        const anios = await GrupoFamiliarService.getAniosDisponibles(id);
        if (cancelled) return;
        const normalizados = (Array.isArray(anios) ? anios : [])
          .map((y) => Number(y))
          .filter((y) => Number.isFinite(y) && y > 1900);
        // Asegura que el año actual aparezca en el selector cuando hay otros años.
        if (normalizados.length > 0 && !normalizados.includes(ANIO_ACTUAL)) {
          normalizados.push(ANIO_ACTUAL);
        }
        setAniosDisponibles(Array.from(new Set(normalizados)).sort((a, b) => b - a));
      } catch (err) {
        if (!cancelled) {
          console.error("Error al cargar años disponibles del grupo:", err);
          setAniosDisponibles([]);
        }
      }
    };

    loadAnios();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleAnioConsultaChange = (year) => {
    const next = Number(year);
    const params = new URLSearchParams(searchParams);
    if (!Number.isFinite(next) || next === ANIO_ACTUAL) {
      params.delete("anio");
    } else {
      params.set("anio", String(next));
    }
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    if (!esAnioPasado || !id || !anioConsultado) {
      setCierreAnio(null);
      setCierreError("");
      return;
    }

    let cancelled = false;
    const loadCierre = async () => {
      setCierreLoading(true);
      setCierreError("");
      try {
        const data = await GrupoFamiliarService.getCierreAnio(id, anioConsultado);
        if (!cancelled) setCierreAnio(data);
      } catch (err) {
        if (!cancelled) {
          setCierreAnio(null);
          setCierreError(err?.message || "No se pudo cargar el cierre del año.");
        }
      } finally {
        if (!cancelled) setCierreLoading(false);
      }
    };

    loadCierre();
    return () => {
      cancelled = true;
    };
  }, [esAnioPasado, id, anioConsultado]);

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showActionsDropdown && !event.target.closest('.dropdown')) {
        setShowActionsDropdown(false);
      }
      if (showSaveDropdown && !event.target.closest('.btn-group')) {
        setShowSaveDropdown(false);
      }
    };

    if (showActionsDropdown || showSaveDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showActionsDropdown, showSaveDropdown]);
// Mantener ingresoFamiliar sincronizado con los miembros (detalle/edición)
useEffect(() => {
  if (!Array.isArray(familyMembers) || !formData) return;
  const total = calcIngresoFamiliar(familyMembers);

  setFormData(prev => {
    if (!prev) return prev;
    // evita renders innecesarios
    return prev.ingresoFamiliar === total ? prev : { ...prev, ingresoFamiliar: total };
  });
}, [familyMembers, formData]);


  // Utilidad: mapea la respuesta {cliente, cobertura} a tu shape de card
const mapMemberFromAppendResponse = (res) => {
  const cli = res?.cliente || {};
  const cov = res?.cobertura || {};
  const nombreCompleto = formatDisplayName(
    [cli.primer_nombre, cli.segundo_nombre, cli.apellidos].filter(Boolean).join(" ")
  );

  return {
    id: cli.id,
    cliente_id: cli.id,
    cobertura_id: cov.id,
    cobertura_tipo: cov.cobertura_tipo || res?.cobertura_tipo || "Plan de salud",
    primer_nombre: formatDisplayName(cli.primer_nombre || ""),
    segundo_nombre: formatDisplayName(cli.segundo_nombre || ""),
    apellidos: formatDisplayName(cli.apellidos || ""),
    genero: cli.genero || "",
    idioma: cli.idioma || "",
    nombreCompleto,
    fecha_nacimiento: cli.fecha_nacimiento || "",
    edad: calcAge(cli.fecha_nacimiento),
    // Campos antropométricos
    peso: cli.peso || "",
    altura: cli.altura || "",
    pulgadas: cli.pulgadas || "",
    ingreso_anual: cli.ingreso_anual || 0,
    parentesco: cov.parentesco || "Tomador",
    tipo: cov.parentesco || "Tomador",
    plan: cov.plan || null,
    metal: cov.metal || null,
    red: cov.red || null,
    ano_cobertura: cov.ano_cobertura || null,
    fecha_activacion: cov.fecha_activacion || "",
    elegibilidad: cov.elegibilidad || "",
    compania_id: cov.compania_id || "",
    agente: cov.agente || "",
    pagador_id: cov.pagador_id || "",
    tipo_pago: cov.tipo_pago || "",
    dia_pago: cov.dia_pago || "",
    precio: cov.precio ?? "",
    fecha_cancelacion: cov.fecha_cancelacion || "",
    fecha_retiro: cov.fecha_retiro || "",
    nota_retiro: cov.nota_retiro || "",
    codigo_poliza: cov.codigo_poliza || "",
    estado_cobertura: cov.estado_cobertura || "Sí",
    activo: cov.activo !== undefined && cov.activo !== null ? cov.activo : true,
    vigente: cov.vigente !== undefined && cov.vigente !== null ? cov.vigente : true,
    whatsapp: !!cli.whatsapp,
    telegram: !!cli.telegram,
    texto_sms: !!cli.texto_sms,
    cliente: {
      ...cli,
      primer_nombre: formatDisplayName(cli.primer_nombre || ""),
      segundo_nombre: formatDisplayName(cli.segundo_nombre || ""),
      apellidos: formatDisplayName(cli.apellidos || ""),
      nombre_completo: nombreCompleto,
      whatsapp: !!cli.whatsapp,
      telegram: !!cli.telegram,
      texto_sms: !!cli.texto_sms,
    },
  };
};

// 👇 llamada real al backend para alta en edición
const handleCreateMemberRemote = async (memberData) => {
  // Validación de seguridad
  if (!memberData) {
    console.error("❌ memberData es undefined");
    showToast("danger", "Error", "No se recibieron datos del miembro");
    return;
  }

  // 🔧 Construir nombre_completo de forma más robusta
  const construirNombre = (data) => {
    const primer = (data.primer_nombre || "").toString().trim();
    const segundo = (data.segundo_nombre || "").toString().trim();
    const apellidos = (data.apellidos || "").toString().trim();
    
    return [primer, segundo, apellidos]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Priorizar: nombre ya construido > construir desde campos
  const nombreCompleto = formatDisplayName(
    memberData?.nombre_completo?.trim() ||
    memberData?.nombreCompleto?.trim() ||
    construirNombre(memberData)
  );
  const primerNombre = formatDisplayName((memberData.primer_nombre || "").toString().trim());
  const segundoNombre = formatDisplayName((memberData.segundo_nombre || "").toString().trim());
  const apellidosFmt = formatDisplayName((memberData.apellidos || "").toString().trim());

  console.log("📝 Creando miembro con nombre_completo:", nombreCompleto);
  console.log("📋 Datos originales:", {
    primer: memberData.primer_nombre,
    segundo: memberData.segundo_nombre,
    apellidos: memberData.apellidos,
    nombre_ya_construido: memberData.nombre_completo || memberData.nombreCompleto
  });

  // Normalizar ingreso_anual a número
  const ingresoAnual = typeof memberData.ingreso_anual === "number" 
    ? memberData.ingreso_anual 
    : (parseMoney(String(memberData.ingreso_anual || "")) || 0);

  const src = memberData?.cliente && typeof memberData.cliente === "object"
    ? { ...memberData.cliente, ...memberData }
    : memberData;

  let ingresoOcasionalAnualNum =
    typeof src?.ingreso_ocasional_anual === "number"
      ? src.ingreso_ocasional_anual
      : parseMoney(String(src?.ingreso_ocasional_anual ?? ""));
  if (!ingresoOcasionalAnualNum) {
    ingresoOcasionalAnualNum = computeAnnual(
      src?.periodo_ingreso_ocasional,
      src?.ingreso_por_periodo_ocasional
    );
  }

  const pickStr = (k) => {
    const v = src?.[k];
    if (v == null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };

  const pickMoney = (k) => {
    const n = parseMoney(String(src?.[k] ?? ""));
    return Number.isFinite(n) && n !== 0 ? Math.min(Number(n.toFixed(2)), 99999999.99) : null;
  };

  // payload mínimo: cliente nuevo + cobertura
  const payload = {
    request_id: crypto?.randomUUID?.() ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    grupo_version: grupoVersion,
    cliente_nuevo: {
      primer_nombre: primerNombre,
      segundo_nombre: segundoNombre,
      apellidos: apellidosFmt,
      nombre_completo: nombreCompleto,
      fecha_nacimiento: memberData.fecha_nacimiento || null,
      genero: memberData.genero || null,
      idioma: memberData.idioma || null,
      ingreso_anual: ingresoAnual,
      ...(ingresoOcasionalAnualNum
        ? {
            ingreso_ocasional_anual: Math.min(
              Number(Number(ingresoOcasionalAnualNum).toFixed(2)),
              99999999.99
            ),
          }
        : {}),
      ...(pickStr("tipo_ingreso") ? { tipo_ingreso: pickStr("tipo_ingreso") } : {}),
      ...(pickStr("actividad_economica") ? { actividad_economica: pickStr("actividad_economica") } : {}),
      ...(pickStr("empleador") ? { empleador: pickStr("empleador") } : {}),
      ...(pickStr("telefono_empleador") ? { telefono_empleador: pickStr("telefono_empleador") } : {}),
      ...(pickStr("periodo_ingreso") ? { periodo_ingreso: pickStr("periodo_ingreso") } : {}),
      ...(pickMoney("ingreso_por_periodo") != null ? { ingreso_por_periodo: pickMoney("ingreso_por_periodo") } : {}),
      ...(pickStr("nota_ingreso_ocasional") ? { nota_ingreso_ocasional: pickStr("nota_ingreso_ocasional") } : {}),
      ...(pickStr("periodo_ingreso_ocasional")
        ? { periodo_ingreso_ocasional: pickStr("periodo_ingreso_ocasional") }
        : {}),
      ...(pickMoney("ingreso_por_periodo_ocasional") != null
        ? { ingreso_por_periodo_ocasional: pickMoney("ingreso_por_periodo_ocasional") }
        : {}),
      nota: memberData.nota || null,
      // 📞 Enviar arreglo completo de teléfonos y también el campo legacy "telefono"
      telefonos: toApiPhones(memberData.telefonos || []),
      telefono: (() => {
        const list = Array.isArray(memberData.telefonos)
          ? memberData.telefonos
          : [];
        if (!list.length) return null;
        const principal = list.find((t) => t.principal) || list[0];
        return principal?.numero || null;
      })(),
      direccion: memberData.direccion || memberData?.cliente?.direccion || null,
      calle: memberData.calle || memberData?.cliente?.calle || null,
      apto: memberData.apto || memberData?.cliente?.apto || null,
      ciudad: memberData.ciudad || memberData?.cliente?.ciudad || null,
      estado: memberData.estado || memberData?.cliente?.estado || null,
      codigo_postal: memberData.codigo_postal || memberData?.cliente?.codigo_postal || null,
      condado: memberData.condado || memberData?.cliente?.condado || null,
      dir_correspondencia: memberData.dir_correspondencia || memberData?.cliente?.dir_correspondencia || null,
    },
    parentesco: memberData.parentesco || memberData.tipo || "Tomador",
    cobertura: {
      cobertura_tipo: productoCotizacion?.label || "Plan de salud",
      estado_cobertura: memberData.estado_cobertura || "Sí",
      ano_cobertura: String(memberData.ano_cobertura || new Date().getFullYear()),
      fecha_activacion: memberData.fecha_activacion 
        ? String(memberData.fecha_activacion).slice(0,10)
        : null,
      pagador_id: null,
      dia_pago: 1,
      tipo_pago: null,
      compania_id: null,
      agente: "",
      precio: 0,
    },
  };

  console.log("📤 Payload a enviar:", JSON.stringify(payload, null, 2));

  try {
    const res = await GrupoFamiliarService.appendMiembro(id, payload);
    const data = unwrapFull(res)?.data || unwrapFull(res);
    const nuevo = mapMemberFromAppendResponse(data?.miembro || {});

    setFamilyMembers((prev) => {
      const next = [...(prev ?? []), nuevo];
      handleDerivedCounts(deriveCounts(next));
      return next;
    });

    if (data?.personas_taxes != null || data?.personas_cobertura != null) {
      handleDerivedCounts({
        taxes: data.personas_taxes,
        cobertura: data.personas_cobertura,
      });
    }

    if (data?.grupo_version) setGrupoVersion(data.grupo_version);

    await reload();
    showToast("success", "Miembro agregado", `${nombreCompleto} fue creado exitosamente.`);
    return nuevo;
  } catch (error) {
    console.error("❌ Error al crear miembro:", error);
    showToast("danger", "Error al crear miembro", error?.message || "No se pudo crear el miembro");
  }
};


  const advanceState = async (targetCode) => {
    setAdvancing(true);
    try {
      await GrupoFamiliarService.setEstado(id, targetCode, `Cambio a ${targetCode}`);
      setEstadoActual(targetCode);
      await reload();
      showToast("success", "Etapa actualizada", `Ahora estás en ${targetCode}.`);
    } catch (e) {
      showToast("danger", "Error al cambiar de etapa", e?.message || "No fue posible cambiar de etapa.");
    } finally {
      setAdvancing(false);
    }
  };

  const formatTodayLocal = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const descartarCoberturasDelGrupo = async () => {
    const fechaHoy = formatTodayLocal();
    const coberturasIds = Array.from(
      new Set(
        (Array.isArray(familyMembers) ? familyMembers : [])
          .map((m) => m?.cobertura_id)
          .filter(Boolean)
      )
    );

    if (!coberturasIds.length) return;

    await Promise.all(
      coberturasIds.map((coberturaId) =>
        GrupoFamiliarService.updateCobertura(coberturaId, {
          activo: false,
          vigente: false,
          estado_cobertura: "No",
          fecha_cancelacion: fechaHoy,
          fecha_retiro: fechaHoy,
        })
      )
    );
  };

  const handleDerivedCounts = useCallback(({ taxes, cobertura }) => {
    setFormData(prev => {
      if (!prev) return prev;
      const nextTaxes = taxes ?? prev.personasTaxes;
      const nextCobertura = cobertura ?? prev.personasCobertura;
      if (prev.personasTaxes === nextTaxes && prev.personasCobertura === nextCobertura) return prev;
      return { ...prev, personasTaxes: nextTaxes, personasCobertura: nextCobertura };
    });
  }, []);
  useEffect(() => {
    if (!Array.isArray(familyMembers)) return;
    const { taxes, cobertura } = deriveCounts(familyMembers);
    handleDerivedCounts({ taxes, cobertura });
  }, [familyMembers, handleDerivedCounts]);




  const handleSave = async (alsoAdvance = false) => {
    try {
      setSaving(true);

           // 1) Crear primero los miembros NUEVOS (sin cliente_id)
    const nuevos = (familyMembers || []).filter(m => !m?.cliente_id);
    for (const m of nuevos) {
      const cliNuevo = mapClienteForSave(m);
      
      // Validar que mapClienteForSave retornó un objeto válido
      if (!cliNuevo) {
        console.error("❌ No se pudo mapear el cliente:", m);
        continue; // Saltar este miembro
      }
      
      delete cliNuevo.id;

       let cov = mapCoberturaFromMember(m, id);
       if (productoCotizacion?.label) cov.cobertura_tipo = productoCotizacion?.label;

       await GrupoFamiliarService.appendMiembro(id, {
         request_id: crypto?.randomUUID?.() ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
         grupo_version: grupoVersion,
         cliente_nuevo: cliNuevo,
         parentesco: m.parentesco || m.tipo || "Tomador",
         cobertura: {
           ...cov,
           // el backend asigna ids; evitamos mandar ids locales
           id: undefined,
           cliente_id: undefined,
         },
       });
     }

     

   
// 2) Actualizar los EXISTENTES
const { grupoPayload, clientesPayload, coberturasPayload } = buildFullUpdatePayloadParts(
  formData,
  familyMembers,
  id,
  productoCotizacion
);

      console.log("💾 [handleSave] Payload del grupo familiar preparado:", {
        ...grupoPayload,
        tags: grupoPayload.tags ?
          (Array.isArray(grupoPayload.tags) ?
            `[Array con ${grupoPayload.tags.length} tags]` :
            grupoPayload.tags) :
          null
      });

                    // 🔎 DEBUG: verifica que cada cobertura lleve fecha_activacion
     try {
       console.table(
         coberturasPayload.map(c => ({
           id: c.id,
           cliente_id: c.cliente_id,
           fecha_activacion: c.fecha_activacion,
           estado_cobertura: c.estado_cobertura,
         }))
       );
     } catch (_) {}

      let presenciaAlGuardar = edicion;
      try {
        await touchPresencia?.();
        const presenciaActual = await GrupoFamiliarService.getEdicionPresencia(id);
        if (presenciaActual && typeof presenciaActual.alerta === "boolean") {
          presenciaAlGuardar = presenciaActual;
        }
      } catch (_) {
        // Si falla el polling puntual, usar el estado local de presencia.
      }

      const baselinePayload = editBaseline
        ? buildFullUpdatePayloadParts(
            editBaseline.formData,
            editBaseline.familyMembers,
            id,
            productoCotizacion
          )
        : null;

      const cambios = baselinePayload
        ? buildDeltaCambiosFromPayloads({
            baselineGrupo: baselinePayload.grupoPayload,
            currentGrupo: grupoPayload,
            baselineClientes: baselinePayload.clientesPayload,
            currentClientes: clientesPayload,
            baselineCoberturas: baselinePayload.coberturasPayload,
            currentCoberturas: coberturasPayload,
          })
        : {};

      const hayCambiosDelta = Object.keys(cambios).length > 0;
      const otrosEditores = (presenciaAlGuardar?.editores ?? []).length > 0;
      const hayAlertaConcurrencia = Boolean(presenciaAlGuardar?.alerta || otrosEditores);
      // Delta solo con concurrencia real. Sin ella se envía el payload legacy completo
      // (si siempre mandamos `cambios`, el backend podía ignorar clientes/coberturas).
      const useDeltaSave = Boolean(editBaseline && hayCambiosDelta && hayAlertaConcurrencia);

      let finalPayload = {
        ...grupoPayload,
        clientes: clientesPayload,
        coberturas: coberturasPayload,
        grupo_version: grupoVersion,
      };

      if (useDeltaSave) {
        finalPayload.modo = "delta";
        finalPayload.cambios = cambios;
      }

      console.log("🚀 [handleSave] Payload FINAL que se envía al backend (fullUpdate):", {
        grupoId: id,
        modo: useDeltaSave ? "delta" : "legacy",
        hayAlertaConcurrencia,
        incluyeCambiosDelta: useDeltaSave,
        grupoPayload: {
          ...grupoPayload,
          tags: grupoPayload.tags ? 
            (Array.isArray(grupoPayload.tags) ? 
              `[Array con ${grupoPayload.tags.length} tags]` : 
              grupoPayload.tags) : 
            null
        },
        cantidadClientes: clientesPayload.length,
        cantidadCoberturas: coberturasPayload.length,
        payloadCompleto: finalPayload,
        tagsEnPayload: finalPayload.tags
      });

      const saveResponse = await GrupoFamiliarService.fullUpdate(id, finalPayload);
      if (saveResponse?.data?.grupo_version) {
        setGrupoVersion(saveResponse.data.grupo_version);
      }

      if (alsoAdvance) {
        const from = (estadoActual || "").toUpperCase();
        const to = nextOf(from);
        if (!to) {
          showToast("warning", "No hay siguiente etapa", "No existe transición disponible.");
        } else if (!canAdvance(from, to, { formData, familyMembers })) {
          showToast("warning", "Faltan datos", "Completa los requisitos antes de avanzar.");
        } else {
          const ok = window.confirm(`¿Guardar y pasar a ${to}?`);
          if (ok) await advanceState(to);
        }
      }

      setIsEditing(false);
      setEditBaseline(null);
      await reload();
      showToast("success", alsoAdvance ? "Guardado y etapa actualizada" : "Actualización exitosa", "");
    } catch (e) {
      if (e?.response?.code === "VERSION_CONFLICT") {
        showToast(
          "warning",
          "Conflicto de versión",
          e?.message || "Otro usuario guardó cambios. Recarga el formulario e intenta de nuevo."
        );
        await reload();
        return;
      }
      showToast("danger", "Error al actualizar", e?.message || "No se pudo guardar los cambios.");
    } finally {
      setSaving(false);
    }
    
  };
  

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600 inline-block mr-2" role="status" />
        Cargando...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-center">
          <i className="fa fa-triangle-exclamation mr-2" />
          <div>{loadError}</div>
        </div>
        <button className="mt-4 px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-600 hover:text-white transition-colors" onClick={reload}>
          Reintentar
        </button>
      </div>
    );
  }
  const isProspecto = toEstadoCode(estadoActual) === 'PROSPECTO';
  const canAddMember = esAnioPasado ? false : (isProspecto ? true : isEditing);
  const readOnly = esAnioPasado || !isEditing;


  

  return (
    <div className="w-full bg-gray-100 min-h-screen py-4">
     <div className="container mx-auto px-4 py-4">
  <div className="bg-white shadow-sm border-0 rounded-2xl px-4 py-4">
    {/* Aquí dentro va TODO el contenido actual */}

        {/* Toast flotante */}
        <div
          className="fixed top-0 right-0 p-3"
          style={{ zIndex: 1080 }}
        >
          <div
            className={`bg-white border rounded-lg shadow-lg ${toast.show ? "opacity-100" : "opacity-0"}`}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            style={{
              transition: "opacity 200ms ease",
              minWidth: 320,
              pointerEvents: toast.show ? "auto" : "none"
            }}
          >
            <div className={`px-4 py-2 rounded-t-lg ${
              toast.type === "success" ? "bg-green-600" :
              toast.type === "danger" ? "bg-red-600" :
              toast.type === "warning" ? "bg-yellow-600" :
              toast.type === "info" ? "bg-blue-600" :
              "bg-gray-600"
            } text-white flex items-center justify-between`}>
              <strong className="flex-1">{toast.title || "Notificación"}</strong>
              <button
                type="button"
                className="ml-2 mb-1 text-white hover:text-gray-200 text-xl leading-none"
                aria-label="Close"
                onClick={() => setToast((t) => ({ ...t, show: false }))}
              >
                ×
              </button>
            </div>
            {toast.message && (
              <div className="px-4 py-3 bg-white text-gray-900 rounded-b-lg">
                {toast.message}
              </div>
            )}
          </div>
        </div>

        <GrupoFamiliarEdicionAlerta edicion={edicion} />

        {aniosDisponibles.length > 1 && (
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div className="d-flex align-items-center gap-2">
              <i className="fas fa-calendar-alt text-primary" aria-hidden="true" />
              <label
                htmlFor="consultar-anio-grupo"
                className="mb-0 fw-semibold text-muted"
                style={{ fontSize: "0.9rem" }}
              >
                Consultar año anterior
              </label>
              <Form.Select
                id="consultar-anio-grupo"
                size="sm"
                style={{ width: "auto", minWidth: "8.5rem" }}
                value={anioConsultado || ANIO_ACTUAL}
                onChange={(e) => handleAnioConsultaChange(e.target.value)}
                aria-label="Consultar año anterior del grupo familiar"
              >
                {aniosDisponibles.map((year) => (
                  <option key={year} value={year}>
                    {year}
                    {year === ANIO_ACTUAL ? " (actual)" : ""}
                  </option>
                ))}
              </Form.Select>
            </div>
          </div>
        )}

        {periodoRelativo === "pasado" && (
          <Alert variant="warning" className="d-flex align-items-center gap-2 mb-3">
            <i className="fas fa-history" aria-hidden="true" />
            <div>
              Viendo el cierre del año {anioConsultado} — histórico, solo lectura
            </div>
          </Alert>
        )}

        {periodoRelativo === "futuro" && (
          <Alert variant="info" className="d-flex align-items-center gap-2 mb-3">
            <i className="fas fa-clock" aria-hidden="true" />
            <div>
              Estás viendo una renovación anticipada para el año {anioConsultado}{" "}
              — todavía no está vigente. Puedes seguir ajustando estos datos
              hasta que llegue la fecha de activación.
            </div>
          </Alert>
        )}

        {/* 👈 Nuevo: Modal de selección de producto */}
        <ProductoCotizacionModal
          open={showProductModal}
          onSelect={handleProductSelect}
          onClose={handleCloseModal}
        />

        <ProspectoBarra 
          currentCode={estadoActual}
          grupoId={id}
          onDescartar={esAnioPasado ? undefined : async () => {
            await descartarCoberturasDelGrupo();
            await advanceState("DESCARTADO");
          }}
          onReactivarSeguimiento={esAnioPasado ? undefined : async () => {
            await advanceState("SEGUIMIENTO");
          }}
        />





        {!esAnioPasado && (
        <div className="d-flex justify-content-end mb-3">
          {readOnly ? (
            <div className="d-flex gap-2">
              <button 
                type="button"
                className="btn btn-primary" 
                onClick={async () => {
                  setEditBaseline({
                    formData: cloneEditSnapshot(formData),
                    familyMembers: cloneEditSnapshot(familyMembers),
                  });
                  setIsEditing(true);
                  await touchPresencia?.();
                  await refreshEdicion?.();
                }}
              >
                <i className="fas fa-edit me-2"></i>
                Editar
              </button>

              {nextOf(estadoActual) && (
                <div className="dropdown">
                  <button
                    type="button"
                    className="btn btn-outline-secondary dropdown-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowActionsDropdown(!showActionsDropdown);
                    }}
                    disabled={advancing}
                  >
                    <i className="fas fa-cog me-2"></i>
                    Acciones
                  </button>
                  {showActionsDropdown && (
                    <ul className="dropdown-menu show" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 1000 }}>
                      <li>
                        <button
                          className="dropdown-item"
                          disabled={advancing}
                          onClick={async () => {
                            setShowActionsDropdown(false);
                            const from = (estadoActual || "").toUpperCase();
                            const to = nextOf(from);
                            if (!canAdvance(from, to, { formData, familyMembers })) {
                              showToast("warning", "No disponible", "No puedes avanzar todavía.");
                              return;
                            }
                            const ok = window.confirm(`¿Pasar a ${to}?`);
                            if (!ok) return;
                            await advanceState(to);
                          }}
                        >
                          <i className="fas fa-arrow-right me-2"></i>
                          Pasar a {nextOf(estadoActual)}
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => { setEditBaseline(null); setIsEditing(false); reload(); }}
                disabled={saving || advancing}
              >
                <i className="fas fa-times me-2"></i>
                Cancelar
              </button>

              {nextOf(estadoActual) ? (
                <div className="btn-group">
                  <button 
                    type="button"
                    className="btn btn-success"
                    onClick={() => handleSave(false)} 
                    disabled={saving || advancing}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" />
                        Guardando…
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save me-2"></i>
                        Guardar
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-success dropdown-toggle dropdown-toggle-split"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSaveDropdown(!showSaveDropdown);
                    }}
                    disabled={saving || advancing}
                  >
                    <span className="visually-hidden">Toggle Dropdown</span>
                  </button>
                  {showSaveDropdown && (
                    <ul className="dropdown-menu show" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 1000 }}>
                      <li>
                        <button 
                          className="dropdown-item" 
                          onClick={() => {
                            setShowSaveDropdown(false);
                            handleSave(true);
                          }} 
                          disabled={saving || advancing}
                        >
                          <i className="fas fa-arrow-right me-2"></i>
                          Guardar y pasar a {nextOf(estadoActual)}
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              ) : (
                <button 
                  type="button"
                  className="btn btn-success"
                  onClick={() => handleSave(false)} 
                  disabled={saving || advancing}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save me-2"></i>
                      Guardar
                    </>
                  )}
                </button>
              )}
            </div>
          )}
             </div>
        )}
                {/* 👈 Nuevo: Mostrar producto seleccionado */}
             {productoCotizacion && (
             <div className="bg-white mb-4 border-0 shadow-sm rounded-lg">
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <i className="fas fa-shield-alt text-blue-600 mr-2"></i>
                            <span className="font-bold text-gray-500 mr-2">Plan seleccionado:</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              productoCotizacion?.color === 'primary' ? 'bg-blue-600 text-white' :
                              productoCotizacion?.color === 'success' ? 'bg-green-600 text-white' :
                              productoCotizacion?.color === 'info' ? 'bg-cyan-600 text-white' :
                              productoCotizacion?.color === 'warning' ? 'bg-yellow-600 text-white' :
                              productoCotizacion?.color === 'danger' ? 'bg-red-600 text-white' :
                              'bg-gray-600 text-white'
                            }`}>
                              {productoCotizacion?.label || 'Sin plan'}
                      </span>
                    </div>
                    {isEditing && !esAnioPasado && (
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-600 hover:text-white transition-colors"
                        onClick={() => setShowProductModal(true)}
                      >
                        <i className="fas fa-edit mr-1"></i>
                        Cambiar plan
                      </button>
                    )}
                  </div>
                </div>
              </div>
             )}

        {periodoRelativo === "pasado" && (
          <div className="card mb-4 shadow-sm border-0">
            <div className="card-header bg-light">
              <h5 className="mb-0 fw-semibold">
                <i className="fas fa-clipboard-list text-primary me-2"></i>
                Qué pasó este año ({anioConsultado})
              </h5>
            </div>
            <div className="card-body">
              {cierreLoading && (
                <div className="text-muted">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Cargando cierre del año…
                </div>
              )}
              {cierreError && (
                <div className="alert alert-danger mb-0">{cierreError}</div>
              )}
              {!cierreLoading && !cierreError && cierreAnio && (
                <>
                  <h6 className="fw-semibold text-danger mb-2">Retiros / cierres</h6>
                  {(cierreAnio.retiros || []).length === 0 ? (
                    <p className="text-muted small">No hubo retiros registrados este año.</p>
                  ) : (
                    <ul className="list-group mb-4">
                      {(cierreAnio.retiros || []).map((retiro, idx) => (
                        <li
                          key={`${retiro.cobertura_id || "r"}-${idx}`}
                          className="list-group-item"
                        >
                          <div className="fw-semibold">
                            {retiro.cliente_nombre || `Cobertura #${retiro.cobertura_id}`}
                          </div>
                          <div className="small text-muted">
                            Fecha: {formatFechaCorta(retiro.fecha_retiro || retiro.fecha_cancelacion)}
                            {retiro.motivo_cancelacion
                              ? ` · Motivo: ${retiro.motivo_cancelacion}`
                              : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <h6 className="fw-semibold text-success mb-2">Renovaciones</h6>
                  {cierreAnio.sin_proceso_renovacion_formal ? (
                    <div className="alert alert-info mb-0">
                      Este año no tiene un proceso de renovación formal registrado.
                    </div>
                  ) : (
                    <div className="row g-3">
                      <div className="col-md-4">
                        <div className="border rounded p-3 h-100">
                          <div className="fw-semibold mb-2 text-success">Renovadas</div>
                          {(cierreAnio.renovaciones?.renovadas || []).length === 0 ? (
                            <p className="text-muted small mb-0">Ninguna</p>
                          ) : (
                            <ul className="list-unstyled mb-0 small">
                              {(cierreAnio.renovaciones?.renovadas || []).map((item, idx) => (
                                <li key={`ren-${item.cobertura_id}-${idx}`} className="mb-2">
                                  <div className="fw-semibold">{item.cliente_nombre || `#${item.cobertura_id}`}</div>
                                  {item.detalle && <div className="text-muted">{item.detalle}</div>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="border rounded p-3 h-100">
                          <div className="fw-semibold mb-2 text-secondary">Omitidas</div>
                          {(cierreAnio.renovaciones?.omitidas || []).length === 0 ? (
                            <p className="text-muted small mb-0">Ninguna</p>
                          ) : (
                            <ul className="list-unstyled mb-0 small">
                              {(cierreAnio.renovaciones?.omitidas || []).map((item, idx) => (
                                <li key={`omit-${item.cobertura_id}-${idx}`} className="mb-2">
                                  <div className="fw-semibold">{item.cliente_nombre || `#${item.cobertura_id}`}</div>
                                  {item.detalle && <div className="text-muted">{item.detalle}</div>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      {(cierreAnio.renovaciones?.con_error || []).length > 0 && (
                        <div className="col-md-4">
                          <div className="border border-danger rounded p-3 h-100 bg-danger-subtle">
                            <div className="fw-semibold mb-2 text-danger">
                              <i className="fas fa-exclamation-circle me-1" />
                              Con error
                            </div>
                            <ul className="list-unstyled mb-0 small">
                              {(cierreAnio.renovaciones?.con_error || []).map((item, idx) => (
                                <li key={`err-${item.cobertura_id}-${idx}`} className="mb-2">
                                  <div className="fw-semibold">{item.cliente_nombre || `#${item.cobertura_id}`}</div>
                                  {item.detalle && <div className="text-danger">{item.detalle}</div>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Captación + económicos */}
        <Prospectogrupo
          
          formData={formData}
          onChange={handleInputChange}
          readOnly={readOnly}
          modoHistorico={modoHistorico}
          grupoFamiliarId={id}
          onRefresh={reload} // Pasar función de reload para refrescar después de cancelar coberturas
          estadoActual={estadoActual} // Pasar estado actual para validar visibilidad de botones
          grupo={grupoCompleto} // Pasar grupo completo para generar PDF de confirmación
        />
        
        {["TOMA_DATOS", "INSCRIPCION_INI", "GRUPO_FAMILIAR"].includes(
          (estadoActual || "").toUpperCase()
        ) ? (
          <TomaDeDatos
          grupoFamiliarId={id}  
          familyMembers={familyMembers}
          setFamilyMembers={setFamilyMembers}
          estadoActual={estadoActual}
          readOnly={readOnly}
          canAdd={canAddMember}
          isProspecto={isProspecto}
          defaultCoberturaTipo={productoCotizacion?.label || "Plan de salud"}
          onCreateMemberRemote={handleCreateMemberRemote}
          onSaveCobertura={() => {}}
          onDerivedCounts={handleDerivedCounts}
        />
        
        ) : (
          <ProspectoDatos
              grupoFamiliarId={id}      
                familyMembers={familyMembers}
                setFamilyMembers={setFamilyMembers}
                readOnly={readOnly}
                canAdd={canAddMember}
                estadoActual={estadoActual}
                defaultCoberturaTipo={productoCotizacion?.label || "Plan de salud"}   
                isProspecto={isProspecto}                                       
                onCreateMemberRemote={handleCreateMemberRemote}                      
                onBlockedAddClick={() =>
                  showToast(
                    'info',
                    'Añadir no disponible',
                    'Activa “Editar” y asegúrate de que el estado no sea Prospecto.'
                  )
                }
                onSaveCobertura={() => {}}
                onDerivedCounts={handleDerivedCounts}
              />


        )}

        {/* ✅ Modal de Retiro/Cancelación - Solo actualiza estado local */}
        {!esAnioPasado && (
          <RetiroCancelacionModal
            show={showRetiroModal}
            onHide={() => setShowRetiroModal(false)}
            grupoFamiliar={grupoCompleto}
            soloActualizarLocal={true}
            onUpdateLocal={handleRetiroUpdateLocal}
            onSave={() => {
              // Este callback no se usará en modo local, pero lo mantenemos para compatibilidad
              setShowRetiroModal(false);
            }}
          />
        )}
        </div>
      </div>
    </div>
  );
};

export default GrupoFamiliarDetail;