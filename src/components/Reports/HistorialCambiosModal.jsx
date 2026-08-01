// src/components/Historial/HistorialCambiosModal.jsx
// ✅ MODAL DE SOLO LECTURA: Este componente solo muestra el historial de cambios.
// NO realiza actualizaciones al backend. Todas las actualizaciones se realizan
// a través del botón "Guardar" del grupo familiar en GrupoFamiliarDetail.jsx
import React, { useEffect, useState } from "react";
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
    fields: new Set(CLIENTE_FIELDS_PRINCIPALES.map(([key]) => key)),
  },
  {
    id: "migratorio",
    label: "Status migratorio",
    fields: new Set([
      ...CLIENTE_FIELDS_MIGRATORIO.map(([key]) => key),
      "ssn",
    ]),
  },
  {
    id: "direccion",
    label: "Dirección",
    fields: new Set([
      ...CLIENTE_FIELDS_DIRECCION.map(([key]) => key),
      "direccion_completa",
      "estado_direccion",
      "zip_code",
    ]),
  },
  {
    id: "contacto",
    label: "Contacto",
    fields: new Set([
      ...CLIENTE_FIELDS_CONTACTO.map(([key]) => key),
      "telefonos",
    ]),
  },
  {
    id: "empleo",
    label: "Empleo e ingreso",
    fields: new Set(CLIENTE_FIELDS_EMPLEO.map(([key]) => key)),
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
  if (campo === "es_principal") {
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

// ==================== COMPONENTE PRINCIPAL ====================

export default function HistorialCambiosModal({
  show,
  onClose,
  modelo = "GrupoFamiliar",
  modeloId,
}) {
  const [historial, setHistorial] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("grupo");
  const [titularesPorCobertura, setTitularesPorCobertura] = useState({});

  const isGrupo = modelo === "GrupoFamiliar";

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

  // Cargar historial
  useEffect(() => {
    if (!show || !modeloId) return;

    const fetchHistorial = async () => {
      setLoading(true);
      setError(null);

      try {
        // Obtener historial del modelo principal
        const res = await apiRequest(`/historial/${modelo}/${modeloId}`, "GET");
        let rows = Array.isArray(res.data) ? res.data : [];
        
        // Si es GrupoFamiliar, obtener también historial de coberturas
        if (isGrupo && modeloId) {
          const grupoData = await GrupoFamiliarService.getFullById(modeloId);
          const coberturasGrupo = Array.isArray(grupoData?.coberturas) ? grupoData.coberturas : [];
          setTitularesPorCobertura(buildTitularesDesdeCoberturas(coberturasGrupo));

          const [registrosCoberturas, registrosMediosPago] = await Promise.all([
            obtenerHistorialCoberturas(coberturasGrupo),
            obtenerHistorialMediosPago(grupoData),
          ]);
          rows = [...rows, ...registrosCoberturas, ...registrosMediosPago];
          
          rows.sort((a, b) => {
            const fechaA = new Date(a.created_at || a.fecha || 0).getTime();
            const fechaB = new Date(b.created_at || b.fecha || 0).getTime();
            return fechaB - fechaA;
          });
        } else if (modelo === "Cliente" && modeloId) {
          setTitularesPorCobertura({});
          const registrosMediosPago = await obtenerHistorialMediosPago(null, modeloId);
          rows = [...rows, ...registrosMediosPago];
          rows.sort((a, b) => {
            const fechaA = new Date(a.created_at || a.fecha || 0).getTime();
            const fechaB = new Date(b.created_at || b.fecha || 0).getTime();
            return fechaB - fechaA;
          });
        } else {
          setTitularesPorCobertura({});
        }
        
        const historialFiltrado = filtrarRegistrosRelevantes(rows);
        setHistorial(historialFiltrado);
        setSelected(historialFiltrado.length > 0 ? historialFiltrado[0] : null);
      } catch (e) {
        console.error("Error cargando historial:", e);
        setError("No se pudo cargar el historial de cambios.");
        setSelected(null);
      } finally {
        setLoading(false);
      }
    };

    fetchHistorial();
  }, [show, modelo, modeloId, isGrupo]);

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

  if (!show) return null;

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

                {secciones.map((seccion) => (
                  <React.Fragment key={`${clienteData.key}-${seccion.id}`}>
                    <tr style={{ backgroundColor: "#f1f8f4" }}>
                      <td colSpan={3} style={{ padding: "0.5rem 1rem 0.5rem 1.75rem" }}>
                        <span
                          className="text-dark fw-semibold"
                          style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.4px" }}
                        >
                          {seccion.label}
                        </span>
                        <span className="badge bg-light text-dark border ms-2" style={{ fontSize: "0.7rem" }}>
                          {seccion.cambios.length}
                        </span>
                      </td>
                    </tr>
                    {seccion.cambios.map(({ campo, fieldKey, info }) =>
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

  return (
    <>
      <div
        className="modal fade show"
        tabIndex="-1"
        role="dialog"
        style={{ display: "block", zIndex: 1060 }}
      >
        <div
          className="modal-dialog modal-xl modal-dialog-centered"
          role="document"
          style={{
            maxWidth: "min(1800px, 98vw)",
            width: "98vw",
            margin: "0.75rem auto",
            height: "calc(100vh - 1.5rem)",
            maxHeight: "calc(100vh - 1.5rem)",
          }}
        >
          <div
            className="modal-content"
            style={{
              border: "none",
              boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
              height: "100%",
              maxHeight: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="modal-header border-bottom" style={{ backgroundColor: "#2c3e50", color: "#ffffff", padding: "0.85rem 1.5rem", flexShrink: 0 }}>
              <h5 className="modal-title" style={{ fontWeight: "600", fontSize: "1.1rem", margin: 0 }}>
                Historial de Cambios
                {isGrupo && (
                  <span className="badge bg-light text-dark ms-2" style={{ fontSize: "0.75rem", fontWeight: "500" }}>
                    Grupo Familiar
                  </span>
                )}
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                aria-label="Close"
                onClick={onClose}
                style={{ margin: 0 }}
              />
            </div>

            <div
              className="modal-body"
              style={{
                padding: "1.25rem 1.5rem",
                flex: "1 1 auto",
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
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
            </div>

            <div className="modal-footer border-top" style={{ padding: "0.75rem 1.5rem", flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-dark btn-sm"
                onClick={onClose}
                style={{ minWidth: "100px", fontWeight: "500", padding: "0.5rem 1rem" }}
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
