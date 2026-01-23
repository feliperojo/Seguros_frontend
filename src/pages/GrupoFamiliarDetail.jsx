import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import ProspectoBarra from "../components/fase2/ProspectoBarra";
import Prospectogrupo from "../components/fase2/Prospectogrupo";
import ProspectoDatos from "../components/fase2/ProspectoDatos";
import TomaDeDatos from "../components/fase2/TomaDeDatos";
import ProductoCotizacionModal from "../components/fase2/ProductoCotizacionModal";
import RetiroCancelacionModal from "../components/RetiroCancelacionModal";
import GrupoFamiliarService from "../services/GrupoFamiliarService";
import { calcIngresoFamiliar, parseMoney } from '../services/ingresos';
import { mapGrupoFromForm, mapClienteFromMember, mapCoberturaFromMember, stripNulls, cleanDate } from "../adapters/prospecto.mapper";
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { deriveCounts } from "../utils/groupCounters";


 import { inflatePhones, toApiPhones } from "../utils/phone-mappers";

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
  
  const nombre_completo = buildNombreCompleto({
    primer_nombre: pick("primer_nombre"),
    segundo_nombre: pick("segundo_nombre"),
    apellidos: pick("apellidos"),
  });

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
      primer_nombre: pick("primer_nombre"),
      segundo_nombre: pick("segundo_nombre"),
      apellidos: pick("apellidos"),
      nombre_completo,
      fecha_nacimiento: date10(pick("fecha_nacimiento")),
      genero: pick("genero"),
      idioma: pick("idioma"),
      pais_origen: capitalizeWords(pick("pais_origen") || ""),
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
    };
    // Solo incluir campos que tienen valor (no null/undefined)
    // Para telefonos, siempre incluirlo aunque sea array vacío
    const filtered = Object.fromEntries(
      Object.entries(payload).filter(([k, v]) => {
        if (k === "telefonos") return true; // Siempre incluir telefonos (puede ser array vacío)
        return v !== null && v !== undefined;
      })
    );
    return filtered;
  }

  // Si es un cliente NUEVO, incluir todos los campos necesarios
  const payload = {
    primer_nombre: pick("primer_nombre"),
    segundo_nombre: pick("segundo_nombre"),
    apellidos: pick("apellidos"),
    nombre_completo,
    fecha_nacimiento: date10(pick("fecha_nacimiento")),
    genero: pick("genero"),
    idioma: pick("idioma"),
    pais_origen: capitalizeWords(pick("pais_origen") || ""),
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
    whatsapp: pick("whatsapp") === true,
    telegram: pick("telegram") === true,
    texto_sms: pick("texto_sms") === true,
  };

  return stripNulls(payload);
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
    "Seguro de vida": { label: "Seguro de vida", color: "success" },
    "Seguro dental": { label: "Seguro dental", color: "info" },
    "Seguro de accidentes": { label: "Seguro de accidentes", color: "warning" },
    // Agrega más mapeos según tus productos
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
    zipCode: g.zip_code ?? "", // no viene en tu JSON; queda vacío
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
    const primer  = (cli.primer_nombre  || "").trim();
    const segundo = (cli.segundo_nombre || "").trim();
    const apell   = (cli.apellidos      || "").trim();
    const fecha   = cli.fecha_nacimiento || "";
    const edad    = calcAge(fecha);
    const nombreCompleto =
      cli.nombre_completo || [primer, segundo, apell].filter(Boolean).join(" ");

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
      elegibilidad: cov.elegibilidad ?? "",
      precio: cov.precio ?? "",
      tipo_pago: cov.tipo_pago ?? null,
      dia_pago: cov.dia_pago ?? "",
      nota_cancel: cov.nota_cancel ?? "",
      grupo: cov.grupo ?? "",
      compania_id: cov.compania_id ?? null,
      pagador_id:  cov.pagador_id  ?? null,
      fecha_cancelacion: date10(cov.fecha_cancelacion ?? cov.fechaCancelacion ?? null),
      fecha_retiro: date10(cov.fecha_retiro ?? cov.fechaRetiro ?? null),
      nota_retiro: cov.nota_retiro ?? cov.nota_cancel ?? "",
      motivo_cancelacion: cov.motivo_cancelacion ?? "",
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

        // contacto
        telefono: cli.telefono || "",
        secundario: cli.secundario || "",
        whatsapp_num: cli.whatsapp_num || "",
        email: cli.email || "",
        nota: cli.nota || "",


     // si no trae, lo reconstruimos desde legacy para que el componente funcione ya.
             // ✅ Hidratar con ISO + indicativo cuando ya vienen en arreglo (tu BD actual)
       // ✅ soporta string JSON o array; si sigue vacío, cae a legacy
       telefonos: inflatePhones(cli.telefonos || [], "co"),

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
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [showRetiroModal, setShowRetiroModal] = useState(false);

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
            nota_cancel: datosCobertura.nota_cancel || null,
            nota_retiro: datosCobertura.nota_retiro || null,
            activo: datosCobertura.activo !== undefined ? datosCobertura.activo : member.activo,
            vigente: datosCobertura.vigente !== undefined ? datosCobertura.vigente : member.vigente,
            estado_cobertura: datosCobertura.estado_cobertura || member.estado_cobertura,
            motivo_cancelacion: datosCobertura.motivo_cancelacion || null,
          };

          // También actualizar en el objeto cobertura si existe
          if (member.cobertura) {
            memberActualizado.cobertura = {
              ...member.cobertura,
              fecha_cancelacion: formatDate(datosCobertura.fecha_cancelacion),
              fecha_retiro: formatDate(datosCobertura.fecha_retiro),
              nota_cancel: datosCobertura.nota_cancel || null,
              nota_retiro: datosCobertura.nota_retiro || null,
              activo: datosCobertura.activo !== undefined ? datosCobertura.activo : member.cobertura.activo,
              vigente: datosCobertura.vigente !== undefined ? datosCobertura.vigente : member.cobertura.vigente,
              estado_cobertura: datosCobertura.estado_cobertura || member.cobertura.estado_cobertura,
              motivo_cancelacion: datosCobertura.motivo_cancelacion || null,
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
      else if ((type === "text" || type === "textarea") && !name.toLowerCase().includes("telefono"))
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
      const full = await GrupoFamiliarService.getFullById(id);
      const fullData = unwrapFull(full);
  
      setFormData(mapFullToForm(full));
      setGrupoVersion(fullData?.updated_at || fullData?.updatedAt || null);
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
  }, [id]);

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
  const nombreCompleto = [cli.primer_nombre, cli.segundo_nombre, cli.apellidos]
    .filter(Boolean).join(" ");

  return {
    id: cli.id,
    cliente_id: cli.id,
    cobertura_id: cov.id,
    cobertura_tipo: cov.cobertura_tipo || res?.cobertura_tipo || "Plan de salud",
    primer_nombre: cli.primer_nombre || "",
    segundo_nombre: cli.segundo_nombre || "",
    apellidos: cli.apellidos || "",
    genero: cli.genero || "",
    idioma: cli.idioma || "",
    nombreCompleto,
    fecha_nacimiento: cli.fecha_nacimiento || "",
    edad: calcAge(cli.fecha_nacimiento),
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
    pagador_id: cov.pagador_id || "",
    tipo_pago: cov.tipo_pago || "",
    dia_pago: cov.dia_pago || "",
    precio: cov.precio ?? "",
    fecha_cancelacion: cov.fecha_cancelacion || "",
    fecha_retiro: cov.fecha_retiro || "",
    nota_retiro: cov.nota_retiro || "",
    codigo_poliza: cov.codigo_poliza || "",
    estado_cobertura: cov.estado_cobertura || "Sí",
    whatsapp: !!cli.whatsapp,
    telegram: !!cli.telegram,
    texto_sms: !!cli.texto_sms,
    cliente: {
      ...cli,
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
  const nombreCompleto = 
    memberData?.nombre_completo?.trim() ||
    memberData?.nombreCompleto?.trim() ||
    construirNombre(memberData);

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

  // payload mínimo: cliente nuevo + cobertura
  const payload = {
    request_id: crypto?.randomUUID?.() ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    grupo_version: grupoVersion,
    cliente_nuevo: {
      primer_nombre: (memberData.primer_nombre || "").toString().trim(),
      segundo_nombre: (memberData.segundo_nombre || "").toString().trim(),
      apellidos: (memberData.apellidos || "").toString().trim(),
      nombre_completo: nombreCompleto,  // 🎯 Nombre completo garantizado
      fecha_nacimiento: memberData.fecha_nacimiento || null,
      genero: memberData.genero || null,
      idioma: memberData.idioma || null,
      ingreso_anual: ingresoAnual,
      nota: memberData.nota || null,
      telefonos: toApiPhones(memberData.telefonos || []),
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
      precio: 0,
    },
  };

  console.log("📤 Payload a enviar:", JSON.stringify(payload, null, 2));

  try {
    const res = await GrupoFamiliarService.appendMiembro(id, payload);
    const data = unwrapFull(res)?.data || unwrapFull(res);
    const nuevo = mapMemberFromAppendResponse(data?.miembro || {});
    
    // Hidratar lista
    setFamilyMembers((prev) => [...prev, nuevo]);

    // Actualiza versión si el backend te devuelve la nueva
    if (data?.grupo_version) setGrupoVersion(data.grupo_version);
    
    await reload(); // Asegura que la siguiente "Actualizar" ya tiene IDs reales
    showToast("success", "Miembro agregado", `${nombreCompleto} fue creado exitosamente.`);
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

  const handleDerivedCounts = useCallback(({ taxes, cobertura }) => {
    setFormData(prev => {
      if (!prev) return prev;
      if (prev.personasTaxes === taxes && prev.personasCobertura === cobertura) return prev;
      return { ...prev, personasTaxes: taxes, personasCobertura: cobertura };
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

      const grupoPayload = stripNulls(mapGrupoFromForm(formData));
      
      console.log("💾 [handleSave] Payload del grupo familiar preparado:", {
        ...grupoPayload,
        tags: grupoPayload.tags ? 
          (Array.isArray(grupoPayload.tags) ? 
            `[Array con ${grupoPayload.tags.length} tags]` : 
            grupoPayload.tags) : 
          null
      });


           // 1) Crear primero los miembros NUEVOS (sin cliente_id)
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
const existentes = (familyMembers || []).filter(m => m?.cliente_id);
const clientesPayload = existentes
  .map(mapClienteForSave)
  .filter(Boolean) // Eliminar nulls/undefined
  .map(stripNulls);
      

  const coberturasPayload = (familyMembers || [])
     // 👇 Solo clientes reales y SOLO coberturas que ya tienen ID (UPDATE). 
     // Si no hay cobertura_id, NO mandes nada (ya fue creada por el modal).
     .filter(m => m?.cliente_id && m?.cobertura_id)
   .map(m => {
     const cobertura = mapCoberturaFromMember(m, id);
          // 👇 Forzamos UPDATE explícito
          cobertura.id = m.cobertura_id;
          cobertura.cliente_id = m.cliente_id;

     if (productoCotizacion?.label) {
       cobertura.cobertura_tipo = productoCotizacion?.label;
     }
     
     // ✅ IMPORTANTE: Preservar campos de retiro/cancelación incluso si son null
     // Estos campos pueden haber sido actualizados por el modal de retiro
     // y deben enviarse al backend para mantener la sincronización y crear el registro retiro_cancelacion
     if (m.fecha_cancelacion !== undefined) {
       cobertura.fecha_cancelacion = cleanDate(m.fecha_cancelacion);
       // Si hay fecha_cancelacion, asegurar que nota_cancel y motivo_cancelacion se envíen (incluso si son null)
       if (m.nota_cancel !== undefined) {
         cobertura.nota_cancel = (m.nota_cancel || "").trim() || null;
       } else if (m.fecha_cancelacion) {
         // Si hay fecha pero no nota definida, enviar null explícitamente
         cobertura.nota_cancel = null;
       }
       if (m.motivo_cancelacion !== undefined) {
         cobertura.motivo_cancelacion = (m.motivo_cancelacion || "").trim() || null;
       } else if (m.fecha_cancelacion) {
         // Si hay fecha pero no motivo definido, enviar null explícitamente
         cobertura.motivo_cancelacion = null;
       }
     }
     if (m.fecha_retiro !== undefined) {
       cobertura.fecha_retiro = cleanDate(m.fecha_retiro);
       // Si hay fecha_retiro, asegurar que nota_retiro se envíe (incluso si es null)
       if (m.nota_retiro !== undefined) {
         cobertura.nota_retiro = (m.nota_retiro || "").trim() || null;
       } else if (m.fecha_retiro) {
         // Si hay fecha pero no nota definida, enviar null explícitamente
         cobertura.nota_retiro = null;
       }
     }
     
     // ✅ IMPORTANTE: Preservar campos de retiro/cancelación incluso si son null
     // Estos campos pueden haber sido actualizados por el modal de retiro
     // y deben enviarse al backend para mantener la sincronización
     // No usar stripNulls directamente porque eliminaría estos campos cuando son null
     // En su lugar, crear un objeto limpio preservando estos campos especiales
     // ✅ Campos protegidos: incluyen campos de retiro/cancelación necesarios para crear registro retiro_cancelacion
     const camposProtegidos = ['fecha_cancelacion', 'fecha_retiro', 'nota_cancel', 'nota_retiro', 'motivo_cancelacion', 'activo', 'vigente'];
     const valoresProtegidos = {};
     
     // Guardar valores de campos protegidos antes de stripNulls
     // ✅ IMPORTANTE: Incluir campos incluso si son null cuando hay fechas relacionadas
     camposProtegidos.forEach(campo => {
       if (cobertura[campo] !== undefined) {
         valoresProtegidos[campo] = cobertura[campo];
       } else {
         // Si hay fecha_cancelacion o fecha_retiro, asegurar que los campos relacionados se incluyan
         if (campo === 'nota_cancel' && cobertura.fecha_cancelacion) {
           valoresProtegidos[campo] = null;
         }
         if (campo === 'nota_retiro' && cobertura.fecha_retiro) {
           valoresProtegidos[campo] = null;
         }
         if (campo === 'motivo_cancelacion' && cobertura.fecha_cancelacion) {
           valoresProtegidos[campo] = null;
         }
       }
     });
     
     // ✅ Asegurar que activo y vigente SIEMPRE estén presentes (valores definidos por CambioVidaCancelacionModal)
     // Si no están definidos, usar valores por defecto
     if (valoresProtegidos.activo === undefined) {
       valoresProtegidos.activo = true; // Por defecto: activo
     }
     if (valoresProtegidos.vigente === undefined) {
       // Por defecto: false si hay fecha_cancelacion, true si no
       valoresProtegidos.vigente = !cobertura.fecha_cancelacion;
     }
     
     // Limpiar otros campos null/undefined
     const coberturaLimpia = stripNulls(cobertura);
     
     // Restaurar campos protegidos (incluso si son null para permitir limpiarlos en el backend)
     // activo y vigente SIEMPRE se incluyen
     Object.keys(valoresProtegidos).forEach(campo => {
       coberturaLimpia[campo] = valoresProtegidos[campo];
     });
     
     return coberturaLimpia;
    });
// quita los nulls del caso (1)

                    // 🔎 DEBUG: verifica que cada cobertura lleve fecha_activacion
     // Nota: fecha_cancelacion, fecha_retiro, activo, vigente, nota_cancel NO se envían en actualizaciones normales
     // (solo se actualizan mediante modales de renovación/reactivación)
     try {
       console.table(
         coberturasPayload.map(c => ({
           id: c.id,
           cliente_id: c.cliente_id,
           fecha_activacion: c.fecha_activacion,
           estado_cobertura: c.estado_cobertura,
           // Campos protegidos excluidos: fecha_cancelacion, fecha_retiro, activo, vigente, nota_cancel
         }))
       );
     } catch (_) {}

      const finalPayload = {
        ...grupoPayload,
        clientes: clientesPayload,
        coberturas: coberturasPayload,
      };

      console.log("🚀 [handleSave] Payload FINAL que se envía al backend (fullUpdate):", {
        grupoId: id,
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

      await GrupoFamiliarService.fullUpdate(id, finalPayload);

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
      await reload();
      showToast("success", alsoAdvance ? "Guardado y etapa actualizada" : "Actualización exitosa", "");
    } catch (e) {
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
  const canAddMember = isProspecto ? true : isEditing;   // 👈 así en creación siempre se puede
  const readOnly = !isEditing;


  

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

        {/* 👈 Nuevo: Modal de selección de producto */}
        <ProductoCotizacionModal
          open={showProductModal}
          onSelect={handleProductSelect}
          onClose={handleCloseModal}
        />

        <ProspectoBarra 
          currentCode={estadoActual}
          grupoId={id}
          onDescartar={async () => {
            await advanceState('DESCARTADO');
          }}
        />





        <div className="d-flex justify-content-end mb-3">
          {readOnly ? (
            <div className="d-flex gap-2">
              <button 
                type="button"
                className="btn btn-primary" 
                onClick={() => setIsEditing(true)}
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
                onClick={() => { setIsEditing(false); reload(); }}
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
                              'bg-gray-600 text-white'
                            }`}>
                              {productoCotizacion?.label || 'Sin plan'}
                      </span>
                    </div>
                    {isEditing && (
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

        {/* Captación + económicos */}
        <Prospectogrupo
          
          formData={formData}
          onChange={handleInputChange}
          readOnly={readOnly}
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
        </div>
      </div>
    </div>
  );
};

export default GrupoFamiliarDetail;