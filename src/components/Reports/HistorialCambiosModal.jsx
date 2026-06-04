// src/components/Historial/HistorialCambiosModal.jsx
// ✅ MODAL DE SOLO LECTURA: Este componente solo muestra el historial de cambios.
// NO realiza actualizaciones al backend. Todas las actualizaciones se realizan
// a través del botón "Guardar" del grupo familiar en GrupoFamiliarDetail.jsx
import React, { useEffect, useState } from "react";
import apiRequest from "../../services/api";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import { formatDateTimeForDisplay } from "../../utils/formatters";

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
  nombre_completo: "Nombre completo",
  primer_nombre: "Primer nombre",
  segundo_nombre: "Segundo nombre",
  apellidos: "Apellidos",
  telefono: "Teléfono",
  email: "Email",
  fecha_nacimiento: "Fecha de nacimiento",
  ssn: "SSN",
  estado: "Estado",
  direccion: "Dirección",
  direccion_completa: "Dirección completa",
  calle: "Calle",
  ciudad: "Ciudad",
  estado_direccion: "Estado (dirección)",
  codigo_postal: "Código postal",
  zip_code: "ZIP Code",
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
  // Si el campo está directamente en FIELD_LABELS, retornarlo
  if (FIELD_LABELS[fieldKey]) return FIELD_LABELS[fieldKey];
  
  // Si es un campo de cliente (cliente.*)
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
          <div className="d-flex align-items-center mb-2" style={{ marginBottom: "0.5rem" }}>
            {item.parentesco && (
              <span className="badge bg-secondary me-2" style={{ fontSize: "0.75rem", marginRight: "0.5rem" }}>
                {item.parentesco}
              </span>
            )}
            <strong className="text-dark" style={{ wordBreak: "break-word" }}>{item.nombreNuevo}</strong>
          </div>
          <div className="ms-3" style={{ marginLeft: "1rem" }}>
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
  const [expandedClientes, setExpandedClientes] = useState(new Set());

  const isGrupo = modelo === "GrupoFamiliar";

  const toggleCliente = (clienteKey) => {
    setExpandedClientes((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(clienteKey)) {
        newExpanded.delete(clienteKey);
      } else {
        newExpanded.add(clienteKey);
      }
      return newExpanded;
    });
  };

  // Obtener historial de coberturas relacionadas
  const obtenerHistorialCoberturas = async (grupoId) => {
    try {
      const grupoData = await GrupoFamiliarService.getFullById(grupoId);
      const coberturas = Array.isArray(grupoData?.coberturas) ? grupoData.coberturas : [];
      
      const historialesCoberturas = await Promise.all(
        coberturas
          .filter(cob => cob?.id)
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
  const contarCambiosPorCategoria = (cambios) => {
    // Filtrar campos ignorados (incluyendo fechas de actualización)
    const keys = Object.keys(cambios || {}).filter(campo => !debeIgnorarCampo(campo));
    let grupo = 0;
    let coberturas = 0;
    let clientes = 0;

    keys.forEach((campo) => {
      if (campo === "coberturas") {
        coberturas++;
      } else if (campo.startsWith("cliente.")) {
        clientes++;
      } else if (campo.match(/^cobertura_\d+\.cliente\./)) {
        clientes++;
      } else if (campo.match(/^cobertura_\d+\./)) {
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
            clienteNombre = coberturaClientes[coberturaId];
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
              clienteNombre = coberturaClientes[coberturaId];
            }
            if (!clienteNombre) {
              clienteNombre = `Cliente Cobertura ${coberturaId}`;
            }
          } else {
            // Si no hay campos de nombre, intentar usar coberturaClientes, sino usar ID
            clienteNombre = (coberturaClientes && coberturaClientes[coberturaId]) || `Cliente Cobertura ${coberturaId}`;
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
          const registrosCoberturas = await obtenerHistorialCoberturas(modeloId);
          rows = [...rows, ...registrosCoberturas];
          
          // Ordenar por fecha (más reciente primero)
          rows.sort((a, b) => {
            const fechaA = new Date(a.created_at || a.fecha || 0).getTime();
            const fechaB = new Date(b.created_at || b.fecha || 0).getTime();
            return fechaB - fechaA;
          });
        }
        
        const historialFiltrado = filtrarRegistrosRelevantes(rows);
        setHistorial(historialFiltrado);
        setSelected(historialFiltrado.length > 0 ? historialFiltrado[0] : null);
        setExpandedClientes(new Set());
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

  useEffect(() => {
    setExpandedClientes(new Set());
  }, [selected?.id]);

  // Auto-seleccionar vista de clientes
  useEffect(() => {
    if (selected && selected.cambios) {
      const contadores = contarCambiosPorCategoria(selected.cambios);
      const coberturaClientes = selected.cobertura_clientes || {};
      const coverageGroups = {};
      const keys = Object.keys(selected.cambios || {}).filter(campo => !debeIgnorarCampo(campo));
      
      keys.forEach((campo) => {
        const match = campo.match(/^cobertura_(\d+)\.(.+)$/);
        if (match) {
          const [, coberturaId] = match;
          if (!coverageGroups[coberturaId]) coverageGroups[coberturaId] = [];
        }
      });
      
      const clientesAgrupados = agruparCambiosPorCliente(selected.cambios, coverageGroups, coberturaClientes);
      
      if (clientesAgrupados.length > 0 && contadores.grupo === 0 && contadores.coberturas === 0) {
        setViewMode("clientes");
      }
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

    const contadores = contarCambiosPorCategoria(cambios);
    const esCobertura = selected._esCobertura || false;
    const coberturaInfo = selected._coberturaInfo || {};
    
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
                <span className="badge bg-dark">{selected.accion}</span>
              </div>
              <div className="mb-3">
                <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Modelo Afectado
                </small>
                <div className="text-dark fw-semibold">{selected.modelo_afectado || '—'}</div>
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
                  Cliente(s) Afectado(s)
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
                    Los números indican la cantidad de cambios realizados en cada área
                  </small>
                </div>
                <div className="col-4 text-center">
                  <div className="p-2 border rounded" style={{ backgroundColor: "#ffffff" }}>
                    <div className="fw-bold text-dark" style={{ fontSize: "1.25rem" }}>{contadores.grupo}</div>
                    <small className="text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Grupo
                    </small>
                  </div>
                </div>
                <div className="col-4 text-center">
                  <div className="p-2 border rounded" style={{ backgroundColor: "#ffffff" }}>
                    <div className="fw-bold text-dark" style={{ fontSize: "1.25rem" }}>{contadores.coberturas}</div>
                    <small className="text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Coberturas
                    </small>
                  </div>
                </div>
                <div className="col-4 text-center">
                  <div className="p-2 border rounded" style={{ backgroundColor: "#ffffff" }}>
                    <div className="fw-bold text-dark" style={{ fontSize: "1.25rem" }}>{contadores.clientes}</div>
                    <small className="text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Clientes
                    </small>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );

    if (!isGrupo) {
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
                    <div className="text-dark fw-semibold">{selected.modelo_afectado || '—'}</div>
                  </div>
                  <div>
                    <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Total Cambios
                    </small>
                    <div className="text-dark fw-semibold">{keys.length}</div>
                  </div>
                </div>
              </div>
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
                          {formatValue(info.anterior)}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", verticalAlign: "top" }}>
                        <span className="text-dark fw-semibold" style={{ fontSize: "0.9rem", wordBreak: "break-word" }}>
                          {formatValue(info.nuevo)}
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
    
    const coverageGroups = {};
    const normalFields = [];

    keys.forEach((campo) => {
      const match = campo.match(/^cobertura_(\d+)\.(.+)$/);
      if (match) {
        const [, coberturaId, fieldKey] = match;
        if (!coverageGroups[coberturaId]) coverageGroups[coberturaId] = [];
        coverageGroups[coberturaId].push({ campo, fieldKey });
      } else {
        normalFields.push(campo);
      }
    });

    const coberturaClientes = selected.cobertura_clientes || {};
    const clientesAgrupados = agruparCambiosPorCliente(cambios, coverageGroups, coberturaClientes);

    return (
      <>
        {header}

        <div className="mb-3">
          <div className="btn-group w-100" role="group">
            <button
              type="button"
              className={`btn ${viewMode === "grupo" ? "btn-dark" : "btn-outline-dark"}`}
              onClick={() => setViewMode("grupo")}
              style={{ fontSize: "0.875rem", fontWeight: "500", padding: "0.5rem 1rem" }}
            >
              Grupo / Coberturas
              {contadores.grupo + contadores.coberturas > 0 && (
                <span className="badge bg-secondary ms-2" style={{ fontSize: "0.75rem" }}>
                  {contadores.grupo + contadores.coberturas}
                </span>
              )}
            </button>
            <button
              type="button"
              className={`btn ${viewMode === "clientes" ? "btn-dark" : "btn-outline-dark"}`}
              onClick={() => setViewMode("clientes")}
              style={{ fontSize: "0.875rem", fontWeight: "500", padding: "0.5rem 1rem" }}
            >
              Clientes
              {clientesAgrupados.length > 0 && (
                <span className="badge bg-secondary ms-2" style={{ fontSize: "0.75rem" }}>
                  {clientesAgrupados.length}
                </span>
              )}
            </button>
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
              {viewMode === "clientes" ? (
                clientesAgrupados.length > 0 ? (
                  <>
                    {clientesAgrupados.length > 0 && (
                      <tr>
                        <td colSpan={3} className="py-3 px-3" style={{ backgroundColor: "#e7f3ff", borderLeft: "4px solid #0066cc", padding: "0.75rem 1rem" }}>
                          <small className="text-dark" style={{ fontSize: "0.8rem" }}>
                            <i className="fas fa-info-circle me-2"></i>
                            <strong>{clientesAgrupados.length}</strong> {clientesAgrupados.length === 1 ? "cliente" : "clientes"} {clientesAgrupados.length === 1 ? "tiene" : "tienen"} cambios. 
                            Haz clic en el nombre del cliente para ver los detalles.
                          </small>
                        </td>
                      </tr>
                    )}
                    {clientesAgrupados.map((clienteData) => {
                      const isExpanded = expandedClientes.has(clienteData.key);
                      const numCambios = clienteData.cambios.length;

                      return (
                        <React.Fragment key={clienteData.key}>
                          <tr
                            style={{
                              backgroundColor: isExpanded ? "#e9ecef" : "#ffffff",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                              borderLeft: isExpanded ? "4px solid #2c3e50" : "4px solid transparent",
                            }}
                            onClick={() => toggleCliente(clienteData.key)}
                            onMouseEnter={(e) => {
                              if (!isExpanded) {
                                e.currentTarget.style.backgroundColor = "#f8f9fa";
                                e.currentTarget.style.borderLeft = "4px solid #6c757d";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isExpanded) {
                                e.currentTarget.style.backgroundColor = "#ffffff";
                                e.currentTarget.style.borderLeft = "4px solid transparent";
                              }
                            }}
                          >
                            <td colSpan={3} className="py-3 px-3" style={{ padding: "0.75rem 1rem" }}>
                              <div className="d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center">
                                  <span
                                    className="me-3"
                                    style={{
                                      fontSize: "0.85rem",
                                      transition: "transform 0.2s",
                                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                      display: "inline-block",
                                      color: "#495057",
                                      fontWeight: "600",
                                      minWidth: "20px",
                                    }}
                                  >
                                    ▶
                                  </span>
                                  <div>
                                    <strong className="text-dark" style={{ fontSize: "0.95rem", display: "block", fontWeight: "600", marginBottom: "0.25rem" }}>
                                      {clienteData.nombre || "Cliente sin nombre"}
                                    </strong>
                                    {clienteData.coberturaId && (
                                      <small className="text-muted" style={{ fontSize: "0.75rem" }}>
                                        <i className="fas fa-shield-alt me-1"></i>
                                        Cobertura #{clienteData.coberturaId}
                                      </small>
                                    )}
                                  </div>
                                </div>
                                <span className="badge bg-dark" style={{ fontSize: "0.75rem", fontWeight: "500", padding: "0.4rem 0.6rem", marginLeft: "1rem" }}>
                                  {numCambios} {numCambios === 1 ? "cambio" : "cambios"}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <>
                              {clienteData.cambios.map(({ campo, fieldKey, info }) => {
                                const niceLabel = getFieldLabel(fieldKey);
                                return (
                                  <tr key={campo} style={{ backgroundColor: "#ffffff", borderLeft: "3px solid #2c3e50" }}>
                                    <td className="ps-5 text-dark fw-medium" style={{ fontSize: "0.9rem", padding: "0.75rem 1rem", paddingLeft: "3rem", verticalAlign: "top" }}>{niceLabel}</td>
                                    <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                                      <span className="text-muted" style={{ fontSize: "0.9rem", wordBreak: "break-word" }}>
                                        {formatValue(info.anterior)}
                                      </span>
                                    </td>
                                    <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                                      <span className="text-dark fw-semibold" style={{ fontSize: "0.9rem", wordBreak: "break-word" }}>
                                        {formatValue(info.nuevo)}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </>
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-4">
                      <div>
                        <i className="fas fa-info-circle me-2"></i>
                        No se encontraron cambios en los datos de clientes para este registro.
                      </div>
                    </td>
                  </tr>
                )
              ) : (
                <>
                  {normalFields.length === 0 && viewMode === "grupo" && clientesAgrupados.length > 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-4">
                        <div className="alert alert-info mb-0" style={{ backgroundColor: "#e7f3ff", border: "1px solid #b3d9ff", color: "#004085" }}>
                          <i className="fas fa-info-circle me-2"></i>
                          <strong>Este registro solo contiene cambios en clientes.</strong>
                          <br />
                          <small>Cambia a la pestaña <strong>"Clientes"</strong> para ver los detalles de los cambios.</small>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    normalFields.map((campo) => {
                      const info = cambios[campo] || {};
                      const label = getFieldLabel(campo);
                      const isClienteField = campo.startsWith("cliente.");

                      if (viewMode === "grupo" && isClienteField) return null;

                      if (campo === "coberturas") {
                        if (viewMode === "clientes") return null;
                        return (
                          <React.Fragment key={campo}>
                            <tr style={{ backgroundColor: "#f8f9fa" }}>
                              <td colSpan={3} className="py-2" style={{ padding: "0.75rem 1rem" }}>
                                <strong className="text-dark" style={{ fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  {label}
                                </strong>
                              </td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="pt-2 pb-3" style={{ padding: "0.75rem 1rem", paddingTop: "0.5rem", paddingBottom: "1rem" }}>
                                {renderCoberturasDiffCell(info.anterior, info.nuevo)}
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      }

                      return (
                        <tr key={campo}>
                          <td className="text-dark" style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>{label}</td>
                          <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                            <span className="text-muted" style={{ fontSize: "0.9rem", wordBreak: "break-word" }}>
                              {formatValue(info.anterior)}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                            <span className="text-dark fw-semibold" style={{ fontSize: "0.9rem", wordBreak: "break-word" }}>
                              {formatValue(info.nuevo)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </>
              )}

              {viewMode === "grupo" &&
                Object.keys(coverageGroups)
                  .sort((a, b) => Number(a) - Number(b))
                  .map((coberturaId) => {
                    const fieldsForCoverage = coverageGroups[coberturaId];
                    const hasNonClientFields = fieldsForCoverage.some((f) => !f.fieldKey.startsWith("cliente."));

                    if (!hasNonClientFields) return null;

                    let clienteNombre = "";
                    
                    // 1. Intentar obtener el nombre desde los cambios de la cobertura
                    const clienteField = fieldsForCoverage.find(({ fieldKey }) => fieldKey === "cliente.nombre_completo");
                    if (clienteField) {
                      const infoCliente = cambios[clienteField.campo] || {};
                      clienteNombre = infoCliente.nuevo || infoCliente.anterior || "";
                    }
                    
                    // 2. Si no se encontró, buscar en otros campos de cliente de la cobertura
                    if (!clienteNombre) {
                      const primerNombreField = fieldsForCoverage.find(({ fieldKey }) => fieldKey === "cliente.primer_nombre");
                      const apellidosField = fieldsForCoverage.find(({ fieldKey }) => fieldKey === "cliente.apellidos");
                      if (primerNombreField || apellidosField) {
                        const primerNombre = primerNombreField ? 
                          (cambios[primerNombreField.campo]?.nuevo || cambios[primerNombreField.campo]?.anterior || "") : "";
                        const apellidos = apellidosField ? 
                          (cambios[apellidosField.campo]?.nuevo || cambios[apellidosField.campo]?.anterior || "") : "";
                        clienteNombre = [primerNombre, apellidos].filter(Boolean).join(" ");
                      }
                    }
                    
                    // 3. Si aún no se encontró, buscar en clientes_afectados del registro
                    if (!clienteNombre && Array.isArray(selected.clientes_afectados) && selected.clientes_afectados.length > 0) {
                      // Si solo hay un cliente afectado, usarlo directamente
                      if (selected.clientes_afectados.length === 1) {
                        clienteNombre = selected.clientes_afectados[0];
                      } else {
                        // Si hay múltiples clientes, intentar encontrar el que corresponde a esta cobertura
                        // Por ahora, mostrar el primero si hay múltiples
                        clienteNombre = selected.clientes_afectados[0];
                      }
                    }
                    
                    // 4. Como último recurso, usar coberturaClientes si existe
                    if (!clienteNombre && coberturaClientes && coberturaClientes[coberturaId]) {
                      clienteNombre = coberturaClientes[coberturaId];
                    }

                    return (
                      <React.Fragment key={`cov-${coberturaId}`}>
                        <tr style={{ backgroundColor: "#f8f9fa" }}>
                          <td colSpan={3} className="py-2" style={{ padding: "0.75rem 1rem" }}>
                            <strong className="text-dark" style={{ fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              Cobertura #{coberturaId}
                              {clienteNombre && (
                                <span className="text-muted ms-2 fw-normal" style={{ textTransform: "none" }}>
                                  – {clienteNombre}
                                </span>
                              )}
                            </strong>
                          </td>
                        </tr>

                        {fieldsForCoverage.map(({ campo, fieldKey }) => {
                          const isClienteField = fieldKey.startsWith("cliente.");
                          if (isClienteField) return null;

                          const info = cambios[campo] || {};
                          const niceLabel = getFieldLabel(fieldKey);

                          return (
                            <tr key={campo}>
                              <td className="ps-4 text-dark" style={{ padding: "0.75rem 1rem", paddingLeft: "2.5rem", verticalAlign: "top" }}>{niceLabel}</td>
                              <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                                <span className="text-muted" style={{ fontSize: "0.9rem", wordBreak: "break-word" }}>
                                  {formatValue(info.anterior)}
                                </span>
                              </td>
                              <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                                <span className="text-dark fw-semibold" style={{ fontSize: "0.9rem", wordBreak: "break-word" }}>
                                  {formatValue(info.nuevo)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
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
            maxWidth: "1200px",
            width: "95vw",
            margin: "1.75rem auto",
          }}
        >
          <div className="modal-content" style={{ border: "none", boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)" }}>
            <div className="modal-header border-bottom" style={{ backgroundColor: "#2c3e50", color: "#ffffff", padding: "1rem 1.5rem" }}>
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

            <div className="modal-body" style={{ padding: "1.5rem" }}>
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
                <div className="row g-3">
                  <div className="col-12 col-xl-5 mb-3">
                    <div className="table-responsive" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                      <table className="table table-sm table-hover align-middle mb-0">
                        <thead className="table-light sticky-top">
                          <tr>
                            <th style={{ padding: "0.75rem 0.5rem", width: "80px" }}>ID</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Fecha</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Usuario</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Acción</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Origen</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Cliente(s)</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Cambios</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historial.map((row) => {
                            const cambiosFiltrados = Object.keys(row.cambios || {}).filter(
                              campo => !debeIgnorarCampo(campo)
                            );
                            const totalCambios = cambiosFiltrados.length;
                            const isActive = selected && selected.id === row.id;
                            const esCobertura = row._esCobertura || false;
                            const coberturaInfo = row._coberturaInfo || {};
                            const clientesAfectados = Array.isArray(row.clientes_afectados) ? row.clientes_afectados : [];

                            return (
                              <tr
                                key={`${row.id}-${esCobertura ? row._coberturaId : ''}`}
                                className={isActive ? "table-primary" : ""}
                                style={{ cursor: "pointer" }}
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
                                  <span className="badge bg-secondary">{row.accion}</span>
                                </td>
                                <td style={{ padding: "0.75rem 0.5rem" }}>
                                  {esCobertura ? (
                                    <div className="small">
                                      <span className="badge bg-info text-dark" style={{ fontSize: "0.7rem" }}>
                                        Cobertura
                                      </span>
                                      {coberturaInfo.cliente_nombre && (
                                        <div className="text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                                          {coberturaInfo.cliente_nombre}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="badge bg-dark" style={{ fontSize: "0.7rem" }}>
                                      Grupo
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: "0.75rem 0.5rem" }}>
                                  {clientesAfectados.length > 0 ? (
                                    <div className="small">
                                      {clientesAfectados.map((cliente, idx) => (
                                        <div key={idx} className="text-dark" style={{ fontSize: "0.85rem", marginBottom: idx < clientesAfectados.length - 1 ? "0.25rem" : "0" }}>
                                          {cliente}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted" style={{ fontSize: "0.85rem" }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: "0.75rem 0.5rem" }}>
                                  {totalCambios > 0 ? `${totalCambios} cambio(s)` : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="border rounded p-2 mt-3" style={{ backgroundColor: "#f8f9fa" }}>
                      <small className="text-muted" style={{ fontSize: "0.8rem" }}>
                        Haz clic en una fila para ver el detalle de los campos modificados.
                      </small>
                    </div>
                  </div>

                  <div className="col-12 col-xl-7">
                    <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "0.5rem" }}>
                      {renderDetalleCambios()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer border-top" style={{ padding: "1rem 1.5rem" }}>
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
