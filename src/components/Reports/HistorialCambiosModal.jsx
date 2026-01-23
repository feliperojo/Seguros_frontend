// src/components/Historial/HistorialCambiosModal.jsx
// ✅ MODAL DE SOLO LECTURA: Este componente solo muestra el historial de cambios.
// NO realiza actualizaciones al backend. Todas las actualizaciones se realizan
// a través del botón "Guardar" del grupo familiar en GrupoFamiliarDetail.jsx
import React, { useEffect, useState } from "react";
import apiRequest from "../../services/api";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";

// ==================== CONSTANTES ====================

const CAMPOS_IGNORAR = new Set(['updated_at', 'updatedAt']);

const FIELD_LABELS = {
  ingreso_familiar_anual: "Ingreso familiar anual",
  personas_cobertura: "Personas en cobertura",
  personas_taxes: "Personas en Taxes",
  zip_code: "ZIP Code",
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
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
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
  if (FIELD_LABELS[fieldKey]) return FIELD_LABELS[fieldKey];
  if (fieldKey.startsWith("cliente.")) {
    const clienteField = fieldKey.replace("cliente.", "");
    return CLIENTE_FIELD_LABELS[clienteField] || clienteField;
  }
  return fieldKey;
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
    <div className="small">
      {diff.map((item) => (
        <div key={item.key} className="mb-3 p-2 border rounded" style={{ backgroundColor: "#f8f9fa" }}>
          <div className="d-flex align-items-center mb-2">
            {item.parentesco && (
              <span className="badge bg-secondary me-2" style={{ fontSize: "0.75rem" }}>
                {item.parentesco}
              </span>
            )}
            <strong className="text-dark">{item.nombreNuevo}</strong>
          </div>
          <div className="ms-3">
            {Object.values(item.cambios).map((c) => (
              <div key={c.label} className="mb-1 d-flex align-items-center">
                <span className="text-muted me-2" style={{ fontSize: "0.85rem", minWidth: "100px" }}>
                  {c.label}:
                </span>
                <span className="text-muted me-2" style={{ fontSize: "0.85rem" }}>
                  {formatValue(c.anterior)}
                </span>
                <span className="text-muted me-2">→</span>
                <span className="text-dark fw-semibold" style={{ fontSize: "0.85rem" }}>
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

  // Filtrar registros relevantes
  const filtrarRegistrosRelevantes = (rows) => {
    return rows.filter((row) => {
      const cambios = row.cambios || {};
      const camposCambios = Object.keys(cambios);
      if (camposCambios.length === 0) return false;
      const camposRelevantes = camposCambios.filter(campo => !CAMPOS_IGNORAR.has(campo));
      return camposRelevantes.length > 0;
    });
  };

  // Contar cambios por categoría
  const contarCambiosPorCategoria = (cambios) => {
    const keys = Object.keys(cambios || {}).filter(campo => !CAMPOS_IGNORAR.has(campo));
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
      .filter(campo => !CAMPOS_IGNORAR.has(campo) && campo.startsWith("cliente."))
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
          clienteNombre = infoNombre.nuevo || infoNombre.anterior || 
            coberturaClientes[coberturaId] || `Cliente Cobertura ${coberturaId}`;
        } else {
          const primerNombreField = clienteFields.find((f) => f.fieldKey === "cliente.primer_nombre");
          const apellidosField = clienteFields.find((f) => f.fieldKey === "cliente.apellidos");
          
          if (primerNombreField || apellidosField) {
            const primerNombre = primerNombreField ? 
              (cambios[primerNombreField.campo]?.nuevo || cambios[primerNombreField.campo]?.anterior || "") : "";
            const apellidos = apellidosField ? 
              (cambios[apellidosField.campo]?.nuevo || cambios[apellidosField.campo]?.anterior || "") : "";
            clienteNombre = [primerNombre, apellidos].filter(Boolean).join(" ") || 
              coberturaClientes[coberturaId] || `Cliente Cobertura ${coberturaId}`;
          } else {
            clienteNombre = coberturaClientes[coberturaId] || `Cliente Cobertura ${coberturaId}`;
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
      const keys = Object.keys(selected.cambios || {}).filter(campo => !CAMPOS_IGNORAR.has(campo));
      
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
    const keys = Object.keys(cambios).filter(campo => !CAMPOS_IGNORAR.has(campo));

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
      <div className="card mb-3 border" style={{ backgroundColor: "#f8f9fa" }}>
        <div className="card-body p-3">
          <div className="row g-3 mb-2">
            <div className="col-12 col-md-6">
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
              <div>
                <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Total Cambios
                </small>
                <div className="text-dark fw-semibold">{selected.total_cambios ?? keys.length}</div>
              </div>
            </div>
          </div>
          
          {esCobertura && coberturaInfo && (
            <div className="row g-2 mt-3 pt-3 border-top">
              <div className="col-12">
                <small className="text-muted d-block mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
            <div className="row g-2 mt-3 pt-3 border-top">
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
                  <th style={{ width: "25%", fontWeight: "600", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Campo
                  </th>
                  <th style={{ width: "37.5%", fontWeight: "600", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Anterior
                  </th>
                  <th style={{ width: "37.5%", fontWeight: "600", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
                      <td className="text-dark">{label}</td>
                      <td>
                        <span className="text-muted" style={{ fontSize: "0.9rem" }}>
                          {formatValue(info.anterior)}
                        </span>
                      </td>
                      <td>
                        <span className="text-dark fw-semibold" style={{ fontSize: "0.9rem" }}>
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
              style={{ fontSize: "0.875rem", fontWeight: "500" }}
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
              style={{ fontSize: "0.875rem", fontWeight: "500" }}
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
                <th style={{ width: "25%", fontWeight: "600", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Campo
                </th>
                <th style={{ width: "37.5%", fontWeight: "600", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Anterior
                </th>
                <th style={{ width: "37.5%", fontWeight: "600", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
                        <td colSpan={3} className="py-2 px-3" style={{ backgroundColor: "#e7f3ff", borderLeft: "4px solid #0066cc" }}>
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
                            <td colSpan={3} className="py-3 px-3">
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
                                    }}
                                  >
                                    ▶
                                  </span>
                                  <div>
                                    <strong className="text-dark" style={{ fontSize: "0.95rem", display: "block", fontWeight: "600" }}>
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
                                <span className="badge bg-dark" style={{ fontSize: "0.75rem", fontWeight: "500", padding: "0.4rem 0.6rem" }}>
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
                                    <td className="ps-5 text-dark fw-medium" style={{ fontSize: "0.9rem" }}>{niceLabel}</td>
                                    <td>
                                      <span className="text-muted" style={{ fontSize: "0.9rem" }}>
                                        {formatValue(info.anterior)}
                                      </span>
                                    </td>
                                    <td>
                                      <span className="text-dark fw-semibold" style={{ fontSize: "0.9rem" }}>
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
                              <td colSpan={3} className="py-2">
                                <strong className="text-dark" style={{ fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  {label}
                                </strong>
                              </td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="pt-2 pb-3">
                                {renderCoberturasDiffCell(info.anterior, info.nuevo)}
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      }

                      return (
                        <tr key={campo}>
                          <td className="text-dark">{label}</td>
                          <td>
                            <span className="text-muted" style={{ fontSize: "0.9rem" }}>
                              {formatValue(info.anterior)}
                            </span>
                          </td>
                          <td>
                            <span className="text-dark fw-semibold" style={{ fontSize: "0.9rem" }}>
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
                    const clienteField = fieldsForCoverage.find(({ fieldKey }) => fieldKey === "cliente.nombre_completo");

                    if (clienteField) {
                      const infoCliente = cambios[clienteField.campo] || {};
                      clienteNombre = infoCliente.nuevo || infoCliente.anterior || "";
                    }

                    const nombreHeader = coberturaClientes[coberturaId] || clienteNombre || "";

                    return (
                      <React.Fragment key={`cov-${coberturaId}`}>
                        <tr style={{ backgroundColor: "#f8f9fa" }}>
                          <td colSpan={3} className="py-2">
                            <strong className="text-dark" style={{ fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              Cobertura #{coberturaId}
                              {nombreHeader && (
                                <span className="text-muted ms-2 fw-normal" style={{ textTransform: "none" }}>
                                  – {nombreHeader}
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
                              <td className="ps-4 text-dark">{niceLabel}</td>
                              <td>
                                <span className="text-muted" style={{ fontSize: "0.9rem" }}>
                                  {formatValue(info.anterior)}
                                </span>
                              </td>
                              <td>
                                <span className="text-dark fw-semibold" style={{ fontSize: "0.9rem" }}>
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
          }}
        >
          <div className="modal-content">
            <div className="modal-header border-bottom" style={{ backgroundColor: "#2c3e50", color: "#ffffff" }}>
              <h5 className="modal-title" style={{ fontWeight: "600", fontSize: "1.1rem" }}>
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
              />
            </div>

            <div className="modal-body">
              {loading && (
                <div className="d-flex justify-content-center py-4">
                  <div className="spinner-border" role="status">
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="alert alert-danger">{error}</div>
              )}

              {!loading && !error && historial.length === 0 && (
                <div className="text-muted text-center py-3">
                  No hay cambios registrados para este grupo familiar.
                </div>
              )}

              {!loading && !error && historial.length > 0 && (
                <div className="row">
                  <div className="col-12 col-xl-5 mb-3">
                    <table className="table table-sm table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Fecha</th>
                          <th>Usuario</th>
                          <th>Acción</th>
                          <th>Origen</th>
                          <th>Cambios</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historial.map((row) => {
                          const cambiosFiltrados = Object.keys(row.cambios || {}).filter(
                            campo => !CAMPOS_IGNORAR.has(campo)
                          );
                          const totalCambios = cambiosFiltrados.length;
                          const isActive = selected && selected.id === row.id;
                          const esCobertura = row._esCobertura || false;
                          const coberturaInfo = row._coberturaInfo || {};

                          return (
                            <tr
                              key={`${row.id}-${esCobertura ? row._coberturaId : ''}`}
                              className={isActive ? "table-primary" : ""}
                              style={{ cursor: "pointer" }}
                              onClick={() => setSelected(row)}
                            >
                              <td>{formatDateTime(row.created_at)}</td>
                              <td>{row.usuario}</td>
                              <td>
                                <span className="badge bg-secondary">{row.accion}</span>
                              </td>
                              <td>
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
                              <td>
                                {totalCambios > 0 ? `${totalCambios} cambio(s)` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="border rounded p-2 mt-2" style={{ backgroundColor: "#f8f9fa" }}>
                      <small className="text-muted" style={{ fontSize: "0.8rem" }}>
                        Haz clic en una fila para ver el detalle de los campos modificados.
                      </small>
                    </div>
                  </div>

                  <div className="col-12 col-xl-7">
                    {renderDetalleCambios()}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer border-top">
              <button
                type="button"
                className="btn btn-dark btn-sm"
                onClick={onClose}
                style={{ minWidth: "100px", fontWeight: "500" }}
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
