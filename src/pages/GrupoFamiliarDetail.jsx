import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import ProspectoBarra from "../components/fase2/ProspectoBarra";
import Prospectogrupo from "../components/fase2/Prospectogrupo";
import ProspectoDatos from "../components/fase2/ProspectoDatos";
import TomaDeDatos from "../components/fase2/TomaDeDatos";
import ProductoCotizacionModal from "../components/fase2/ProductoCotizacionModal";
import GrupoFamiliarService from "../services/GrupoFamiliarService";
import { calcIngresoFamiliar, parseMoney } from '../services/ingresos';
import { mapGrupoFromForm, mapClienteFromMember, mapCoberturaFromMember, stripNulls } from "../adapters/prospecto.mapper";
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { deriveCounts } from "../utils/groupCounters";

// ================== Helpers ==================

// --- Helpers de etapas (ajusta si tu flujo no es lineal) ---
const NEXT_OF = {
  PROSPECTO: "COTIZACION",
  COTIZACION: "SEGUIMIENTO",
  SEGUIMIENTO: "TOMA_DATOS",
  TOMA_DATOS: "INSCRIPCION_INI",
  INSCRIPCION_INI: "TERMINADO",
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


// ===== Mapper local para GUARDAR todos los campos del cliente =====
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
  const esClienteReal = clienteIdReal && Number(clienteIdReal) > 50;

  const payload = {
    primer_nombre: pick("primer_nombre"),
    segundo_nombre: pick("segundo_nombre"),
    apellidos: pick("apellidos"),
    nombre_completo,
    fecha_nacimiento: date10(pick("fecha_nacimiento")),
    genero: pick("genero"),
    idioma: pick("idioma"),
    ingreso_anual: moneyToDecimal(pick("ingreso_anual")),
    nota: pick("nota"),
    telefono: pick("telefono"),
    secundario: pick("secundario"),
    whatsapp_num: pick("whatsapp_num"),
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

  // Solo agregar 'id' si es un cliente REAL de la BD
  if (esClienteReal) {
    payload.id = clienteIdReal;
  }

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

      // datos “cliente” copiados a raíz para edición inline
      primer_nombre: primer,
      segundo_nombre: segundo,
      apellidos: apell,
      nombreCompleto,
      genero: cli.genero || "",
      fecha_nacimiento: fecha,
      edad,
      idioma: cli.idioma || "",
      ingreso_anual: cli.ingreso_anual || "",
      nota: cli.nota || "",

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

        // contacto
        telefono: cli.telefono || "",
        secundario: cli.secundario || "",
        whatsapp_num: cli.whatsapp_num || "",
        email: cli.email || "",
        nota: cli.nota || "",

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

const [grupoVersion, setGrupoVersion] = useState(null);

  const [toast, setToast] = useState({ show: false, type: "success", title: "", message: "" });
  const showToast = (type, title, message) => {
    setToast({ show: true, type, title, message });
    // Autocierre en 3.5s
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3500);
  };



  // Handler de cambios (respeta capitalizaciones que pediste)
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => {
      if (!prev) return prev;
      let v = value;
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
       if (productoCotizacion?.label) cov.cobertura_tipo = productoCotizacion.label;

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
      
      // 👈 Actualizar cobertura_tipo si se cambió el producto
           
      const coberturasPayload = (familyMembers || [])
               .filter(m => m?.cliente_id) // al menos debe existir cliente
               .map(m => {
                 const cobertura = mapCoberturaFromMember(m, id);
                 // si no hay cobertura_id, forzamos alta (upsert)
                 if (!m.cobertura_id) {
                   cobertura.id = null;
                   cobertura.cliente_id = m.cliente_id;
                   cobertura.estado_cobertura = m.estado_cobertura ?? "Sí";
                   cobertura.cobertura_tipo =
                     productoCotizacion?.label || m.cobertura_tipo || "Plan de salud";
                 }
                 if (productoCotizacion?.label) {
                   cobertura.cobertura_tipo = productoCotizacion.label;
                 }
                 return stripNulls(cobertura);
               });
                    // 🔎 DEBUG: verifica que cada cobertura lleve fecha_activacion
     try {
       console.table(
         coberturasPayload.map(c => ({
           id: c.id,
           cliente_id: c.cliente_id,
           fecha_activacion: c.fecha_activacion,
           fecha_cancelacion: c.fecha_cancelacion,
           fecha_retiro: c.fecha_retiro
         }))
       );
     } catch (_) {}

      await GrupoFamiliarService.fullUpdate(id, {
        ...grupoPayload,
        clientes: clientesPayload,
        coberturas: coberturasPayload,
      });

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
      <div className="container py-5 text-center text-muted">
        <div className="spinner-border me-2" role="status" />
        Cargando...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger d-flex align-items-center">
          <i className="fa fa-triangle-exclamation me-2" />
          <div>{loadError}</div>
        </div>
        <button className="btn btn-outline-primary" onClick={reload}>
          Reintentar
        </button>
      </div>
    );
  }
  const isProspecto = toEstadoCode(estadoActual) === 'PROSPECTO';
  const canAddMember = isProspecto ? true : isEditing;   // 👈 así en creación siempre se puede
  const readOnly = !isEditing;


  

  return (
    <div className="container-fluid bg-light min-vh-100 py-4">
     <div className="container py-4">
  <div className="card shadow-sm border-0 rounded-4 bg-white px-4 py-4">
    {/* Aquí dentro va TODO el contenido actual */}

        {/* Toast flotante */}
        <div
          className="toast-container position-fixed top-0 end-0 p-3"
          style={{ zIndex: 1080 }}
        >
          <div
            className={`toast show ${toast.show ? "opacity-100" : "opacity-0"}`}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            style={{
              transition: "opacity 200ms ease",
              minWidth: 320,
              pointerEvents: toast.show ? "auto" : "none"
            }}
          >
            <div className={`toast-header bg-${toast.type} text-white`}>
              <strong className="me-auto">{toast.title || "Notificación"}</strong>
              <button
                type="button"
                className="btn-close btn-close-white ms-2 mb-1"
                aria-label="Close"
                onClick={() => setToast((t) => ({ ...t, show: false }))}
              />
            </div>
            {toast.message && (
              <div className="toast-body bg-white text-dark">
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

        <ProspectoBarra currentCode={estadoActual} />





        <div className="d-flex justify-content-end mb-3">
          {readOnly ? (
            <div className="btn-toolbar gap-2">
              <button className="btn btn-primary" onClick={() => setIsEditing(true)}>Editar</button>

              <div className="btn-group">
                <button
                  type="button"
                  className="btn btn-outline-secondary dropdown-toggle"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  disabled={advancing}
                >
                  Acciones
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  {nextOf(estadoActual) && (
                    <li>
                      <button
                        className="dropdown-item"
                        disabled={advancing}
                        onClick={async () => {
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
                        Pasar a {nextOf(estadoActual)} →
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <div className="btn-toolbar gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => { setIsEditing(false); reload(); }}
                disabled={saving || advancing}
              >
                Cancelar
              </button>

              <div className="btn-group">
                <button className="btn btn-success" onClick={() => handleSave(false)} disabled={saving || advancing}>
                  {saving ? (<><span className="spinner-border spinner-border-sm me-2" />Guardando…</>) : "Guardar"}
                </button>
                <button
                  type="button"
                  className="btn btn-success dropdown-toggle dropdown-toggle-split"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  disabled={saving || advancing || !nextOf(estadoActual)}
                >
                  <span className="visually-hidden">Toggle</span>
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  {nextOf(estadoActual) && (
                    <li>
                      <button className="dropdown-item" onClick={() => handleSave(true)} disabled={saving || advancing}>
                        Guardar y pasar a {nextOf(estadoActual)} →
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
             </div>
                {/* 👈 Nuevo: Mostrar producto seleccionado */}
             <div className="card mb-4 border-0 shadow-sm">
                      <div className="card-body py-3">
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center">
                            <i className="fas fa-shield-alt text-primary me-2"></i>
                            <span className="fw-bold text-muted me-2">Plan seleccionado:</span>
                            <span className={`badge bg-${productoCotizacion.color} fs-6`}>
                              {productoCotizacion.label}
                      </span>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setShowProductModal(true)}
                      >
                        <i className="fas fa-edit me-1"></i>
                        Cambiar plan
                      </button>
                    )}
                  </div>
                </div>
              </div>

        {/* Captación + económicos */}
        <Prospectogrupo
          formData={formData}
          onChange={handleInputChange}
          readOnly={readOnly}
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
        </div>
      </div>
    </div>
  );
};

export default GrupoFamiliarDetail;