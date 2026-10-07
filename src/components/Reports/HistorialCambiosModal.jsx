// src/components/Historial/HistorialCambiosModal.jsx
// ✅ MODAL DE SOLO LECTURA: Este componente solo muestra el historial de cambios.
// NO realiza actualizaciones al backend. Todas las actualizaciones se realizan
// a través del botón "Guardar" del grupo familiar en GrupoFamiliarDetail.jsx
import React, { useEffect, useRef, useState } from "react";
import apiRequest from "../../services/api";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import { formatDateTimeForDisplay, formatPhone334 } from "../../utils/formatters";
import {
  CLIENTE_FIELDS_PRINCIPALES,
  CLIENTE_FIELDS_MIGRATORIO,
  CLIENTE_FIELDS_DIRECCION,
  CLIENTE_FIELDS_CONTACTO,
  CLIENTE_FIELDS_EMPLEO,
} from "../../utils/clienteFieldGroups";
import {
  claveCampoCliente,
  definicionSeccionCliente,
  ETIQUETAS_SECCION_FICHA,
  esEventoIndividualCliente,
  etiquetaOrigenActualizacion,
  paginarFilas,
  filtrarHistorialPorSeccion,
  formatValorCampoCliente,
  ordenarCamposDeSeccion,
} from "../../utils/clienteHistorialSeccion";
import "../../styles/GfModal.css";

// ==================== CONSTANTES ====================

const CAMPOS_IGNORAR = new Set([
  'updated_at', 
  'updatedAt',
  'fecha_actualizacion',
  'fechaActualizacion',
  'updated_at_cliente',
  'updatedAtCliente',
  'cliente.updated_at',
  'cliente.updatedAt',
  'cobertura_updated_at',
  'cobertura.updated_at'
]);

const FIELD_LABELS = {
  historial_plan_recuperado_id: "Archivo de plan recuperado (ID)",
  fecha_activacion: "Fecha de activación",
  ano_cobertura: "Año de cobertura",
  cobertura_tipo: "Tipo de cobertura",
  policy_number: "Código de ID",
  agente: "Agente",
  pagador_id: "Pagador (ID)",
  dia_pago: "Día de pago",
  parentesco: "Parentesco",
  activo: "Activo",
  vigente: "Vigente",
  motivo_retiro: "Motivo de retiro",
  nota_retiro: "Nota de retiro",
  motivo_anulacion: "Motivo de anulación",
  nota_anulacion: "Nota de anulación",
  fecha_anulacion: "Fecha de anulación",
  cobertura_definida: "Cobertura definida",
  ingreso_familiar_anual: "Ingreso familiar anual",
  personas_cobertura: "Personas en cobertura",
  personas_taxes: "Personas en Taxes",
  zip_code: "ZIP Code",
  fecha_autorizacion: "Fecha autorización",
  nombre_autorizado: "Nombre autorizado",
  nota: "Nota",
  estado_cobertura: "Estado cobertura",
  elegibilidad: "Elegibilidad",
  grupo: "Grupo",
  plan: "Plan",
  metal: "Metal",
  red: "Red",
  coberturas: "Coberturas y miembros",
  codigo_poliza: "Código de póliza",
  nombre: "Nombre",
  compania: "Compañía",
  precio: "Precio",
  tipo_pago: "Tipo de pago",
  fecha_cancelacion: "Fecha de expiración",
  fecha_retiro: "Fecha de retiro",
};

const CLIENTE_FIELD_LABELS = {
  ...Object.fromEntries([
    ...CLIENTE_FIELDS_PRINCIPALES,
    ...CLIENTE_FIELDS_MIGRATORIO,
    ...CLIENTE_FIELDS_DIRECCION,
    ...CLIENTE_FIELDS_CONTACTO,
    ...CLIENTE_FIELDS_EMPLEO,
  ].map(([key, label]) => [key, label])),
  nombre_completo: "Nombre completo",
  ssn: "SSN",
  social: "Social / SSN",
  estado_direccion: "Estado (dirección)",
  zip_code: "ZIP Code",
  telefonos: "Teléfonos",
};

const CLIENTE_SECCIONES = [
  {
    id: "principales",
    label: "Datos personales",
    fields: definicionSeccionCliente("principales").fields,
  },
  {
    id: "migratorio",
    label: "Status migratorio",
    fields: definicionSeccionCliente("migratorio").fields,
  },
  {
    id: "direccion",
    label: "Dirección",
    fields: definicionSeccionCliente("direccion").fields,
  },
  {
    id: "contacto",
    label: "Contacto",
    fields: definicionSeccionCliente("contacto").fields,
  },
  {
    id: "empleo",
    label: "Empleo e ingreso",
    fields: definicionSeccionCliente("empleo").fields,
  },
];

const SECCION_OTROS = { id: "otros", label: "Otros campos" };

const formatModeloAfectado = (modelo) => {
  const labels = {
    GrupoFamiliar: "Grupo familiar",
    Cliente: "Persona",
    Cobertura: "Cobertura",
    MedioPago: "Medio de pago",
    MedioDePago: "Medio de pago",
  };
  return labels[modelo] || modelo || "—";
};


const getClienteFieldKey = (fieldKey) =>
  String(fieldKey || "").replace(/^cliente\./, "");

const getClienteSeccion = (fieldKey) => {
  const key = getClienteFieldKey(fieldKey);
  return CLIENTE_SECCIONES.find((seccion) => seccion.fields.has(key)) || SECCION_OTROS;
};

const agruparCambiosPorSeccionCliente = (cambiosCliente = []) => {
  const porSeccion = new Map();

  cambiosCliente.forEach((cambio) => {
    const seccion = getClienteSeccion(cambio.fieldKey);
    if (!porSeccion.has(seccion.id)) {
      porSeccion.set(seccion.id, {
        id: seccion.id,
        label: seccion.label,
        cambios: [],
      });
    }
    porSeccion.get(seccion.id).cambios.push(cambio);
  });

  const orden = [...CLIENTE_SECCIONES.map((s) => s.id), SECCION_OTROS.id];
  return orden
    .map((id) => porSeccion.get(id))
    .filter(Boolean);
};

const MEDIO_PAGO_FIELD_LABELS = {
  forma_pago: "Forma de pago",
  tipo_tarjeta: "Tipo de tarjeta",
  titular: "Titular",
  direccion: "Dirección",
  numero_tarjeta: "Número de tarjeta",
  fecha_expiracion: "Fecha de expiración",
  fecha_expiracion_raw: "Fecha de expiración",
  cvv: "CVV",
  banco: "Banco",
  ruta: "Ruta",
  cuenta_numero: "Número de cuenta",
  quien_paga: "Quién paga",
  es_principal: "Es principal",
  cliente_id: "ID Cliente",
};

const COB_FIELDS = [
  "plan", "metal", "red", "grupo", "estado_cobertura", "cobertura_tipo",
  "codigo_poliza", "precio", "ano_cobertura", "fecha_activacion",
  "fecha_cancelacion", "fecha_retiro", "elegibilidad",
];

// ==================== HELPERS ====================

const formatDateTime = (value) => {
  return formatDateTimeForDisplay(value);
};

const formatValue = (val) => {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return "[objeto]";
    }
  }
  return String(val);
};

const parseTelefonosValue = (val) => {
  if (val === null || val === undefined || val === "") return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "[]") return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const formatearTelefonoLegible = (tel) => {
  if (!tel || typeof tel !== "object") return null;
  const indicativo = tel.indicativo ? `+${String(tel.indicativo).replace(/^\+/, "")}` : "";
  const numero = formatPhone334(tel.numero || "") || tel.numero || "";
  const numeroCompleto = [indicativo, numero].filter(Boolean).join(" ").trim();
  if (!numeroCompleto) return null;

  return {
    numeroCompleto,
    tipo: tel.tipo ? String(tel.tipo) : null,
    principal: tel.principal === true || tel.principal === 1 || tel.principal === "true",
  };
};

const renderTelefonosHistorial = (val) => {
  const lista = parseTelefonosValue(val);
  if (!lista.length) {
    return <span className="text-muted">Sin teléfonos</span>;
  }

  const items = lista
    .map((tel, idx) => {
      const formatted = formatearTelefonoLegible(tel);
      if (!formatted) return null;
      return (
        <div
          key={tel.id || `${formatted.numeroCompleto}-${idx}`}
          className="d-flex align-items-center flex-wrap gap-2"
          style={{ marginBottom: idx < lista.length - 1 ? "0.35rem" : 0 }}
        >
          {formatted.tipo && (
            <span className="badge bg-secondary" style={{ fontSize: "0.7rem" }}>
              {formatted.tipo}
            </span>
          )}
          <span style={{ wordBreak: "break-word" }}>{formatted.numeroCompleto}</span>
          {formatted.principal && (
            <span className="badge bg-success" style={{ fontSize: "0.7rem" }}>
              Principal
            </span>
          )}
        </div>
      );
    })
    .filter(Boolean);

  if (!items.length) {
    return <span className="text-muted">Sin teléfonos</span>;
  }

  return <div>{items}</div>;
};

const esCampoTelefonos = (campoOrFieldKey = "") => {
  const key = String(campoOrFieldKey);
  const plain = key.includes(".") ? key.substring(key.lastIndexOf(".") + 1) : key;
  return plain === "telefonos" || key === "cliente.telefonos";
};

const renderValorHistorial = (val, campoOrFieldKey = "") => {
  if (esCampoTelefonos(campoOrFieldKey)) {
    return renderTelefonosHistorial(val);
  }
  return formatValue(val);
};

const esAltaCoberturaCampo = (campo = "") => /^cobertura_\d+$/.test(String(campo));

const formatAccionHistorial = (accion, { esAlta = false } = {}) => {
  if (esAlta || accion === "create") return "Alta";
  if (accion === "update") return "Actualización";
  if (accion === "delete") return "Eliminación";
  if (accion === "estado_cambio") return "Cambio de estado";
  return accion || "—";
};

const extraerInfoMiembroAgregado = (info, coberturaId, titularesGrupo = {}, coberturaClientes = {}) => {
  const nuevo = info?.nuevo;
  let nombre = "";
  let parentesco = null;
  let codigoPoliza = null;
  let plan = null;
  let estadoCobertura = null;
  let anoCobertura = null;

  if (nuevo && typeof nuevo === "object" && !Array.isArray(nuevo)) {
    if (nuevo._evento === "miembro_agregado" || nuevo.nombre) {
      nombre = nuevo.nombre || "";
      parentesco = nuevo.parentesco || null;
      codigoPoliza = nuevo.codigo_poliza || null;
      plan = nuevo.plan || null;
      estadoCobertura = nuevo.estado_cobertura || null;
      anoCobertura = nuevo.ano_cobertura || null;
    } else {
      nombre = obtenerNombreCliente(nuevo.cliente || {});
      parentesco = nuevo.parentesco || null;
      codigoPoliza = nuevo.codigo_poliza || null;
      plan = nuevo.plan || null;
      estadoCobertura = nuevo.estado_cobertura || null;
      anoCobertura = nuevo.ano_cobertura || null;
    }
  }

  const idKey = String(coberturaId);
  const desdeMapa =
    normalizarTitularCobertura(coberturaClientes[idKey]) ||
    titularesGrupo[idKey] ||
    null;

  if (!nombre && desdeMapa?.nombre) nombre = desdeMapa.nombre;
  if (!parentesco && desdeMapa?.parentesco) parentesco = desdeMapa.parentesco;
  if (!codigoPoliza && desdeMapa?.codigo_poliza) codigoPoliza = desdeMapa.codigo_poliza;
  if (!plan && desdeMapa?.plan) plan = desdeMapa.plan;

  return {
    coberturaId,
    nombre: nombre || `Persona cobertura #${coberturaId}`,
    parentesco,
    codigoPoliza,
    plan,
    estadoCobertura,
    anoCobertura,
  };
};

const normalizeValue = (val) => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return val;
};

const getFieldLabel = (fieldKey) => {
  if (FIELD_LABELS[fieldKey]) return FIELD_LABELS[fieldKey];
  if (CLIENTE_FIELD_LABELS[fieldKey]) return CLIENTE_FIELD_LABELS[fieldKey];
  if (MEDIO_PAGO_FIELD_LABELS[fieldKey]) return MEDIO_PAGO_FIELD_LABELS[fieldKey];
  
  if (fieldKey.startsWith("cliente.")) {
    const clienteField = fieldKey.replace("cliente.", "");
    return CLIENTE_FIELD_LABELS[clienteField] || clienteField;
  }
  
  // Si es un campo de cobertura anidado (cobertura_X.campo)
  // Extraer solo el nombre del campo después del último punto
  const lastDotIndex = fieldKey.lastIndexOf(".");
  if (lastDotIndex > 0) {
    const actualField = fieldKey.substring(lastDotIndex + 1);
    if (FIELD_LABELS[actualField]) return FIELD_LABELS[actualField];
    if (MEDIO_PAGO_FIELD_LABELS[actualField]) return MEDIO_PAGO_FIELD_LABELS[actualField];
    if (actualField.startsWith("cliente.")) {
      const clienteField = actualField.replace("cliente.", "");
      return CLIENTE_FIELD_LABELS[clienteField] || clienteField;
    }
  }
  
  // Capitalizar y formatear el nombre del campo como fallback
  return fieldKey
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatFormaPago = (value) => {
  if (!value) return "—";
  const labels = {
    tarjeta_credito: "Tarjeta de crédito",
    tarjeta_debito: "Tarjeta de débito",
    cuenta_bancaria: "Cuenta bancaria",
  };
  return labels[value] || formatValue(value);
};

const formatValueForHistorial = (val, campo) => {
  if (campo === "forma_pago") return formatFormaPago(val);
  if (["es_principal", "activo", "vigente"].includes(campo)) {
    if (val === true || val === "true" || val === 1) return "Sí";
    if (val === false || val === "false" || val === 0) return "No";
  }
  if (esCampoTelefonos(campo)) {
    return renderTelefonosHistorial(val);
  }
  return formatValue(val);
};

const normalizeCoberturas = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const buildCobKey = (cob, index) => {
  if (cob.id) return `id-${cob.id}`;
  if (cob.cliente_id) return `cli-${cob.cliente_id}-${cob.parentesco || ""}`;
  return `idx-${index}`;
};

const obtenerNombreCliente = (cliente) => {
  return cliente?.nombre_completo ||
    [cliente?.primer_nombre, cliente?.segundo_nombre, cliente?.apellidos]
      .filter(Boolean)
      .join(" ") || "";
};

const normalizarTitularCobertura = (valor) => {
  if (!valor) return null;
  if (typeof valor === "string") {
    return { nombre: valor, parentesco: null, codigo_poliza: null, plan: null };
  }
  if (typeof valor === "object") {
    const nombre = valor.nombre || valor.cliente_nombre || valor.nombre_completo || "";
    if (!nombre) return null;
    return {
      nombre,
      parentesco: valor.parentesco || null,
      codigo_poliza: valor.codigo_poliza || null,
      plan: valor.plan || null,
    };
  }
  return null;
};

const buildTitularesDesdeCoberturas = (coberturas = []) => {
  const map = {};
  (Array.isArray(coberturas) ? coberturas : []).forEach((cob) => {
    if (!cob?.id) return;
    const nombre = obtenerNombreCliente(cob.cliente);
    if (!nombre) return;
    map[String(cob.id)] = {
      nombre,
      parentesco: cob.parentesco || null,
      codigo_poliza: cob.codigo_poliza || null,
      plan: cob.plan || null,
    };
  });
  return map;
};

const toValidModeloId = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const nombreCompaniaCobertura = (cob) => {
  if (!cob || typeof cob !== "object") return null;
  if (cob.compania && typeof cob.compania === "object") {
    return cob.compania.nombre || cob.compania.name || null;
  }
  if (typeof cob.compania === "string" && cob.compania.trim()) return cob.compania.trim();
  if (cob.compania_nombre) return cob.compania_nombre;
  return null;
};

const etiquetaEstadoCoberturaLista = (cob) => {
  if (cob?.fecha_anulacion) return "Anulada";
  if (cob?.fecha_retiro) return "Retirada";
  if (cob?.fecha_cancelacion) return "Cancelada";
  if (cob?.estado_cobertura) return cob.estado_cobertura;
  if (cob?.activo === false || cob?.activo === 0 || cob?.activo === "false") return "Inactiva";
  return "—";
};

/** Normaliza coberturas del grupo abierto (dedupe por ID; excluye otros grupos). */
const normalizarCoberturasDelGrupo = (coberturas = [], grupoId) => {
  const grupoNum = toValidModeloId(grupoId);
  const porId = new Map();
  (Array.isArray(coberturas) ? coberturas : []).forEach((cob) => {
    const id = toValidModeloId(cob?.id);
    if (!id || porId.has(id)) return;
    const gfId =
      toValidModeloId(cob.grupo_familiar_id) ??
      toValidModeloId(cob.grupo_familiar?.id) ??
      grupoNum;
    if (grupoNum && gfId && gfId !== grupoNum) return;
    const clienteId = toValidModeloId(cob.cliente?.id ?? cob.cliente_id);
    porId.set(id, {
      id,
      cobertura_tipo: cob.cobertura_tipo || "Sin tipo",
      plan: cob.plan || null,
      compania: nombreCompaniaCobertura(cob),
      ano_cobertura: cob.ano_cobertura ?? null,
      estado: etiquetaEstadoCoberturaLista(cob),
      cliente_id: clienteId,
      cliente_nombre: obtenerNombreCliente(cob.cliente) || "Sin nombre",
      parentesco: cob.parentesco || null,
    });
  });
  return [...porId.values()].sort((a, b) => {
    const anioA = Number(a.ano_cobertura) || 0;
    const anioB = Number(b.ano_cobertura) || 0;
    if (anioA !== anioB) return anioB - anioA;
    return a.id - b.id;
  });
};

const agruparCoberturasPorPersona = (items = []) => {
  const grupos = new Map();
  items.forEach((item) => {
    const clave = item.cliente_id != null ? `id-${item.cliente_id}` : `nombre-${item.cliente_nombre}-${item.id}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        personaId: item.cliente_id,
        nombre: item.cliente_nombre,
        parentesco: item.parentesco,
        coberturas: [],
      });
    }
    grupos.get(clave).coberturas.push(item);
  });
  return [...grupos.values()].sort((a, b) =>
    String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" })
  );
};

const filtrarCoberturasHub = (items, busqueda, anio) => {
  const q = String(busqueda || "").trim().toLowerCase();
  const anioFiltro = anio != null && anio !== "" ? String(anio) : "";
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (anioFiltro && String(item.ano_cobertura ?? "") !== anioFiltro) return false;
    if (!q) return true;
    const texto = [
      item.cliente_nombre,
      item.cliente_id,
      item.cobertura_tipo,
      item.plan,
      item.compania,
      item.id,
      item.ano_cobertura,
      item.estado,
      item.parentesco,
    ]
      .map((v) => String(v ?? "").toLowerCase())
      .join(" ");
    return texto.includes(q);
  });
};

const resolverTitularCobertura = ({
  coberturaId,
  cambios = {},
  coverageFields = [],
  coberturaClientes = {},
  titularesGrupo = {},
  clientesAfectados = [],
  coberturaInfo = null,
}) => {
  const idKey = String(coberturaId);

  const desdeCambiosNombre = coverageFields.find((f) => f.fieldKey === "cliente.nombre_completo");
  if (desdeCambiosNombre) {
    const info = cambios[desdeCambiosNombre.campo] || {};
    const nombre = info.nuevo || info.anterior || "";
    if (nombre) {
      const parentescoCampo = coverageFields.find((f) => f.fieldKey === "parentesco");
      const parentescoInfo = parentescoCampo ? cambios[parentescoCampo.campo] : null;
      return {
        nombre,
        parentesco:
          parentescoInfo?.nuevo ||
          parentescoInfo?.anterior ||
          normalizarTitularCobertura(coberturaClientes[idKey])?.parentesco ||
          titularesGrupo[idKey]?.parentesco ||
          null,
        codigo_poliza: titularesGrupo[idKey]?.codigo_poliza || null,
        plan: titularesGrupo[idKey]?.plan || null,
      };
    }
  }

  const primerNombreField = coverageFields.find((f) => f.fieldKey === "cliente.primer_nombre");
  const apellidosField = coverageFields.find((f) => f.fieldKey === "cliente.apellidos");
  if (primerNombreField || apellidosField) {
    const primerNombre = primerNombreField
      ? (cambios[primerNombreField.campo]?.nuevo || cambios[primerNombreField.campo]?.anterior || "")
      : "";
    const apellidos = apellidosField
      ? (cambios[apellidosField.campo]?.nuevo || cambios[apellidosField.campo]?.anterior || "")
      : "";
    const nombre = [primerNombre, apellidos].filter(Boolean).join(" ");
    if (nombre) {
      return {
        nombre,
        parentesco: titularesGrupo[idKey]?.parentesco || normalizarTitularCobertura(coberturaClientes[idKey])?.parentesco || null,
        codigo_poliza: titularesGrupo[idKey]?.codigo_poliza || null,
        plan: titularesGrupo[idKey]?.plan || null,
      };
    }
  }

  const desdeHistorial = normalizarTitularCobertura(coberturaClientes[idKey]);
  if (desdeHistorial) return { ...titularesGrupo[idKey], ...desdeHistorial };

  if (titularesGrupo[idKey]) return titularesGrupo[idKey];

  if (coberturaInfo?.cliente_nombre) {
    return {
      nombre: coberturaInfo.cliente_nombre,
      parentesco: coberturaInfo.parentesco || null,
      codigo_poliza: coberturaInfo.codigo_poliza || null,
      plan: coberturaInfo.plan || null,
    };
  }

  if (Array.isArray(clientesAfectados) && clientesAfectados.length === 1) {
    return {
      nombre: clientesAfectados[0],
      parentesco: null,
      codigo_poliza: null,
      plan: null,
    };
  }

  return null;
};

// ==================== LÓGICA DE COBERTURAS ====================

const computeCoberturasDiff = (anteriorVal, nuevoVal) => {
  const prevList = normalizeCoberturas(anteriorVal);
  const newList = normalizeCoberturas(nuevoVal);
  const prevMap = new Map();
  
  prevList.forEach((c, idx) => {
    prevMap.set(buildCobKey(c, idx), c);
  });

  const result = [];

  newList.forEach((cNuevo, idx) => {
    const key = buildCobKey(cNuevo, idx);
    const cPrev = prevMap.get(key) || null;
    const clientePrev = cPrev?.cliente || {};
    const clienteNuevo = cNuevo?.cliente || {};
    const nombrePrev = obtenerNombreCliente(clientePrev);
    const nombreNuevo = obtenerNombreCliente(clienteNuevo);
    const parentesco = cNuevo.parentesco || cPrev?.parentesco || "";
    const cambios = {};

    if (JSON.stringify(nombrePrev || "") !== JSON.stringify(nombreNuevo || "")) {
      cambios.nombre = {
        label: "Nombre",
        anterior: nombrePrev || "—",
        nuevo: nombreNuevo || "—",
      };
    }

    const compPrevNombre = cPrev?.compania?.nombre || "";
    const compNuevaNombre = cNuevo?.compania?.nombre || "";
    if (JSON.stringify(compPrevNombre) !== JSON.stringify(compNuevaNombre)) {
      cambios.compania = {
        label: "Compañía",
        anterior: compPrevNombre || "—",
        nuevo: compNuevaNombre || "—",
      };
    }

    COB_FIELDS.forEach((field) => {
      const vPrev = cPrev ? cPrev[field] : undefined;
      const vNuevo = cNuevo[field];
      if (JSON.stringify(vPrev) !== JSON.stringify(vNuevo)) {
        cambios[field] = {
          label: FIELD_LABELS[field] || field,
          anterior: vPrev ?? "—",
          nuevo: vNuevo ?? "—",
        };
      }
    });

    if (Object.keys(cambios).length === 0) return;

    result.push({
      key,
      parentesco,
      nombreNuevo: nombreNuevo || nombrePrev || "Sin nombre",
      cambios,
    });
  });

  return result;
};

const renderCoberturasDiffCell = (anteriorVal, nuevoVal) => {
  const diff = computeCoberturasDiff(anteriorVal, nuevoVal);
  if (!diff.length) return <span className="text-muted">—</span>;

  return (
    <div className="small" style={{ margin: "0" }}>
      {diff.map((item, idx) => (
        <div key={item.key} className="mb-3 p-2 border rounded" style={{ backgroundColor: "#f8f9fa", marginBottom: idx < diff.length - 1 ? "0.75rem" : "0" }}>
          <div className="mb-2" style={{ marginBottom: "0.5rem" }}>
            <div className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "0.2rem" }}>
              Cobertura de
            </div>
            <div className="d-flex align-items-center flex-wrap gap-2">
              <strong className="text-dark" style={{ wordBreak: "break-word", fontSize: "0.95rem" }}>
                {item.nombreNuevo}
              </strong>
              {item.parentesco && (
                <span className="badge bg-secondary" style={{ fontSize: "0.75rem" }}>
                  {item.parentesco}
                </span>
              )}
            </div>
          </div>
          <div className="ms-1" style={{ marginLeft: "0.25rem" }}>
            {Object.values(item.cambios).map((c, cIdx) => (
              <div key={c.label} className="mb-1 d-flex align-items-start" style={{ marginBottom: cIdx < Object.values(item.cambios).length - 1 ? "0.5rem" : "0", flexWrap: "wrap" }}>
                <span className="text-muted me-2" style={{ fontSize: "0.85rem", minWidth: "100px", flexShrink: 0 }}>
                  {c.label}:
                </span>
                <span className="text-muted me-2" style={{ fontSize: "0.85rem", wordBreak: "break-word", flex: "1 1 auto" }}>
                  {formatValue(c.anterior)}
                </span>
                <span className="text-muted me-2" style={{ flexShrink: 0 }}>→</span>
                <span className="text-dark fw-semibold" style={{ fontSize: "0.85rem", wordBreak: "break-word", flex: "1 1 auto" }}>
                  {formatValue(c.nuevo)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const renderValorSeccion = (val, fieldKey) => {
  if (esCampoTelefonos(fieldKey)) return renderTelefonosHistorial(val);
  return formatValorCampoCliente(val, fieldKey);
};

const textoPlanoValor = (val, fieldKey) => {
  const formatted = formatValorCampoCliente(val, fieldKey);
  if (formatted) return formatted;
  if (val === null || val === undefined || val === "") return "";
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
};

const etiquetaFilaOrigen = (fila) => etiquetaOrigenActualizacion(
  fila.origen,
  fila.grupoFamiliarOrigenId,
  fila.coberturaOrigenId,
);

const textoBusquedaFila = (fila) =>
  [
    formatDateTime(fila.fecha),
    fila.usuario,
    fila.label,
    textoPlanoValor(fila.anterior, fila.campo),
    textoPlanoValor(fila.nuevo, fila.campo),
    etiquetaFilaOrigen(fila),
  ].join(" ").toLowerCase();

const opcionesCampoHistorial = (filas) => {
  const opciones = [];
  const vistos = new Set();
  filas.forEach((fila) => {
    if (!fila?.campo || vistos.has(fila.campo)) return;
    vistos.add(fila.campo);
    opciones.push({ value: fila.campo, label: fila.label || fila.campo });
  });
  return opciones;
};

const filasDeHistorialSeccion = (rows, seccionId) => {
  const filas = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const campos = seccionId === "cobertura"
      ? Object.keys(row?.cambios || {}).filter((campo) => {
        const key = campo.split(".").pop();
        const info = row.cambios[campo];
        return !CAMPOS_IGNORAR.has(campo) && !/updated|fecha_actualizacion/i.test(campo)
          && !["id", "created_at", "deleted_at", "edad", "cliente_id", "grupo_familiar_id"].includes(key)
          && !["cliente", "grupo_familiar", "medio_pago", "medios_pago", "responsable"].includes(key)
          && !campo.startsWith("cliente.")
          && ![info?.anterior, info?.nuevo].some((valor) => valor !== null && typeof valor === "object")
          && JSON.stringify(info?.anterior ?? null) !== JSON.stringify(info?.nuevo ?? null);
      })
      : ordenarCamposDeSeccion(Object.keys(row?.cambios || {}), seccionId);
    campos.forEach((campo) => {
      const info = row.cambios[campo];
      filas.push({
        key: `${row.id ?? "sin-id"}-${campo}`,
        fecha: row.created_at || row.fecha,
        usuario: row.usuario || "—",
        campo,
        esCobertura: seccionId === "cobertura",
        label: getFieldLabel(claveCampoCliente(campo)),
        anterior: info?.anterior,
        nuevo: info?.nuevo,
        origen: row.origen ?? null,
        grupoFamiliarOrigenId: row.grupo_familiar_origen_id ?? null,
        coberturaOrigenId: row.cobertura_origen_id ?? null,
      });
    });
  });
  return filas;
};

function filtroHistorialSeccion({
  opcionesCampo,
  filtroCampo,
  onCampo,
  filtroTexto,
  onTexto,
  fechaDesde,
  fechaHasta,
  onDesde,
  onHasta,
  onLimpiar,
  total,
  visibles,
}) {
  const hayFiltro = Boolean(filtroCampo || filtroTexto.trim() || fechaDesde || fechaHasta);

  return (
    <div className="mb-3">
      <div className="row g-2 align-items-end">
        <div className="col-12 col-md-3">
          <label htmlFor="historial-filtro-campo" className="form-label small mb-1">
            Campo
          </label>
          <select
            id="historial-filtro-campo"
            className="form-select form-select-sm"
            value={filtroCampo}
            onChange={(event) => onCampo(event.target.value)}
          >
            <option value="">Todos los campos</option>
            {opcionesCampo.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md">
          <label htmlFor="historial-filtro-texto" className="form-label small mb-1">
            Buscar
          </label>
          <input
            id="historial-filtro-texto"
            type="search"
            className="form-control form-control-sm"
            placeholder="Usuario, fecha o valor"
            value={filtroTexto}
            onChange={(event) => onTexto(event.target.value)}
          />
        </div>
        <div className="col-6 col-md-auto">
          <label htmlFor="historial-desde" className="form-label small mb-1">Desde</label>
          <EntradaFechaHistorial id="historial-desde" value={fechaDesde} onChange={onDesde} />
        </div>
        <div className="col-6 col-md-auto">
          <label htmlFor="historial-hasta" className="form-label small mb-1">Hasta</label>
          <EntradaFechaHistorial id="historial-hasta" value={fechaHasta} onChange={onHasta} />
        </div>
        {hayFiltro && (
          <div className="col-12 col-md-auto">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onLimpiar}>
              Limpiar
            </button>
          </div>
        )}
      </div>
      <p className="small text-muted mb-0 mt-2">
        {visibles} de {total} {total === 1 ? "cambio" : "cambios"}
      </p>
    </div>
  );
}

const enmascararFechaMdY = (valor) => {
  const texto = String(valor ?? "");
  if (/[/-]/.test(texto)) {
    const partes = texto.split(/[/-]/);
    const mes = (partes[0] || "").replace(/\D/g, "").slice(0, 2);
    const dia = (partes[1] || "").replace(/\D/g, "").slice(0, 2);
    const anio = (partes[2] || "").replace(/\D/g, "").slice(0, 4);
    const terminaSeparador = /[/-]$/.test(texto);
    if (partes.length <= 1) return mes;
    if (partes.length === 2) {
      if (!dia && terminaSeparador) return mes ? `${mes}/` : "";
      return dia ? `${mes}/${dia}` : mes;
    }
    const mesListo = mes.length === 1 && (dia || anio) ? mes.padStart(2, "0") : mes;
    const diaListo = dia.length === 1 && anio ? dia.padStart(2, "0") : dia;
    if (!anio && terminaSeparador) return `${mesListo}/${diaListo}/`;
    if (!anio) return diaListo ? `${mesListo}/${diaListo}` : (mesListo ? `${mesListo}/` : "");
    return `${mesListo}/${diaListo}/${anio}`;
  }
  const digitos = texto.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
};

const fechaMdY = (valor) => {
  const texto = String(valor || "").trim();
  if (!texto) return "";
  const match = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const mes = Number(match[1]);
  const dia = Number(match[2]);
  const anio = Number(match[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const iso = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const comprobacion = new Date(`${iso}T00:00:00`);
  if (
    comprobacion.getFullYear() !== anio
    || comprobacion.getMonth() + 1 !== mes
    || comprobacion.getDate() !== dia
  ) {
    return null;
  }
  return iso;
};

const fechaHistorialIncompleta = (valor) => {
  const texto = String(valor || "").trim();
  if (!texto) return false;
  return texto.replace(/\D/g, "").length < 8;
};

function EntradaFechaHistorial({ id, value, onChange }) {
  const calendarioRef = useRef(null);
  const iso = fechaMdY(value) || "";

  const abrirCalendario = () => {
    const input = calendarioRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        input.click();
        return;
      }
    }
    input.click();
  };

  return (
    <div className="position-relative" style={{ width: "11.25rem" }}>
      <div className="input-group input-group-sm">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="form-control"
          placeholder="mm/dd/aaaa"
          title="Escribe 10022026 o mm/dd/aaaa. El calendario usa el mismo formato."
          value={value}
          onChange={(event) => onChange(enmascararFechaMdY(event.target.value))}
        />
        <button
          type="button"
          className="btn btn-outline-secondary"
          aria-label="Abrir calendario"
          title="Abrir calendario"
          onClick={abrirCalendario}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z" />
          </svg>
        </button>
      </div>
      <input
        ref={calendarioRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={iso}
        onChange={(event) => {
          const elegido = event.target.value;
          if (!elegido) {
            onChange("");
            return;
          }
          const [anio, mes, dia] = elegido.split("-");
          onChange(`${mes}/${dia}/${anio}`);
        }}
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

const coincideFiltroFila = (fila, filtroCampo, consulta) => {
  if (filtroCampo && fila.campo !== filtroCampo) return false;
  if (!consulta) return true;
  return textoBusquedaFila(fila).includes(consulta);
};

function listadoFilasSeccion(filasVisibles) {
  const mostrarOrigen = !filasVisibles.every((fila) => fila.esCobertura);
  return (
    <>
      <div className="d-md-none">
        {filasVisibles.map((fila) => (
          <article key={fila.key} className="border rounded p-2 mb-2">
            <div className="small text-muted mb-1">
              {formatDateTime(fila.fecha)} · {fila.usuario}
            </div>
            {mostrarOrigen && <div className="small mb-1">
              <span className="text-muted">Origen: </span>
              {etiquetaFilaOrigen(fila)}
            </div>}
            <div className="fw-semibold mb-1">{fila.label}</div>
            <div className="small mb-1">
              <span className="text-muted">Anterior: </span>
              {(fila.esCobertura ? formatValueForHistorial(fila.anterior, fila.campo) : renderValorSeccion(fila.anterior, fila.campo))}
            </div>
            <div className="small">
              <span className="text-muted">Nuevo: </span>
              <span className="fw-semibold">{(fila.esCobertura ? formatValueForHistorial(fila.nuevo, fila.campo) : renderValorSeccion(fila.nuevo, fila.campo))}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="d-none d-md-block table-responsive">
        <table className="table table-sm table-hover align-middle border mb-0">
          <thead style={{ backgroundColor: "#e9ecef" }}>
            <tr>
              <th scope="col">Fecha</th>
              {mostrarOrigen && <th scope="col" title="Origen de la actualización" style={{ width: "1%", whiteSpace: "nowrap" }}>
                Origen
              </th>}
              <th scope="col">Usuario</th>
              <th scope="col">Campo</th>
              <th scope="col">Anterior</th>
              <th scope="col">Nuevo</th>
            </tr>
          </thead>
          <tbody>
            {filasVisibles.map((fila) => (
              <tr key={fila.key}>
                <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(fila.fecha)}</td>
                {mostrarOrigen && <td style={{ whiteSpace: "nowrap" }}>
                  {etiquetaFilaOrigen(fila)}
                </td>}
                <td>{fila.usuario}</td>
                <td>{fila.label}</td>
                <td style={{ wordBreak: "break-word" }}>
                  <span className="text-muted">{(fila.esCobertura ? formatValueForHistorial(fila.anterior, fila.campo) : renderValorSeccion(fila.anterior, fila.campo))}</span>
                </td>
                <td style={{ wordBreak: "break-word" }}>
                  <span className="fw-semibold">{(fila.esCobertura ? formatValueForHistorial(fila.nuevo, fila.campo) : renderValorSeccion(fila.nuevo, fila.campo))}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function vistaHistorialSeccion({
  cargando,
  error,
  filas,
  filtroCampo,
  filtroTexto,
  fechaDesde,
  fechaHasta,
  onDesde,
  onHasta,
  onCampo,
  onTexto,
  onLimpiar,
  pagina,
  onPagina,
}) {
  if (cargando) {
    return (
      <div className="d-flex justify-content-center py-4">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger mb-0">{error}</div>;
  }

  if (filas.length === 0) {
    return (
      <div className="text-muted text-center py-3">
        Sin cambios registrados en esta sección.
      </div>
    );
  }

  const consulta = String(filtroTexto || "").trim().toLowerCase();
  const desdeIso = fechaHistorialIncompleta(fechaDesde) ? "" : fechaMdY(fechaDesde);
  const hastaIso = fechaHistorialIncompleta(fechaHasta) ? "" : fechaMdY(fechaHasta);
  const fechaInvalida = (Boolean(String(fechaDesde || "").trim()) && !fechaHistorialIncompleta(fechaDesde) && desdeIso === null)
    || (Boolean(String(fechaHasta || "").trim()) && !fechaHistorialIncompleta(fechaHasta) && hastaIso === null);
  const rangoInvalido = Boolean(desdeIso && hastaIso && desdeIso > hastaIso);
  const filasVisibles = fechaInvalida || rangoInvalido ? [] : filas.filter((fila) => {
    if (!coincideFiltroFila(fila, filtroCampo, consulta)) return false;
    if (!desdeIso && !hastaIso) return true;
    const match = formatDateTime(fila.fecha).match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (!match) return false;
    const dia = `${match[3]}-${match[1]}-${match[2]}`;
    return (!desdeIso || dia >= desdeIso) && (!hastaIso || dia <= hastaIso);
  });
  const paginaActual = paginarFilas(filasVisibles, pagina);

  return (
    <>
      {filtroHistorialSeccion({
        opcionesCampo: opcionesCampoHistorial(filas),
        filtroCampo,
        onCampo,
        filtroTexto,
        onTexto,
        fechaDesde,
        fechaHasta,
        onDesde,
        onHasta,
        onLimpiar,
        total: filas.length,
        visibles: filasVisibles.length,
      })}

      {filasVisibles.length === 0 ? (
        <div className="text-muted text-center py-3">
          {fechaInvalida
            ? "Usa el formato mm/dd/aaaa en Desde y Hasta."
            : rangoInvalido
              ? "La fecha Desde debe ser anterior o igual a Hasta."
              : "Ningún cambio coincide con el filtro."}
        </div>
      ) : (
        <>
          {listadoFilasSeccion(paginaActual.filas)}
          {paginaActual.paginas > 1 && (
            <nav className="d-flex align-items-center justify-content-between gap-2 mt-3" aria-label="Páginas del historial">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={paginaActual.pagina <= 1}
                onClick={() => onPagina(paginaActual.pagina - 1)}
              >
                Anterior
              </button>
              <span className="small text-muted">
                Página {paginaActual.pagina} de {paginaActual.paginas}
              </span>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={paginaActual.pagina >= paginaActual.paginas}
                onClick={() => onPagina(paginaActual.pagina + 1)}
              >
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );
}

// ==================== COMPONENTE PRINCIPAL ====================

export default function HistorialCambiosModal({
  show,
  onClose,
  modelo = "GrupoFamiliar",
  modeloId,
  seccion,
  grupoFamiliarId = null,
  /** Si true (solo GF): abre lista de coberturas del grupo antes del historial general. */
  inicioConListaCoberturas = false,
}) {
  const [historial, setHistorial] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("grupo");
  const [titularesPorCobertura, setTitularesPorCobertura] = useState({});
  const [historialSeccion, setHistorialSeccion] = useState({
    key: "",
    rows: [],
    error: null,
    loading: false,
  });
  const [filtroCampo, setFiltroCampo] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [vistaHub, setVistaHub] = useState("lista"); // lista | cobertura | grupo
  const [coberturaHub, setCoberturaHub] = useState(null);
  const [busquedaHub, setBusquedaHub] = useState("");
  const [anioHub, setAnioHub] = useState("");
  const [listaCoberturas, setListaCoberturas] = useState([]);
  const [listaLoading, setListaLoading] = useState(false);
  const [listaError, setListaError] = useState(null);
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isGrupo = modelo === "GrupoFamiliar";
  const hubActivo = Boolean(inicioConListaCoberturas && isGrupo && show);
  const modeloEfectivo =
    hubActivo && vistaHub === "cobertura" ? "Cobertura" : modelo;
  const modeloIdEfectivo =
    hubActivo && vistaHub === "cobertura" ? coberturaHub?.id : modeloId;
  const seccionEfectiva =
    hubActivo && vistaHub === "cobertura" ? "cobertura" : seccion;
  const grupoFamiliarIdEfectivo =
    hubActivo && vistaHub === "cobertura"
      ? toValidModeloId(modeloId) ?? grupoFamiliarId
      : grupoFamiliarId;
  const filtrarPorSeccion = seccionEfectiva != null && seccionEfectiva !== "";
  const mostrarListaHub = hubActivo && vistaHub === "lista";
  const mostrarDetalleHub = hubActivo && vistaHub !== "lista";
  const atraparFoco = filtrarPorSeccion || hubActivo;

  useEffect(() => {
    if (!inicioConListaCoberturas) return;
    setVistaHub("lista");
    setCoberturaHub(null);
    setBusquedaHub("");
    setAnioHub("");
    setListaCoberturas([]);
    setListaError(null);
    setHistorial([]);
    setSelected(null);
    setError(null);
    setHistorialSeccion({ key: "", rows: [], error: null, loading: false });
  }, [show, modeloId, inicioConListaCoberturas]);

  useEffect(() => {
    setFiltroCampo("");
    setFiltroTexto("");
    setFechaDesde("");
    setFechaHasta("");
    setPaginaHistorial(1);
  }, [seccionEfectiva, modeloIdEfectivo, grupoFamiliarIdEfectivo]);

  useEffect(() => {
    setPaginaHistorial(1);
  }, [filtroCampo, filtroTexto, fechaDesde, fechaHasta]);

  // Obtener historial de coberturas relacionadas
  const obtenerHistorialCoberturas = async (coberturas = []) => {
    try {
      const historialesCoberturas = await Promise.all(
        (Array.isArray(coberturas) ? coberturas : [])
          .filter((cob) => cob?.id)
          .map(async (cobertura) => {
            try {
              const resCob = await apiRequest(`/historial/Cobertura/${cobertura.id}`, "GET");
              const historialCob = Array.isArray(resCob.data) ? resCob.data : [];
              
              return historialCob.map(record => ({
                ...record,
                _esCobertura: true,
                _coberturaId: cobertura.id,
                _coberturaInfo: {
                  codigo_poliza: cobertura.codigo_poliza,
                  plan: cobertura.plan,
                  cliente_nombre: obtenerNombreCliente(cobertura.cliente) || "Sin nombre",
                  parentesco: cobertura.parentesco,
                }
              }));
            } catch (err) {
              console.warn(`Error obteniendo historial de cobertura ${cobertura.id}:`, err);
              return [];
            }
          })
      );
      
      return historialesCoberturas.flat();
    } catch (err) {
      console.warn("Error obteniendo historial de coberturas:", err);
      return [];
    }
  };

  const obtenerHistorialMediosPago = async (grupoDataOrNull, clienteIdDirecto = null) => {
    try {
      let clienteIds = [];
      const nombresPorCliente = {};

      if (clienteIdDirecto) {
        clienteIds = [clienteIdDirecto];
      } else if (grupoDataOrNull) {
        const coberturas = Array.isArray(grupoDataOrNull?.coberturas) ? grupoDataOrNull.coberturas : [];
        clienteIds = [
          ...new Set(
            coberturas
              .map((cob) => cob?.cliente?.id ?? cob?.cliente_id)
              .filter(Boolean)
          ),
        ];
        coberturas.forEach((cob) => {
          const id = cob?.cliente?.id ?? cob?.cliente_id;
          if (id) {
            nombresPorCliente[id] = obtenerNombreCliente(cob?.cliente) || nombresPorCliente[id];
          }
        });
      }

      const historialesMedios = await Promise.all(
        clienteIds.map(async (clienteId) => {
          try {
            const res = await apiRequest(`/historial/cliente/${clienteId}/medios-pago`, "GET");
            const historialMedios = Array.isArray(res.data) ? res.data : [];

            return historialMedios.map((record) => ({
              ...record,
              _esMedioPago: true,
              _medioPagoId: record.modelo_id,
              _medioPagoInfo: {
                cliente_id: clienteId,
                cliente_nombre:
                  record.clientes_afectados?.[0]
                  || nombresPorCliente[clienteId]
                  || `Cliente #${clienteId}`,
                forma_pago:
                  record.cambios?.forma_pago?.nuevo
                  || record.cambios?.forma_pago?.anterior
                  || null,
              },
            }));
          } catch (err) {
            console.warn(`Error obteniendo historial de medios de pago del cliente ${clienteId}:`, err);
            return [];
          }
        })
      );

      return historialesMedios.flat();
    } catch (err) {
      console.warn("Error obteniendo historial de medios de pago:", err);
      return [];
    }
  };

  // Función auxiliar para verificar si un campo debe ser ignorado
  const debeIgnorarCampo = (campo) => {
    // Verificar si el campo está directamente en la lista de ignorados
    if (CAMPOS_IGNORAR.has(campo)) return true;
    
    // Verificar si el campo termina con alguna variante de fecha de actualización
    const campoLower = campo.toLowerCase();
    if (campoLower.includes('updated_at') || 
        campoLower.includes('updatedat') ||
        campoLower.includes('fecha_actualizacion') ||
        campoLower.includes('fechaactualizacion')) {
      return true;
    }
    
    // Verificar campos anidados (ej: cobertura_73.updated_at, cliente.updated_at)
    const partes = campo.split('.');
    if (partes.length > 1) {
      const ultimaParte = partes[partes.length - 1].toLowerCase();
      if (ultimaParte.includes('updated_at') || 
          ultimaParte.includes('updatedat') ||
          ultimaParte.includes('fecha_actualizacion') ||
          ultimaParte.includes('fechaactualizacion')) {
        return true;
      }
    }
    
    return false;
  };

  // Filtrar registros relevantes
  const filtrarRegistrosRelevantes = (rows) => {
    return rows.filter((row) => {
      const cambios = row.cambios || {};
      const camposCambios = Object.keys(cambios);
      if (camposCambios.length === 0) return false;
      const camposRelevantes = camposCambios.filter(campo => !debeIgnorarCampo(campo));
      return camposRelevantes.length > 0;
    });
  };

  // Contar cambios por categoría
  const contarCambiosPorCategoria = (cambios, opts = {}) => {
    // Filtrar campos ignorados (incluyendo fechas de actualización)
    const keys = Object.keys(cambios || {}).filter(campo => !debeIgnorarCampo(campo));
    let grupo = 0;
    let coberturas = 0;
    let clientes = 0;
    const forzarCobertura = !!opts.esCobertura;

    keys.forEach((campo) => {
      if (campo === "coberturas") {
        coberturas++;
      } else if (campo.startsWith("cliente.")) {
        clientes++;
      } else if (campo.match(/^cobertura_\d+\.cliente\./)) {
        clientes++;
      } else if (campo.match(/^cobertura_\d+(\.|$)/)) {
        coberturas++;
      } else if (forzarCobertura) {
        coberturas++;
      } else {
        grupo++;
      }
    });

    return { grupo, coberturas, clientes };
  };

  // Agrupar cambios por cliente
  const agruparCambiosPorCliente = (cambios, coverageGroups, coberturaClientes) => {
    const clientesMap = new Map();
    let clientePrincipalNombre = "";
    const nombrePrincipalCampo = cambios["cliente.nombre_completo"];
    
    if (nombrePrincipalCampo) {
      clientePrincipalNombre = nombrePrincipalCampo.nuevo || nombrePrincipalCampo.anterior || "";
    }

    // Procesar campos directos de cliente (cliente.*)
    Object.keys(cambios)
      .filter(campo => !debeIgnorarCampo(campo) && campo.startsWith("cliente."))
      .forEach((campo) => {
        const info = cambios[campo];
        if (!info) return;
        
        const fieldKey = campo.replace("cliente.", "");
        const anteriorNormalizado = normalizeValue(info.anterior);
        const nuevoNormalizado = normalizeValue(info.nuevo);
        const same = JSON.stringify(anteriorNormalizado) === JSON.stringify(nuevoNormalizado);
        
        if (same && fieldKey !== "nombre_completo") return;

        let clienteNombre = "";
        if (fieldKey === "nombre_completo") {
          clienteNombre = nuevoNormalizado || anteriorNormalizado || "Cliente sin nombre";
          if (clienteNombre && clienteNombre !== "Cliente sin nombre") {
            clientePrincipalNombre = clienteNombre;
          }
        } else {
          clienteNombre = clientePrincipalNombre || "Cliente Principal";
        }

        const clienteKey = `cliente-directo-${clienteNombre}`;
        if (!clientesMap.has(clienteKey)) {
          clientesMap.set(clienteKey, {
            key: clienteKey,
            nombre: clienteNombre,
            coberturaId: null,
            cambios: [],
          });
        }
        
        if (!same || fieldKey === "nombre_completo") {
          clientesMap.get(clienteKey).cambios.push({
            campo,
            fieldKey,
            info,
          });
        }
      });

    // Procesar cambios de clientes en coberturas (cobertura_X.cliente.*)
    Object.keys(coverageGroups).forEach((coberturaId) => {
      const fieldsForCoverage = coverageGroups[coberturaId];
      const clienteFields = fieldsForCoverage.filter((f) => f.fieldKey.startsWith("cliente."));

      if (clienteFields.length > 0) {
        let clienteNombre = "";
        const nombreField = clienteFields.find((f) => f.fieldKey === "cliente.nombre_completo");

        if (nombreField) {
          const infoNombre = cambios[nombreField.campo] || {};
          // Priorizar obtener el nombre desde los cambios, solo usar coberturaClientes como último recurso
          clienteNombre = infoNombre.nuevo || infoNombre.anterior || "";
          if (!clienteNombre && coberturaClientes && coberturaClientes[coberturaId]) {
            clienteNombre = normalizarTitularCobertura(coberturaClientes[coberturaId])?.nombre || "";
          }
          if (!clienteNombre) {
            clienteNombre = `Cliente Cobertura ${coberturaId}`;
          }
        } else {
          const primerNombreField = clienteFields.find((f) => f.fieldKey === "cliente.primer_nombre");
          const apellidosField = clienteFields.find((f) => f.fieldKey === "cliente.apellidos");
          
          if (primerNombreField || apellidosField) {
            const primerNombre = primerNombreField ? 
              (cambios[primerNombreField.campo]?.nuevo || cambios[primerNombreField.campo]?.anterior || "") : "";
            const apellidos = apellidosField ? 
              (cambios[apellidosField.campo]?.nuevo || cambios[apellidosField.campo]?.anterior || "") : "";
            clienteNombre = [primerNombre, apellidos].filter(Boolean).join(" ");
            if (!clienteNombre && coberturaClientes && coberturaClientes[coberturaId]) {
              clienteNombre = normalizarTitularCobertura(coberturaClientes[coberturaId])?.nombre || "";
            }
            if (!clienteNombre) {
              clienteNombre = `Cliente Cobertura ${coberturaId}`;
            }
          } else {
            // Si no hay campos de nombre, intentar usar coberturaClientes, sino usar ID
            clienteNombre = normalizarTitularCobertura(coberturaClientes?.[coberturaId])?.nombre
              || `Persona cobertura #${coberturaId}`;
          }
        }

        const clienteKey = `cobertura-${coberturaId}-${clienteNombre}`;
        if (!clientesMap.has(clienteKey)) {
          clientesMap.set(clienteKey, {
            key: clienteKey,
            nombre: clienteNombre,
            coberturaId,
            cambios: [],
          });
        }

        clienteFields.forEach(({ campo, fieldKey }) => {
          // Ignorar campos de fecha de actualización
          if (debeIgnorarCampo(campo)) return;
          
          const info = cambios[campo];
          if (!info) return;
          
          const anteriorNormalizado = normalizeValue(info.anterior);
          const nuevoNormalizado = normalizeValue(info.nuevo);
          const same = JSON.stringify(anteriorNormalizado) === JSON.stringify(nuevoNormalizado);
          
          if (!same) {
            clientesMap.get(clienteKey).cambios.push({
              campo,
              fieldKey,
              info,
            });
          }
        });
      }
    });

    return Array.from(clientesMap.values()).filter((cliente) => cliente.cambios.length > 0);
  };

  // Lista de coberturas del hub (sin historiales individuales)
  useEffect(() => {
    if (!mostrarListaHub || !modeloId) return undefined;

    let cancelled = false;

    const cargarLista = async () => {
      setListaLoading(true);
      setListaError(null);
      try {
        const grupoData = await GrupoFamiliarService.getFullById(modeloId);
        if (cancelled) return;
        const coberturasGrupo = Array.isArray(grupoData?.coberturas) ? grupoData.coberturas : [];
        setListaCoberturas(normalizarCoberturasDelGrupo(coberturasGrupo, modeloId));
      } catch (e) {
        if (cancelled) return;
        console.error("Error cargando coberturas del grupo:", e);
        setListaError("No se pudieron cargar las coberturas del grupo.");
        setListaCoberturas([]);
      } finally {
        if (!cancelled) setListaLoading(false);
      }
    };

    cargarLista();
    return () => {
      cancelled = true;
    };
  }, [mostrarListaHub, modeloId]);

  // Cargar historial (detalle de cobertura o historial general; no en la lista del hub)
  useEffect(() => {
    if (!show || !modeloIdEfectivo || mostrarListaHub) return undefined;

    let cancelled = false;
    const modeloFetch = modeloEfectivo;
    const modeloIdFetch = modeloIdEfectivo;
    const seccionFetch = seccionEfectiva;
    const esGrupoFetch = modeloFetch === "GrupoFamiliar";

    const fetchHistorial = async () => {
      if (seccionFetch) {
        const key = `${modeloFetch}:${modeloIdFetch}:${seccionFetch}`;
        setHistorialSeccion({ key, rows: [], error: null, loading: true });

        try {
          const res = await apiRequest(`/historial/${modeloFetch}/${modeloIdFetch}`, "GET");
          if (cancelled) return;
          const rows = (Array.isArray(res.data) ? res.data : []).filter(
            seccionFetch === "cobertura" ? (row) => row.modelo_afectado === "Cobertura" : esEventoIndividualCliente
          );
          setHistorialSeccion({
            key,
            rows: seccionFetch === "cobertura" ? [...rows].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))) : filtrarHistorialPorSeccion(rows, seccionFetch),
            error: null,
            loading: false,
          });
        } catch (e) {
          if (cancelled) return;
          console.error("Error cargando historial:", e);
          setHistorialSeccion({
            key,
            rows: [],
            error: "No se pudo cargar el historial de cambios.",
            loading: false,
          });
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Obtener historial del modelo principal
        const res = await apiRequest(`/historial/${modeloFetch}/${modeloIdFetch}`, "GET");
        if (cancelled) return;
        let rows = Array.isArray(res.data) ? res.data : [];
        
        // Si es GrupoFamiliar, obtener también historial de coberturas
        if (esGrupoFetch && modeloIdFetch) {
          const grupoData = await GrupoFamiliarService.getFullById(modeloIdFetch);
          if (cancelled) return;
          const coberturasGrupo = Array.isArray(grupoData?.coberturas) ? grupoData.coberturas : [];
          setTitularesPorCobertura(buildTitularesDesdeCoberturas(coberturasGrupo));

          const [registrosCoberturas, registrosMediosPago] = await Promise.all([
            obtenerHistorialCoberturas(coberturasGrupo),
            obtenerHistorialMediosPago(grupoData),
          ]);
          if (cancelled) return;
          rows = [...rows, ...registrosCoberturas, ...registrosMediosPago];
          
          rows.sort((a, b) => {
            const fechaA = new Date(a.created_at || a.fecha || 0).getTime();
            const fechaB = new Date(b.created_at || b.fecha || 0).getTime();
            return fechaB - fechaA;
          });
        } else if (modeloFetch === "Cliente" && modeloIdFetch) {
          setTitularesPorCobertura({});
          const registrosMediosPago = await obtenerHistorialMediosPago(null, modeloIdFetch);
          if (cancelled) return;
          rows = [...rows, ...registrosMediosPago];
          rows.sort((a, b) => {
            const fechaA = new Date(a.created_at || a.fecha || 0).getTime();
            const fechaB = new Date(b.created_at || b.fecha || 0).getTime();
            return fechaB - fechaA;
          });
        } else {
          setTitularesPorCobertura({});
        }
        
        if (cancelled) return;
        const historialFiltrado = filtrarRegistrosRelevantes(rows);
        setHistorial(historialFiltrado);
        setSelected(historialFiltrado.length > 0 ? historialFiltrado[0] : null);
      } catch (e) {
        if (cancelled) return;
        console.error("Error cargando historial:", e);
        setError("No se pudo cargar el historial de cambios.");
        setSelected(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHistorial();
    return () => {
      cancelled = true;
    };
  }, [show, modeloEfectivo, modeloIdEfectivo, seccionEfectiva, mostrarListaHub]);

  // Auto-seleccionar el área con cambios al cambiar de registro
  useEffect(() => {
    if (!selected?.cambios) return;

    const keys = Object.keys(selected.cambios).filter((campo) => !debeIgnorarCampo(campo));
    const tieneAltas = keys.some((campo) => esAltaCoberturaCampo(campo));
    const esAltaCobertura = !!(selected._esCobertura && selected.accion === "create");
    const contadores = contarCambiosPorCategoria(selected.cambios, {
      esCobertura: !!(selected._esCobertura),
    });

    if (tieneAltas || esAltaCobertura || (contadores.coberturas > 0 && contadores.grupo === 0 && contadores.clientes === 0)) {
      setViewMode("coberturas");
      return;
    }
    if (contadores.grupo > 0) {
      setViewMode("grupo");
    } else if (contadores.coberturas > 0) {
      setViewMode("coberturas");
    } else if (contadores.clientes > 0) {
      setViewMode("clientes");
    } else {
      setViewMode("grupo");
    }
  }, [selected?.id]);

  useEffect(() => {
    if (!show || !atraparFoco) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const root = dialogRef.current;
      if (!root) return;
      const focusable = [...root.querySelectorAll(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      )].filter((el) => !el.disabled);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previouslyFocused = document.activeElement;
    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [show, atraparFoco]);

  if (!show) return null;

  const volverAListaHub = () => {
    setVistaHub("lista");
    setCoberturaHub(null);
    setSelected(null);
    setHistorial([]);
    setError(null);
    setHistorialSeccion({ key: "", rows: [], error: null, loading: false });
  };

  const abrirDetalleCoberturaHub = (item) => {
    if (!toValidModeloId(item?.id)) return;
    setCoberturaHub(item);
    setVistaHub("cobertura");
  };

  const abrirHistorialGeneralHub = () => {
    setCoberturaHub(null);
    setVistaHub("grupo");
  };

  const coberturasFiltradasHub = filtrarCoberturasHub(listaCoberturas, busquedaHub, anioHub);
  const personasHub = agruparCoberturasPorPersona(coberturasFiltradasHub);
  const aniosHubDisponibles = [...new Set(
    listaCoberturas.map((c) => c.ano_cobertura).filter((a) => a != null && a !== "")
  )].sort((a, b) => Number(b) - Number(a));

  const claveSeccionActual = `${modeloEfectivo}:${modeloIdEfectivo}:${seccionEfectiva || ""}`;
  const seccionVigente = historialSeccion.key === claveSeccionActual;
  const cargandoSeccion = filtrarPorSeccion && (!seccionVigente || historialSeccion.loading);
  const errorSeccion = filtrarPorSeccion && seccionVigente ? historialSeccion.error : null;
  const filasSeccion = filtrarPorSeccion && seccionVigente && !historialSeccion.loading && !historialSeccion.error
    ? filasDeHistorialSeccion(historialSeccion.rows, seccionEfectiva)
    : [];
  const tituloSeccion = seccionEfectiva === "cobertura"
    ? `Detalle de cobertura #${modeloIdEfectivo}`
    : ETIQUETAS_SECCION_FICHA[seccionEfectiva] || "Sección";

  const tituloModal = mostrarListaHub
    ? "Historial del grupo y sus coberturas"
    : filtrarPorSeccion
      ? `Historial · ${tituloSeccion}`
      : hubActivo && vistaHub === "grupo"
        ? "Historial de Cambios"
        : "Historial de Cambios";

  const subtituloModal = (() => {
    if (mostrarListaHub) {
      return modeloId ? `Grupo familiar #${modeloId}` : "Sin grupo familiar";
    }
    if (hubActivo && vistaHub === "cobertura" && coberturaHub) {
      const persona = coberturaHub.cliente_id != null
        ? `${coberturaHub.cliente_nombre} (ID ${coberturaHub.cliente_id})`
        : coberturaHub.cliente_nombre;
      return `${persona} · ${coberturaHub.cobertura_tipo} #${coberturaHub.id} · Grupo familiar #${modeloId}`;
    }
    if (filtrarPorSeccion) {
      return grupoFamiliarIdEfectivo
        ? `Grupo familiar #${grupoFamiliarIdEfectivo}`
        : "Sin grupo familiar";
    }
    if (hubActivo && vistaHub === "grupo") {
      return modeloId ? `Grupo familiar #${modeloId}` : null;
    }
    return null;
  })();

  const renderListaCoberturasHub = () => (
    <div className="d-flex flex-column" style={{ flex: "1 1 auto", minHeight: 0 }}>
      <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
        <div className="flex-grow-1" style={{ minWidth: "12rem" }}>
          <label htmlFor="historial-hub-busqueda" className="form-label small mb-1">
            Buscar
          </label>
          <input
            id="historial-hub-busqueda"
            type="search"
            className="form-control form-control-sm"
            placeholder="Persona, cobertura, plan o ID"
            value={busquedaHub}
            onChange={(event) => setBusquedaHub(event.target.value)}
          />
        </div>
        <div style={{ minWidth: "7rem" }}>
          <label htmlFor="historial-hub-anio" className="form-label small mb-1">
            Año
          </label>
          <select
            id="historial-hub-anio"
            className="form-select form-select-sm"
            value={anioHub}
            onChange={(event) => setAnioHub(event.target.value)}
          >
            <option value="">Todos</option>
            {aniosHubDisponibles.map((anio) => (
              <option key={anio} value={anio}>{anio}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={abrirHistorialGeneralHub}
        >
          Cambios generales del grupo
        </button>
      </div>

      {listaLoading && (
        <div className="d-flex justify-content-center py-4">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Cargando coberturas…</span>
          </div>
        </div>
      )}

      {!listaLoading && listaError && (
        <div className="alert alert-danger mb-0">{listaError}</div>
      )}

      {!listaLoading && !listaError && listaCoberturas.length === 0 && (
        <div className="text-muted text-center py-4">
          Este grupo no tiene coberturas disponibles para consultar.
        </div>
      )}

      {!listaLoading && !listaError && listaCoberturas.length > 0 && coberturasFiltradasHub.length === 0 && (
        <div className="text-muted text-center py-4">
          Ninguna cobertura coincide con la búsqueda o el año seleccionados.
        </div>
      )}

      {!listaLoading && !listaError && personasHub.length > 0 && (
        <div className="flex-grow-1" style={{ minHeight: 0, overflowY: "auto" }}>
          {personasHub.map((persona) => (
            <section key={persona.clave} className="border rounded bg-white mb-3">
              <header className="px-3 py-2 border-bottom" style={{ backgroundColor: "#f1f5f9" }}>
                <div className="fw-semibold">
                  {persona.nombre}
                  {persona.personaId != null && (
                    <span className="text-muted fw-normal ms-2">ID {persona.personaId}</span>
                  )}
                </div>
                {persona.parentesco && (
                  <div className="small text-muted">{persona.parentesco}</div>
                )}
              </header>
              <ul className="list-unstyled mb-0">
                {persona.coberturas.map((cob) => (
                  <li
                    key={cob.id}
                    className="px-3 py-2 border-top d-flex flex-wrap gap-2 align-items-center justify-content-between"
                  >
                    <div className="min-w-0 flex-grow-1">
                      <div className="fw-semibold">{cob.cobertura_tipo}</div>
                      <div className="small text-muted">
                        {[cob.compania, cob.plan].filter(Boolean).join(" · ") || "Sin compañía / plan"}
                        {" · "}ID {cob.id}
                        {cob.ano_cobertura != null && cob.ano_cobertura !== "" ? ` · ${cob.ano_cobertura}` : ""}
                        {" · "}{cob.estado}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm flex-shrink-0"
                      aria-label={`Ver cambios de cobertura ${cob.cobertura_tipo} #${cob.id}`}
                      onClick={() => abrirDetalleCoberturaHub(cob)}
                    >
                      <i className="fas fa-history me-1" aria-hidden="true" />
                      Ver cambios
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );

  const renderDetalleCambios = () => {
    if (!selected) {
      return (
        <div className="text-center text-muted py-4">
          Selecciona un registro del historial para ver los detalles.
        </div>
      );
    }

    const cambios = selected.cambios || {};
    const keys = Object.keys(cambios).filter(campo => !debeIgnorarCampo(campo));

    if (keys.length === 0) {
      return (
        <div className="text-center text-muted py-4">
          Esta versión no tiene cambios detectados en los campos monitoreados.
        </div>
      );
    }

    const esCobertura = selected._esCobertura || false;
    const esAltaCoberturaDirecta = esCobertura && selected.accion === "create";
    const contadores = contarCambiosPorCategoria(cambios, {
      esCobertura: esCobertura || esAltaCoberturaDirecta,
    });
    const esMedioPago = selected._esMedioPago || false;
    const coberturaInfo = selected._coberturaInfo || {};
    const medioPagoInfo = selected._medioPagoInfo || {};
    
    const header = (
      <div className="card mb-3 border" style={{ backgroundColor: "#f8f9fa", marginBottom: "1rem" }}>
        <div className="card-body p-3">
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6">
              <div className="mb-3">
                <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  ID del Registro
                </small>
                <div className="text-dark fw-semibold">
                  <span className="badge bg-primary" style={{ fontSize: "0.9rem", padding: "0.4rem 0.8rem" }}>
                    #{selected.id || '—'}
                  </span>
                </div>
              </div>
              <div className="mb-3">
                <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Fecha
                </small>
                <div className="text-dark fw-semibold">{formatDateTime(selected.created_at)}</div>
              </div>
              <div>
                <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Usuario
                </small>
                <div className="text-dark fw-semibold">{selected.usuario}</div>
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div className="mb-3">
                <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Acción
                </small>
                <span
                  className={`badge ${
                    Object.keys(cambios).some((c) => esAltaCoberturaCampo(c)) || esAltaCoberturaDirecta
                      ? "bg-success"
                      : "bg-dark"
                  }`}
                >
                  {formatAccionHistorial(selected.accion, {
                    esAlta:
                      Object.keys(cambios).some((c) => esAltaCoberturaCampo(c)) ||
                      esAltaCoberturaDirecta,
                  })}
                </span>
              </div>
              <div className="mb-3">
                <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Modelo Afectado
                </small>
                <div className="text-dark fw-semibold">{formatModeloAfectado(selected.modelo_afectado)}</div>
              </div>
              <div>
                <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Total Cambios
                </small>
                <div className="text-dark fw-semibold">{selected.total_cambios ?? keys.length}</div>
              </div>
            </div>
          </div>
          
          {Array.isArray(selected.clientes_afectados) && selected.clientes_afectados.length > 0 && (
            <div className="row g-2 mt-3 pt-3 border-top" style={{ marginTop: "1rem", paddingTop: "1rem" }}>
              <div className="col-12">
                <small className="text-muted d-block mb-2" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Persona(s) afectada(s)
                </small>
                <div className="p-2 border rounded" style={{ backgroundColor: "#ffffff" }}>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    {selected.clientes_afectados.map((cliente, idx) => (
                      <span key={idx} className="badge bg-success text-white" style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
                        <i className="fas fa-user me-1"></i>
                        {cliente}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {Object.keys(cambios).some((campo) => esAltaCoberturaCampo(campo) && !debeIgnorarCampo(campo)) && (
            <div className="row g-2 mt-3" style={{ marginTop: "0.75rem" }}>
              <div className="col-12">
                <div
                  className="p-3 border rounded"
                  style={{ backgroundColor: "#d1e7dd", borderColor: "#badbcc" }}
                >
                  <div className="fw-semibold text-dark mb-1" style={{ fontSize: "0.9rem" }}>
                    Este registro incluye personas agregadas al grupo
                  </div>
                  <small className="text-muted">
                    Abre la pestaña <strong>Coberturas</strong> para ver quiénes se incorporaron.
                  </small>
                </div>
              </div>
            </div>
          )}
          
          {esCobertura && coberturaInfo && (
            <div className="row g-2 mt-3 pt-3 border-top" style={{ marginTop: "1rem", paddingTop: "1rem" }}>
              <div className="col-12">
                <small className="text-muted d-block mb-2" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Información de Cobertura
                </small>
                <div className="p-2 border rounded" style={{ backgroundColor: "#ffffff" }}>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <span className="badge bg-info text-dark">Cobertura #{selected._coberturaId}</span>
                    {coberturaInfo.cliente_nombre && (
                      <span className="text-dark fw-medium">{coberturaInfo.cliente_nombre}</span>
                    )}
                    {coberturaInfo.parentesco && (
                      <span className="badge bg-secondary">{coberturaInfo.parentesco}</span>
                    )}
                    {coberturaInfo.codigo_poliza && (
                      <span className="text-muted small">Póliza: {coberturaInfo.codigo_poliza}</span>
                    )}
                    {coberturaInfo.plan && (
                      <span className="text-muted small">Plan: {coberturaInfo.plan}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {isGrupo && (
            <>
              <div className="row g-2 mt-3 pt-3 border-top" style={{ marginTop: "1rem", paddingTop: "1rem" }}>
                <div className="col-12 mb-2">
                  <small className="text-muted" style={{ fontSize: "0.75rem", fontStyle: "italic" }}>
                    <i className="fas fa-info-circle me-1"></i>
                    Los números son cantidad de <strong>cambios</strong> en cada parte (no cuántas coberturas o personas hay)
                  </small>
                </div>
                {[
                  { key: "grupo", label: "Datos generales", count: contadores.grupo, color: "#2c3e50" },
                  { key: "coberturas", label: "Coberturas", count: contadores.coberturas, color: "#0d6efd" },
                  { key: "clientes", label: "Personas", count: contadores.clientes, color: "#198754" },
                ].map((area) => {
                  const isActive = viewMode === area.key;
                  const hasChanges = area.count > 0;
                  const cambiosLabel = area.count === 1 ? "cambio" : "cambios";
                  return (
                    <div className="col-4 text-center" key={area.key}>
                      <button
                        type="button"
                        className="w-100 border rounded p-2"
                        onClick={() => setViewMode(area.key)}
                        disabled={!hasChanges}
                        style={{
                          backgroundColor: "#ffffff",
                          borderColor: isActive ? area.color : "#dee2e6",
                          borderWidth: isActive ? "2px" : "1px",
                          boxShadow: isActive ? `0 0 0 1px ${area.color}33` : "none",
                          cursor: hasChanges ? "pointer" : "not-allowed",
                          opacity: hasChanges ? 1 : 0.55,
                        }}
                      >
                        <div
                          className="fw-bold"
                          style={{ fontSize: "1.25rem", color: isActive ? area.color : "#212529", lineHeight: 1.1 }}
                        >
                          {area.count}
                        </div>
                        <div
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            color: isActive ? area.color : "#495057",
                            marginBottom: "0.15rem",
                          }}
                        >
                          {cambiosLabel}
                        </div>
                        <small
                          style={{
                            fontSize: "0.7rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.4px",
                            color: isActive ? area.color : "#6c757d",
                            fontWeight: isActive ? 600 : 400,
                          }}
                        >
                          en {area.label}
                        </small>
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );

    if (!isGrupo || esMedioPago) {
      return (
        <>
          <div className="card mb-3 border" style={{ backgroundColor: "#f8f9fa" }}>
            <div className="card-body p-3">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <div className="mb-2">
                    <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      ID del Registro
                    </small>
                    <div className="text-dark fw-semibold">
                      <span className="badge bg-primary" style={{ fontSize: "0.9rem", padding: "0.4rem 0.8rem" }}>
                        #{selected.id || '—'}
                      </span>
                    </div>
                  </div>
                  <div className="mb-2">
                    <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Fecha
                    </small>
                    <div className="text-dark fw-semibold">{formatDateTime(selected.created_at)}</div>
                  </div>
                  <div>
                    <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Usuario
                    </small>
                    <div className="text-dark fw-semibold">{selected.usuario}</div>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <div className="mb-2">
                    <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Acción
                    </small>
                    <span className="badge bg-dark">{selected.accion}</span>
                  </div>
                  <div className="mb-2">
                    <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Modelo Afectado
                    </small>
                    <div className="text-dark fw-semibold">{formatModeloAfectado(selected.modelo_afectado)}</div>
                  </div>
                  <div>
                    <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Total Cambios
                    </small>
                    <div className="text-dark fw-semibold">{keys.length}</div>
                  </div>
                </div>
              </div>

              {esMedioPago && medioPagoInfo && (
                <div className="row g-2 mt-3 pt-3 border-top">
                  <div className="col-12">
                    <small className="text-muted d-block mb-2" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Cliente / Medio de Pago
                    </small>
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      {medioPagoInfo.cliente_nombre && (
                        <span className="badge bg-success text-white">{medioPagoInfo.cliente_nombre}</span>
                      )}
                      <span className="badge bg-warning text-dark">Medio #{selected._medioPagoId}</span>
                      {medioPagoInfo.forma_pago && (
                        <span className="text-muted small">{formatFormaPago(medioPagoInfo.forma_pago)}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
    
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle border">
              <thead style={{ backgroundColor: "#e9ecef" }}>
                <tr>
                  <th style={{ width: "25%", fontWeight: "600", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px", padding: "0.75rem" }}>
                    Campo
                  </th>
                  <th style={{ width: "37.5%", fontWeight: "600", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px", padding: "0.75rem" }}>
                    Anterior
                  </th>
                  <th style={{ width: "37.5%", fontWeight: "600", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px", padding: "0.75rem" }}>
                    Nuevo
                  </th>
                </tr>
              </thead>
              <tbody>
                {keys.map((campo) => {
                  const info = cambios[campo];
                  const label = getFieldLabel(campo);
                  return (
                    <tr key={campo}>
                      <td className="text-dark" style={{ padding: "0.75rem", verticalAlign: "top" }}>{label}</td>
                      <td style={{ padding: "0.75rem", verticalAlign: "top" }}>
                        <span className="text-muted" style={{ fontSize: "0.9rem", wordBreak: "break-word" }}>
                          {formatValueForHistorial(info.anterior, campo)}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", verticalAlign: "top" }}>
                        <span className="text-dark fw-semibold" style={{ fontSize: "0.9rem", wordBreak: "break-word" }}>
                          {formatValueForHistorial(info.nuevo, campo)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      );
    }
    
    const coberturaClientes = selected.cobertura_clientes || {};
    const coverageGroups = {};
    const grupoFields = [];
    const coberturasBlobFields = [];
    const coberturasDirectFields = [];
    const coberturasAltas = [];

    keys.forEach((campo) => {
      const matchAlta = campo.match(/^cobertura_(\d+)$/);
      if (matchAlta) {
        const coberturaId = matchAlta[1];
        coberturasAltas.push({
          campo,
          coberturaId,
          info: cambios[campo] || {},
          miembro: extraerInfoMiembroAgregado(
            cambios[campo],
            coberturaId,
            titularesPorCobertura,
            coberturaClientes
          ),
        });
        return;
      }

      const match = campo.match(/^cobertura_(\d+)\.(.+)$/);
      if (match) {
        const [, coberturaId, fieldKey] = match;
        if (!coverageGroups[coberturaId]) coverageGroups[coberturaId] = [];
        coverageGroups[coberturaId].push({ campo, fieldKey });
        return;
      }

      if (campo.startsWith("cliente.")) return;

      if (campo === "coberturas") {
        coberturasBlobFields.push(campo);
        return;
      }

      if (esCobertura) {
        coberturasDirectFields.push(campo);
        return;
      }

      grupoFields.push(campo);
    });

    const clientesAgrupados = agruparCambiosPorCliente(cambios, coverageGroups, coberturaClientes);

    const renderCampoRow = (campo, label, info, opts = {}) => (
      <tr key={campo}>
        <td
          className="text-dark"
          style={{
            padding: "0.75rem 1rem",
            paddingLeft: opts.indent || "1rem",
            verticalAlign: "top",
            fontSize: "0.9rem",
          }}
        >
          {label}
        </td>
        <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
          <span className="text-muted" style={{ fontSize: "0.9rem", wordBreak: "break-word" }}>
            {renderValorHistorial(info?.anterior, opts.fieldKey || campo)}
          </span>
        </td>
        <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
          <span className="text-dark fw-semibold" style={{ fontSize: "0.9rem", wordBreak: "break-word" }}>
            {renderValorHistorial(info?.nuevo, opts.fieldKey || campo)}
          </span>
        </td>
      </tr>
    );

    const renderSectionHeader = (title, subtitle, accent = "#2c3e50", badge = null) => (
      <tr key={`hdr-${title}-${subtitle || ""}`} style={{ backgroundColor: "#f8f9fa" }}>
        <td colSpan={3} className="py-2" style={{ padding: "0.75rem 1rem", borderLeft: `4px solid ${accent}` }}>
          <div className="d-flex align-items-center justify-content-between gap-2">
            <div>
              <strong className="text-dark" style={{ fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {title}
              </strong>
              {subtitle && (
                <span className="text-muted ms-2 fw-normal" style={{ textTransform: "none", fontSize: "0.85rem" }}>
                  – {subtitle}
                </span>
              )}
            </div>
            {badge != null && (
              <span className="badge bg-secondary" style={{ fontSize: "0.7rem" }}>
                {badge} {badge === 1 ? "cambio" : "cambios"}
              </span>
            )}
          </div>
        </td>
      </tr>
    );

    const renderEmptyArea = (mensaje) => (
      <tr>
        <td colSpan={3} className="text-center text-muted py-4">
          <i className="fas fa-info-circle me-2"></i>
          {mensaje}
        </td>
      </tr>
    );

    const renderGrupoRows = () => {
      if (grupoFields.length === 0) {
        return renderEmptyArea("No hay cambios en los datos generales del grupo familiar.");
      }

      return (
        <>
          {renderSectionHeader(
            "Datos generales",
            "Ingreso, personas en cobertura y demás datos compartidos",
            "#2c3e50",
            grupoFields.length
          )}
          {grupoFields.map((campo) =>
            renderCampoRow(campo, getFieldLabel(campo), cambios[campo] || {})
          )}
        </>
      );
    };

    const renderCoberturaOwnerHeader = (coberturaId, titular, numCambios) => {
      const nombre = titular?.nombre || `Cobertura #${coberturaId}`;
      const parentesco = titular?.parentesco;
      const meta = [
        parentesco,
        titular?.codigo_poliza ? `Póliza ${titular.codigo_poliza}` : null,
        titular?.plan ? `Plan ${titular.plan}` : null,
        `Cobertura #${coberturaId}`,
      ].filter(Boolean);

      return (
        <tr key={`hdr-cov-${coberturaId}`} style={{ backgroundColor: "#eef5ff" }}>
          <td colSpan={3} style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #0d6efd" }}>
            <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
              <div>
                <div
                  className="text-muted"
                  style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "0.15rem" }}
                >
                  Cobertura de
                </div>
                <div className="d-flex align-items-center flex-wrap gap-2">
                  <strong className="text-dark" style={{ fontSize: "1rem" }}>
                    {nombre}
                  </strong>
                  {parentesco && (
                    <span className="badge bg-secondary" style={{ fontSize: "0.75rem" }}>
                      {parentesco}
                    </span>
                  )}
                </div>
                <div className="text-muted mt-1" style={{ fontSize: "0.8rem" }}>
                  {meta.filter((m) => m !== parentesco).join(" · ")}
                </div>
              </div>
              {numCambios != null && (
                <span className="badge bg-primary" style={{ fontSize: "0.7rem" }}>
                  {numCambios} {numCambios === 1 ? "cambio" : "cambios"}
                </span>
              )}
            </div>
          </td>
        </tr>
      );
    };

    const renderCoberturasRows = () => {
      const coberturaIds = Object.keys(coverageGroups)
        .sort((a, b) => Number(a) - Number(b))
        .filter((coberturaId) =>
          coverageGroups[coberturaId].some((f) => !f.fieldKey.startsWith("cliente."))
        );

      const hasBlob = coberturasBlobFields.length > 0;
      const hasDirect = coberturasDirectFields.length > 0;
      const hasAltas = coberturasAltas.length > 0;
      if (!hasBlob && !hasDirect && !hasAltas && coberturaIds.length === 0) {
        return renderEmptyArea("No hay cambios en coberturas para este registro.");
      }

      const altaDirectaMiembro = esAltaCoberturaDirecta
        ? {
            coberturaId: selected._coberturaId || selected.modelo_id,
            nombre: coberturaInfo.cliente_nombre || selected.clientes_afectados?.[0] || `Cobertura #${selected._coberturaId || selected.modelo_id}`,
            parentesco: coberturaInfo.parentesco || null,
            codigoPoliza: coberturaInfo.codigo_poliza || null,
            plan: coberturaInfo.plan || null,
            estadoCobertura: null,
            anoCobertura: null,
          }
        : null;

      return (
        <>
          <tr>
            <td
              colSpan={3}
              className="py-3 px-3"
              style={{ backgroundColor: "#e7f1ff", borderLeft: "4px solid #0d6efd", padding: "0.75rem 1rem" }}
            >
              <small className="text-dark" style={{ fontSize: "0.8rem" }}>
                <i className="fas fa-info-circle me-2"></i>
                Aquí verás personas/coberturas <strong>agregadas</strong> al grupo y cambios en coberturas existentes.
              </small>
            </td>
          </tr>

          {(hasAltas || altaDirectaMiembro) && (
            <>
              <tr style={{ backgroundColor: "#d1e7dd" }}>
                <td colSpan={3} style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #198754" }}>
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                      <strong className="text-dark" style={{ fontSize: "0.9rem" }}>
                        {altaDirectaMiembro && !hasAltas
                          ? "Nueva cobertura agregada al grupo"
                          : "Personas agregadas al grupo"}
                      </strong>
                      <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                        {hasAltas
                          ? (coberturasAltas.length === 1
                            ? "Se incorporó 1 persona con su cobertura"
                            : `Se incorporaron ${coberturasAltas.length} personas con su cobertura`)
                          : "Esta cobertura se creó nueva en el grupo familiar"}
                      </div>
                    </div>
                    <span className="badge bg-success" style={{ fontSize: "0.75rem" }}>
                      {hasAltas
                        ? `${coberturasAltas.length} ${coberturasAltas.length === 1 ? "alta" : "altas"}`
                        : "Alta"}
                    </span>
                  </div>
                </td>
              </tr>

              {altaDirectaMiembro && !hasAltas && (
                <tr>
                  <td colSpan={3} style={{ padding: "0.85rem 1rem" }}>
                    <div
                      className="border rounded p-3"
                      style={{ backgroundColor: "#f8fff9", borderColor: "#badbcc" }}
                    >
                      <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
                        <div>
                          <div
                            className="text-success fw-semibold"
                            style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.4px" }}
                          >
                            Nueva cobertura / persona
                          </div>
                          <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                            <strong className="text-dark" style={{ fontSize: "1.05rem" }}>
                              {altaDirectaMiembro.nombre}
                            </strong>
                            {altaDirectaMiembro.parentesco && (
                              <span className="badge bg-secondary">{altaDirectaMiembro.parentesco}</span>
                            )}
                          </div>
                          <div className="text-muted mt-1" style={{ fontSize: "0.8rem" }}>
                            {[
                              `Cobertura #${altaDirectaMiembro.coberturaId}`,
                              altaDirectaMiembro.plan ? `Plan ${altaDirectaMiembro.plan}` : null,
                              altaDirectaMiembro.codigoPoliza ? `Póliza ${altaDirectaMiembro.codigoPoliza}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                        <span className="badge bg-success" style={{ fontSize: "0.75rem" }}>
                          Agregada
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {coberturasAltas.map(({ campo, coberturaId, miembro }) => (
                <tr key={campo}>
                  <td colSpan={3} style={{ padding: "0.85rem 1rem" }}>
                    <div
                      className="border rounded p-3"
                      style={{ backgroundColor: "#f8fff9", borderColor: "#badbcc" }}
                    >
                      <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
                        <div>
                          <div
                            className="text-success fw-semibold"
                            style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.4px" }}
                          >
                            Nueva persona en el grupo
                          </div>
                          <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                            <strong className="text-dark" style={{ fontSize: "1.05rem" }}>
                              {miembro.nombre}
                            </strong>
                            {miembro.parentesco && (
                              <span className="badge bg-secondary">{miembro.parentesco}</span>
                            )}
                          </div>
                          <div className="text-muted mt-1" style={{ fontSize: "0.8rem" }}>
                            {[
                              `Cobertura #${coberturaId}`,
                              miembro.anoCobertura ? `Año ${miembro.anoCobertura}` : null,
                              miembro.plan ? `Plan ${miembro.plan}` : null,
                              miembro.codigoPoliza ? `Póliza ${miembro.codigoPoliza}` : null,
                              miembro.estadoCobertura || null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                        <span className="badge bg-success" style={{ fontSize: "0.75rem" }}>
                          Agregada
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </>
          )}

          {hasDirect && (
            <>
              {renderCoberturaOwnerHeader(
                selected._coberturaId || selected.modelo_id,
                resolverTitularCobertura({
                  coberturaId: selected._coberturaId || selected.modelo_id,
                  cambios,
                  coverageFields: [],
                  coberturaClientes,
                  titularesGrupo: titularesPorCobertura,
                  clientesAfectados: selected.clientes_afectados,
                  coberturaInfo,
                }),
                coberturasDirectFields.length
              )}
              {coberturasDirectFields.map((campo) =>
                renderCampoRow(campo, getFieldLabel(campo), cambios[campo] || {}, { indent: "2rem" })
              )}
            </>
          )}

          {hasBlob &&
            coberturasBlobFields.map((campo) => {
              const info = cambios[campo] || {};
              return (
                <React.Fragment key={campo}>
                  {renderSectionHeader("Cambios en coberturas / miembros", null, "#0d6efd")}
                  <tr>
                    <td colSpan={3} className="pt-2 pb-3" style={{ padding: "0.75rem 1rem" }}>
                      {renderCoberturasDiffCell(info.anterior, info.nuevo)}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}

          {coberturaIds.map((coberturaId) => {
            const allFields = coverageGroups[coberturaId];
            const fieldsForCoverage = allFields.filter(
              (f) => !f.fieldKey.startsWith("cliente.")
            );

            const titular = resolverTitularCobertura({
              coberturaId,
              cambios,
              coverageFields: allFields,
              coberturaClientes,
              titularesGrupo: titularesPorCobertura,
              clientesAfectados: selected.clientes_afectados,
              coberturaInfo: selected._coberturaInfo,
            });

            return (
              <React.Fragment key={`cov-${coberturaId}`}>
                {renderCoberturaOwnerHeader(coberturaId, titular, fieldsForCoverage.length)}
                {fieldsForCoverage.map(({ campo, fieldKey }) =>
                  renderCampoRow(campo, getFieldLabel(fieldKey), cambios[campo] || {}, { indent: "2rem" })
                )}
              </React.Fragment>
            );
          })}
        </>
      );
    };

    const renderClientesRows = () => {
      const altasIds = new Set(coberturasAltas.map((a) => String(a.coberturaId)));
      if (esAltaCoberturaDirecta && (selected._coberturaId || selected.modelo_id)) {
        altasIds.add(String(selected._coberturaId || selected.modelo_id));
      }

      if (clientesAgrupados.length === 0 && coberturasAltas.length === 0 && !esAltaCoberturaDirecta) {
        return renderEmptyArea("No se encontraron cambios en datos de personas para este registro.");
      }

      return (
        <>
          <tr>
            <td
              colSpan={3}
              className="py-3 px-3"
              style={{ backgroundColor: "#e8f5e9", borderLeft: "4px solid #198754", padding: "0.75rem 1rem" }}
            >
              <small className="text-dark" style={{ fontSize: "0.8rem" }}>
                <i className="fas fa-info-circle me-2"></i>
                Si una persona es <strong>nueva en el grupo</strong>, verás la etiqueta verde{" "}
                <strong>Agregada</strong>. Los demás bloques son cambios sobre personas ya existentes.
              </small>
            </td>
          </tr>

          {coberturasAltas.map(({ campo, coberturaId, miembro }) => (
            <tr key={`alta-persona-${campo}`}>
              <td colSpan={3} style={{ padding: "0.75rem 1rem" }}>
                <div
                  className="border rounded p-3"
                  style={{ backgroundColor: "#f8fff9", borderColor: "#badbcc" }}
                >
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                      <div className="text-success fw-semibold" style={{ fontSize: "0.72rem", textTransform: "uppercase" }}>
                        Persona agregada al grupo
                      </div>
                      <strong className="text-dark" style={{ fontSize: "1rem" }}>
                        {miembro.nombre}
                      </strong>
                      {miembro.parentesco && (
                        <span className="badge bg-secondary ms-2">{miembro.parentesco}</span>
                      )}
                      <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                        Nueva cobertura #{coberturaId}
                      </div>
                    </div>
                    <span className="badge bg-success">Agregada</span>
                  </div>
                </div>
              </td>
            </tr>
          ))}

          {clientesAgrupados.map((clienteData) => {
            const secciones = agruparCambiosPorSeccionCliente(clienteData.cambios);
            const numCambios = clienteData.cambios.length;
            const esNueva = clienteData.coberturaId && altasIds.has(String(clienteData.coberturaId));

            return (
              <React.Fragment key={clienteData.key}>
                <tr style={{ backgroundColor: esNueva ? "#d1e7dd" : "#f8f9fa" }}>
                  <td
                    colSpan={3}
                    className="py-2"
                    style={{
                      padding: "0.75rem 1rem",
                      borderLeft: `4px solid ${esNueva ? "#198754" : "#198754"}`,
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                      <div>
                        <strong className="text-dark" style={{ fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {clienteData.nombre || "Persona sin nombre"}
                        </strong>
                        {clienteData.coberturaId && (
                          <span className="text-muted ms-2 fw-normal" style={{ textTransform: "none", fontSize: "0.85rem" }}>
                            – Su cobertura #{clienteData.coberturaId}
                          </span>
                        )}
                        {esNueva && (
                          <span className="badge bg-success ms-2" style={{ fontSize: "0.7rem" }}>
                            Agregada
                          </span>
                        )}
                      </div>
                      <span className="badge bg-secondary" style={{ fontSize: "0.7rem" }}>
                        {numCambios} {numCambios === 1 ? "cambio" : "cambios"}
                      </span>
                    </div>
                  </td>
                </tr>

                {secciones.map((bloque) => (
                  <React.Fragment key={`${clienteData.key}-${bloque.id}`}>
                    <tr style={{ backgroundColor: "#f1f8f4" }}>
                      <td colSpan={3} style={{ padding: "0.5rem 1rem 0.5rem 1.75rem" }}>
                        <span
                          className="text-dark fw-semibold"
                          style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.4px" }}
                        >
                          {bloque.label}
                        </span>
                        <span className="badge bg-light text-dark border ms-2" style={{ fontSize: "0.7rem" }}>
                          {bloque.cambios.length}
                        </span>
                      </td>
                    </tr>
                    {bloque.cambios.map(({ campo, fieldKey, info }) =>
                      renderCampoRow(campo, getFieldLabel(fieldKey), info, {
                        indent: "2.5rem",
                        fieldKey,
                      })
                    )}
                  </React.Fragment>
                ))}
              </React.Fragment>
            );
          })}
        </>
      );
    };

    return (
      <>
        {header}

        <div className="mb-3">
          <div className="btn-group w-100" role="group">
            {[
              { key: "grupo", label: "Datos generales", count: contadores.grupo },
              { key: "coberturas", label: "Coberturas", count: contadores.coberturas },
              { key: "clientes", label: "Personas", count: contadores.clientes },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`btn ${viewMode === tab.key ? "btn-dark" : "btn-outline-dark"}`}
                onClick={() => setViewMode(tab.key)}
                disabled={tab.count === 0}
                style={{
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  padding: "0.5rem 1rem",
                  opacity: tab.count === 0 ? 0.5 : 1,
                }}
              >
                {tab.label}
                <span
                  className={`badge ms-2 ${viewMode === tab.key ? "bg-light text-dark" : "bg-secondary"}`}
                  style={{ fontSize: "0.7rem", fontWeight: 600 }}
                >
                  {tab.count} {tab.count === 1 ? "cambio" : "cambios"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle border mb-0">
            <thead style={{ backgroundColor: "#e9ecef" }}>
              <tr>
                <th style={{ width: "25%", fontWeight: "600", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px", padding: "0.75rem" }}>
                  Campo
                </th>
                <th style={{ width: "37.5%", fontWeight: "600", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px", padding: "0.75rem" }}>
                  Anterior
                </th>
                <th style={{ width: "37.5%", fontWeight: "600", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px", padding: "0.75rem" }}>
                  Nuevo
                </th>
              </tr>
            </thead>
            <tbody>
              {viewMode === "grupo" && renderGrupoRows()}
              {viewMode === "coberturas" && renderCoberturasRows()}
              {viewMode === "clientes" && renderClientesRows()}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  // Compacto solo fuera del hub (p. ej. ficha del cliente). El hub mantiene un único espacio modal.
  const dialogCompacto = filtrarPorSeccion && !hubActivo;

  return (
    <>
      <div
        className="modal fade show gf-modal"
        tabIndex="-1"
        role="dialog"
        aria-modal={atraparFoco ? "true" : undefined}
        aria-labelledby="historial-cambios-titulo"
        style={{ display: "block", zIndex: 1060 }}
      >
        <div
          ref={dialogRef}
          className={`modal-dialog modal-dialog-centered gf-modal ${dialogCompacto ? "modal-lg" : "modal-xl gf-modal--xl"}`}
          role="document"
          style={dialogCompacto ? {
            maxWidth: "min(1480px, calc(100vw - 2rem))",
            width: "min(1480px, calc(100vw - 2rem))",
            margin: "0.75rem auto",
            maxHeight: "calc(100vh - 1.5rem)",
          } : {
            maxWidth: "min(1800px, 98vw)",
            width: "98vw",
            margin: "0.75rem auto",
            height: "calc(100vh - 1.5rem)",
            maxHeight: "calc(100vh - 1.5rem)",
          }}
        >
          <div
            className="modal-content gf-modal__content"
            style={{
              height: dialogCompacto ? "auto" : "100%",
              maxHeight: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="modal-header gf-modal__header" style={{ flexShrink: 0 }}>
              <div className="min-w-0 me-2 flex-grow-1">
                <h5 id="historial-cambios-titulo" className="modal-title gf-modal__title">
                  {tituloModal}
                  {isGrupo && !filtrarPorSeccion && !mostrarListaHub && (
                    <span className="badge bg-light text-dark ms-2" style={{ fontSize: "0.75rem", fontWeight: "500" }}>
                      Grupo Familiar
                    </span>
                  )}
                </h5>
                {subtituloModal && (
                  <p className="gf-modal__subtitle mb-0">
                    {subtituloModal}
                  </p>
                )}
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                className="btn-close btn-close-white flex-shrink-0"
                aria-label={atraparFoco ? "Cerrar historial" : "Close"}
                onClick={onClose}
                style={{ margin: 0 }}
              />
            </div>

            <div
              className="modal-body"
              style={dialogCompacto ? {
                padding: "1rem",
                overflowY: "auto",
              } : filtrarPorSeccion ? {
                padding: "1.25rem 1.5rem",
                flex: "1 1 auto",
                minHeight: 0,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
              } : {
                padding: "1.25rem 1.5rem",
                flex: "1 1 auto",
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {mostrarDetalleHub && (
                <div className="mb-3 flex-shrink-0">
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-decoration-none px-0"
                    onClick={volverAListaHub}
                  >
                    ← Volver a coberturas
                  </button>
                </div>
              )}

              {mostrarListaHub ? (
                renderListaCoberturasHub()
              ) : filtrarPorSeccion ? (
                vistaHistorialSeccion({
                  cargando: cargandoSeccion,
                  error: errorSeccion,
                  filas: filasSeccion,
                  filtroCampo,
                  filtroTexto,
                  fechaDesde,
                  fechaHasta,
                  onDesde: setFechaDesde,
                  onHasta: setFechaHasta,
                  onCampo: setFiltroCampo,
                  onTexto: setFiltroTexto,
                  onLimpiar: () => {
                    setFiltroCampo("");
                    setFiltroTexto("");
                    setFechaDesde("");
                    setFechaHasta("");
                  },
                  pagina: paginaHistorial,
                  onPagina: setPaginaHistorial,
                })
              ) : (
              <>
              {loading && (
                <div className="d-flex justify-content-center py-4">
                  <div className="spinner-border" role="status">
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="alert alert-danger mb-3">{error}</div>
              )}

              {!loading && !error && historial.length === 0 && (
                <div className="text-muted text-center py-3">
                  No hay cambios registrados para este grupo familiar.
                </div>
              )}

              {!loading && !error && historial.length > 0 && (
                <div
                  className="row g-3"
                  style={{ flex: "1 1 auto", minHeight: 0, margin: 0 }}
                >
                  <div
                    className="col-12 col-xl-4 mb-3 mb-xl-0 d-flex flex-column ps-0 pe-xl-2"
                    style={{ minHeight: 0, maxHeight: "100%" }}
                  >
                    <div className="table-responsive flex-grow-1 border rounded" style={{ minHeight: 0, overflowY: "auto" }}>
                      <table className="table table-sm table-hover align-middle mb-0">
                        <thead className="table-light sticky-top">
                          <tr>
                            <th style={{ padding: "0.75rem 0.5rem", width: "80px" }}>ID</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Fecha</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Usuario</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Acción</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Persona(s)</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Cambios</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historial.map((row) => {
                            const cambiosFiltrados = Object.keys(row.cambios || {}).filter(
                              campo => !debeIgnorarCampo(campo)
                            );
                            const altasCount = cambiosFiltrados.filter((campo) =>
                              esAltaCoberturaCampo(campo)
                            ).length;
                            const totalCambios = cambiosFiltrados.length;
                            const isActive = selected && selected.id === row.id && (selected._esMedioPago || false) === (row._esMedioPago || false) && (selected._esCobertura || false) === (row._esCobertura || false);
                            const esCobertura = row._esCobertura || false;
                            const esMedioPago = row._esMedioPago || false;
                            const coberturaInfo = row._coberturaInfo || {};
                            const medioPagoInfo = row._medioPagoInfo || {};
                            const clientesAfectados = Array.isArray(row.clientes_afectados) ? row.clientes_afectados : [];
                            const esAltaFila = altasCount > 0 || (esCobertura && row.accion === "create");
                            const personasMostrar = clientesAfectados.length > 0
                              ? clientesAfectados
                              : [
                                  esMedioPago ? medioPagoInfo.cliente_nombre : null,
                                  esCobertura ? coberturaInfo.cliente_nombre : null,
                                ].filter(Boolean);

                            return (
                              <tr
                                key={`${row.id}-${esCobertura ? row._coberturaId : ''}-${esMedioPago ? row._medioPagoId : ''}`}
                                className={isActive ? "table-primary" : ""}
                                style={{
                                  cursor: "pointer",
                                  borderLeft: esAltaFila ? "4px solid #198754" : undefined,
                                }}
                                onClick={() => setSelected(row)}
                              >
                                <td style={{ padding: "0.75rem 0.5rem" }}>
                                  <span className="text-muted fw-semibold" style={{ fontSize: "0.85rem" }}>
                                    #{row.id || '—'}
                                  </span>
                                </td>
                                <td style={{ padding: "0.75rem 0.5rem" }}>{formatDateTime(row.created_at)}</td>
                                <td style={{ padding: "0.75rem 0.5rem" }}>{row.usuario}</td>
                                <td style={{ padding: "0.75rem 0.5rem" }}>
                                  <span className={`badge ${esAltaFila ? "bg-success" : "bg-secondary"}`}>
                                    {formatAccionHistorial(row.accion, { esAlta: esAltaFila })}
                                  </span>
                                </td>
                                <td style={{ padding: "0.75rem 0.5rem" }}>
                                  {personasMostrar.length > 0 ? (
                                    <div className="small">
                                      {personasMostrar.map((cliente, idx) => (
                                        <div
                                          key={idx}
                                          className="text-dark"
                                          style={{
                                            fontSize: "0.85rem",
                                            marginBottom: idx < personasMostrar.length - 1 ? "0.25rem" : "0",
                                          }}
                                        >
                                          {cliente}
                                          {esCobertura && coberturaInfo.parentesco && idx === 0 && (
                                            <span className="text-muted ms-1" style={{ fontSize: "0.75rem" }}>
                                              ({coberturaInfo.parentesco})
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted" style={{ fontSize: "0.85rem" }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: "0.75rem 0.5rem" }}>
                                  {totalCambios > 0 ? (
                                    <div>
                                      <div style={{ fontSize: "0.85rem" }}>
                                        {totalCambios} cambio(s)
                                      </div>
                                      {altasCount > 0 && (
                                        <span className="badge bg-success mt-1" style={{ fontSize: "0.7rem" }}>
                                          {altasCount} {altasCount === 1 ? "persona agregada" : "personas agregadas"}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="border rounded p-2 mt-3" style={{ backgroundColor: "#f8f9fa", flexShrink: 0 }}>
                      <small className="text-muted" style={{ fontSize: "0.8rem" }}>
                        Los contadores indican <strong>cambios</strong> en cada parte:{" "}
                        <strong>Datos generales</strong>, <strong>Coberturas</strong> o <strong>Personas</strong>.
                      </small>
                    </div>
                  </div>

                  <div
                    className="col-12 col-xl-8 d-flex flex-column pe-0 ps-xl-2"
                    style={{ minHeight: 0, maxHeight: "100%" }}
                  >
                    <div
                      className="border rounded p-3 bg-white"
                      style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}
                    >
                      {renderDetalleCambios()}
                    </div>
                  </div>
                </div>
              )}
              </>
              )}
            </div>

            <div className="modal-footer gf-modal__footer" style={{ flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        style={{ cursor: "pointer", zIndex: 1050 }}
      />
    </>
  );
}
