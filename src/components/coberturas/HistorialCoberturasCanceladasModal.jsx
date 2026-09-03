// src/components/coberturas/HistorialCoberturasCanceladasModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Modal, Button, Table, Alert, Spinner, Badge, Form, Row, Col } from "react-bootstrap";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import apiRequest from "../../services/api";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import {
  COBERTURA_TIPO_DENTAL_MS,
  isDentalCoberturaTipo,
  isSaludCoberturaTipo,
} from "../../constants/coberturaTipos";
import "../../styles/HistorialCoberturasCanceladas.css";

const stripHtmlTags = (html = "") =>
  String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getEtiquetaProductoHistorial = (item = {}) => {
  const tipo = item?.cobertura_tipo ?? "";
  if (isDentalCoberturaTipo(tipo)) {
    return tipo.trim() || COBERTURA_TIPO_DENTAL_MS;
  }
  if (isSaludCoberturaTipo(tipo) && tipo.trim()) return tipo.trim();
  return "Salud MS";
};

const badgeEstadoClase = (estado = "") => {
  const norm = String(estado).toLowerCase();
  if (norm === "cancelado") return "hcc-badge-estado hcc-badge-estado--cancelado";
  if (norm === "retirado") return "hcc-badge-estado hcc-badge-estado--retirado";
  return "hcc-badge-estado hcc-badge-estado--otro";
};

const fechaOrdenHistorial = (item = {}) => {
  const raw =
    item?.fecha_retiro ||
    item?.fecha_cancelacion ||
    item?.created_at ||
    "";
  return String(raw).slice(0, 10);
};

const esRenovacionAnualHistorial = (item = {}) => {
  const origen = String(item?.accion_origen || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return origen.includes("renovacion anual");
};

const clienteIdHistorial = (item = {}) => {
  const id =
    item?.cliente_id ??
    item?.cliente_info?.id ??
    item?.cliente?.id ??
    null;
  return id == null || id === "" ? null : Number(id);
};

/**
 * Orden del historial:
 * 1) Renovación Anual primero; el resto después, cronológico.
 * 2) Dental MS debajo de la salud del mismo cliente (mismo año si aplica).
 */
const ordenarHistorialAgrupado = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const dentales = [];
  const anclas = [];

  items.forEach((item) => {
    if (isDentalCoberturaTipo(item?.cobertura_tipo)) dentales.push(item);
    else anclas.push(item);
  });

  const compararAncla = (a, b) => {
    const aRen = esRenovacionAnualHistorial(a) ? 0 : 1;
    const bRen = esRenovacionAnualHistorial(b) ? 0 : 1;
    if (aRen !== bRen) return aRen - bRen;

    const fa = fechaOrdenHistorial(a);
    const fb = fechaOrdenHistorial(b);
    if (fa && fb && fa !== fb) return fa < fb ? -1 : 1;
    if (fa && !fb) return -1;
    if (!fa && fb) return 1;

    return Number(a?.id || 0) - Number(b?.id || 0);
  };

  const scoreMatchDental = (salud, dental) => {
    let score = 0;
    const anioSalud = String(salud?.ano_cobertura ?? "").trim();
    const anioDental = String(dental?.ano_cobertura ?? "").trim();
    if (anioSalud && anioDental && anioSalud === anioDental) score += 4;

    const origenSalud = String(salud?.accion_origen || "").trim().toLowerCase();
    const origenDental = String(dental?.accion_origen || "").trim().toLowerCase();
    if (origenSalud && origenDental && origenSalud === origenDental) score += 2;

    const fSalud = fechaOrdenHistorial(salud);
    const fDental = fechaOrdenHistorial(dental);
    if (fSalud && fDental && fSalud === fDental) score += 1;

    return score;
  };

  const usadosDental = new Set();
  const tomarDentalesDe = (salud) => {
    const clienteId = clienteIdHistorial(salud);
    if (clienteId == null) return [];

    const candidatos = dentales
      .filter((d) => {
        if (usadosDental.has(d?.id)) return false;
        return clienteIdHistorial(d) === clienteId;
      })
      .map((d) => ({ d, score: scoreMatchDental(salud, d) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return compararAncla(a.d, b.d);
      });

    // Si hay varios dentales del mismo cliente, solo adjuntar los que
    // realmente encajan (mismo año/origen) o, si ninguno puntúa, el mejor.
    const conMatch = candidatos.filter((c) => c.score > 0);
    const elegidos = (conMatch.length > 0 ? conMatch : candidatos.slice(0, 1)).map(
      (c) => c.d
    );

    elegidos.forEach((d) => {
      if (d?.id != null) usadosDental.add(d.id);
    });

    return elegidos.sort(compararAncla);
  };

  const resultado = [];
  anclas.sort(compararAncla).forEach((salud) => {
    resultado.push(salud);
    resultado.push(...tomarDentalesDe(salud));
  });

  // Dentales sin salud pareja: mismo orden Renovación Anual → cronológico
  dentales
    .filter((d) => d?.id == null || !usadosDental.has(d.id))
    .sort(compararAncla)
    .forEach((d) => resultado.push(d));

  return resultado;
};

/**
 * HistorialCoberturasCanceladasModal
 * 
 * Modal para consultar el historial de coberturas canceladas de un grupo familiar.
 * 
 * Props:
 * - show (boolean): Controla la visibilidad del modal
 * - onClose (func): Se llama para cerrar el modal
 * - grupoFamiliarId (number|string): ID del grupo familiar
 * 
 * El componente:
 * - Carga el historial de coberturas canceladas desde el endpoint GET /api/coberturas/historial-renovaciones
 * - Muestra una tabla con las coberturas canceladas
 * - Incluye información como fechas, motivos, notas, etc.
 */
const HistorialCoberturasCanceladasModal = ({
  show,
  onClose,
  grupoFamiliarId,
  /** Prefija el filtro de año al abrir (p. ej. año cerrado en consulta histórica). */
  anioInicial = null,
  /** Si true, el filtro de año queda fijo en anioInicial (no se puede cambiar a "todos"). */
  soloAnioInicial = false,
}) => {
  const navigate = useNavigate();
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [grupoFamiliarInfo, setGrupoFamiliarInfo] = useState(null);
  const [filasExpandidas, setFilasExpandidas] = useState(new Set());

  // Filtros
  const [filtroClienteId, setFiltroClienteId] = useState("");
  const [filtroAnio, setFiltroAnio] = useState("");
  const [filtroCompaniaId, setFiltroCompaniaId] = useState("");

  // Opciones para los filtros
  const [clientes, setClientes] = useState([]);
  const [companias, setCompanias] = useState([]);
  const [anios, setAnios] = useState([]);
  const [loadingOpciones, setLoadingOpciones] = useState(false);

  const anioInicialStr =
    anioInicial != null && anioInicial !== "" ? String(anioInicial) : "";

  // Al abrir: opciones + filtro de año prefijado. La carga de datos la dispara el efecto de filtros.
  useEffect(() => {
    if (show && grupoFamiliarId) {
      setFiltroClienteId("");
      setFiltroCompaniaId("");
      setFiltroAnio(anioInicialStr);
      setFilasExpandidas(new Set());
      cargarOpcionesFiltro();
    } else if (!show) {
      setHistorial([]);
      setError("");
      setFiltroClienteId("");
      setFiltroAnio("");
      setFiltroCompaniaId("");
      setClientes([]);
      setCompanias([]);
      setAnios([]);
      setGrupoFamiliarInfo(null);
      setFilasExpandidas(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargarOpcionesFiltro es estable en práctica
  }, [show, grupoFamiliarId, anioInicialStr]);

  // Cargar historial cuando cambian los filtros (solo si el modal está abierto)
  useEffect(() => {
    if (show && grupoFamiliarId) {
      const timeoutId = setTimeout(() => {
        cargarHistorial();
      }, 300);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroClienteId, filtroAnio, filtroCompaniaId, show, grupoFamiliarId]);

  const cargarOpcionesFiltro = async () => {
    if (!grupoFamiliarId) return;

    setLoadingOpciones(true);
    try {
      // Obtener el grupo familiar completo para extraer clientes y compañías
      const grupoData = await GrupoFamiliarService.getFullById(grupoFamiliarId);

      // Extraer clientes únicos del grupo
      const clientesUnicos = new Map();
      (grupoData?.coberturas || []).forEach((cob) => {
        const cliente = cob?.cliente;
        if (cliente?.id) {
          if (!clientesUnicos.has(cliente.id)) {
            clientesUnicos.set(cliente.id, {
              id: cliente.id,
              nombre: cliente.nombre_completo || 
                     `${cliente.primer_nombre || ""} ${cliente.apellidos || ""}`.trim() ||
                     `Cliente ${cliente.id}`,
            });
          }
        }
      });
      setClientes(Array.from(clientesUnicos.values()));

      // Extraer compañías únicas
      const companiasUnicas = new Map();
      (grupoData?.coberturas || []).forEach((cob) => {
        const compania = cob?.compania;
        if (compania?.id) {
          if (!companiasUnicas.has(compania.id)) {
            companiasUnicas.set(compania.id, {
              id: compania.id,
              nombre: compania.nombre || `Compañía ${compania.id}`,
            });
          }
        }
      });
      setCompanias(Array.from(companiasUnicas.values()));

      // Generar lista de años (últimos 10 años hasta el próximo)
      const anioActual = new Date().getFullYear();
      const listaAnios = [];
      if (soloAnioInicial && anioInicialStr) {
        listaAnios.push(Number(anioInicialStr) || anioInicialStr);
      } else {
        for (let i = anioActual + 1; i >= anioActual - 10; i--) {
          listaAnios.push(i);
        }
      }
      setAnios(listaAnios);
    } catch (err) {
      console.error("Error al cargar opciones de filtro:", err);
    } finally {
      setLoadingOpciones(false);
    }
  };

  const cargarHistorial = async () => {
    if (!grupoFamiliarId) return;

    setLoading(true);
    setError("");

    try {
      // Construir query params
      const params = new URLSearchParams();
      params.append("grupo_familiar_id", grupoFamiliarId);
      
      if (filtroClienteId) {
        params.append("cliente_id", filtroClienteId);
      }
      const anioParaQuery =
        soloAnioInicial && anioInicialStr ? anioInicialStr : filtroAnio;
      if (anioParaQuery) {
        params.append("anio", anioParaQuery);
      }
      if (filtroCompaniaId) {
        params.append("compania_id", filtroCompaniaId);
      }

      // Llamar al endpoint de historial de renovaciones con filtros
      const response = await apiRequest(
        `coberturas/historial-renovaciones?${params.toString()}`,
        "GET"
      );

      // Manejar diferentes formatos de respuesta (incluyendo paginación de Laravel)
      let datos = [];
      if (Array.isArray(response)) {
        datos = response;
      } else if (Array.isArray(response?.data)) {
        // Respuesta paginada de Laravel: { data: [...], current_page: 1, ... }
        datos = response.data;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        datos = response.data.data;
      } else if (response?.coberturas_canceladas && Array.isArray(response.coberturas_canceladas)) {
        datos = response.coberturas_canceladas;
      }

      // Extraer grupo_familiar_info del primer elemento (es el mismo para todos)
      if (datos.length > 0) {
        const primerItem = datos[0];
        const grupoInfo = primerItem?.grupo_familiar_info || 
                         primerItem?.grupo_familiarInfo ||
                         primerItem?.grupo_familiar;
        
        if (grupoInfo) {
          // Intentar parsear si es string JSON
          try {
            const parsed = typeof grupoInfo === 'string' ? JSON.parse(grupoInfo) : grupoInfo;
            setGrupoFamiliarInfo(parsed);
          } catch {
            setGrupoFamiliarInfo(grupoInfo);
          }
        }
      }

      setHistorial(datos);
    } catch (err) {
      console.error("Error al cargar historial de coberturas canceladas:", err);
      setError(
        err?.message || "No se pudo cargar el historial de coberturas canceladas."
      );
      setHistorial([]);
    } finally {
      setLoading(false);
    }
  };

  // Formatear fecha sin alterar el día (evita problemas de zona horaria)
  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    try {
      // Si ya es un string en formato YYYY-MM-DD, extraer componentes directamente
      if (typeof fecha === 'string') {
        // Formato YYYY-MM-DD
        const matchDateOnly = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (matchDateOnly) {
          const [, year, month, day] = matchDateOnly;
          return `${month}-${day}-${year}`;
        }
        
        // Formato ISO con hora: YYYY-MM-DDTHH:mm:ss o YYYY-MM-DD HH:mm:ss
        const matchDateTime = fecha.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
        if (matchDateTime) {
          const [, year, month, day] = matchDateTime;
          return `${month}-${day}-${year}`;
        }
      }
      
      // Si es un objeto Date, usar métodos locales para evitar desfase
      const d = fecha instanceof Date ? fecha : new Date(fecha);
      if (isNaN(d.getTime())) return fecha;
      
      // Usar métodos locales (getFullYear, getMonth, getDate) que respetan la zona horaria local
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${month}-${day}-${year}`;
    } catch {
      return fecha;
    }
  };

  // Formatear fecha y hora completa sin alterar el día
  const formatearFechaHora = (fecha) => {
    if (!fecha) return "-";
    try {
      // Si es un string ISO, extraer componentes directamente
      if (typeof fecha === 'string') {
        // Formato ISO: YYYY-MM-DDTHH:mm:ss o YYYY-MM-DD HH:mm:ss
        const matchDateTime = fecha.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
        if (matchDateTime) {
          const [, year, month, day, hour, minute, second] = matchDateTime;
          return `${month}-${day}-${year} ${hour}:${minute}:${second}`;
        }
        
        // Formato YYYY-MM-DD (solo fecha)
        const matchDateOnly = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (matchDateOnly) {
          const [, year, month, day] = matchDateOnly;
          return `${month}-${day}-${year} 00:00:00`;
        }
      }
      
      // Si es un objeto Date, usar métodos locales
      const d = fecha instanceof Date ? fecha : new Date(fecha);
      if (isNaN(d.getTime())) return fecha;
      
      // Usar métodos locales para evitar desfase
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hour = String(d.getHours()).padStart(2, "0");
      const minute = String(d.getMinutes()).padStart(2, "0");
      const second = String(d.getSeconds()).padStart(2, "0");
      return `${month}-${day}-${year} ${hour}:${minute}:${second}`;
    } catch {
      return fecha;
    }
  };

  // Obtener información de auditoría del historial
  const obtenerInfoAuditoria = () => {
    if (historial.length === 0) return null;

    // Intentar obtener del primer elemento
    const primerItem = historial[0];
    
    // Según la estructura del JSON: ejecutado_por.name y created_at están en el nivel raíz
    const fechaCreacion = primerItem?.created_at;
    
    // Usuario desde ejecutado_por.name
    const usuario = primerItem?.ejecutado_por?.name || 
                   primerItem?.ejecutado_por?.nombre ||
                   primerItem?.usuario || 
                   primerItem?.created_by || 
                   "Sistema";

    // Verificar si hay múltiples usuarios o fechas diferentes
    const usuariosUnicos = new Set();
    const fechasUnicas = new Set();
    
    historial.forEach(item => {
      const fechaItem = item?.created_at;
      const usuarioItem = item?.ejecutado_por?.name || 
                         item?.ejecutado_por?.nombre ||
                         item?.usuario || 
                         item?.created_by;
      
      if (fechaItem) fechasUnicas.add(fechaItem);
      if (usuarioItem) usuariosUnicos.add(usuarioItem);
    });

    // Si hay múltiples fechas o usuarios, mostrar información agregada
    const tieneMultiplesFechas = fechasUnicas.size > 1;
    const tieneMultiplesUsuarios = usuariosUnicos.size > 1;

    return {
      fecha: fechaCreacion,
      usuario: tieneMultiplesUsuarios ? `${usuariosUnicos.size} usuarios diferentes` : usuario,
      cantidad: historial.length,
      tieneInfo: !!(fechaCreacion || usuario !== "Sistema"),
      tieneMultiplesFechas,
      tieneMultiplesUsuarios,
    };
  };

  // Formatear dinero
  const formatearDinero = (valor) => {
    if (valor === null || valor === undefined || valor === "") return "-";
    const num = Number(valor);
    if (isNaN(num)) return valor;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltroClienteId("");
    setFiltroAnio(soloAnioInicial && anioInicialStr ? anioInicialStr : "");
    setFiltroCompaniaId("");
  };

  // Verificar si hay filtros activos (el año fijo del modo histórico no cuenta)
  const hayFiltrosActivos =
    Boolean(filtroClienteId) ||
    Boolean(filtroCompaniaId) ||
    (!soloAnioInicial && Boolean(filtroAnio));

  // Toggle para expandir/contraer filas
  const toggleFila = (coberturaId) => {
    setFilasExpandidas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(coberturaId)) {
        nuevo.delete(coberturaId);
      } else {
        nuevo.add(coberturaId);
      }
      return nuevo;
    });
  };

  // Parsear cliente_info
  const parsearClienteInfo = (clienteInfo) => {
    if (!clienteInfo) return null;
    try {
      return typeof clienteInfo === 'string' ? JSON.parse(clienteInfo) : clienteInfo;
    } catch {
      return clienteInfo;
    }
  };

  // Renderizar información del cliente en formato de tarjeta
  const renderClienteInfo = (clienteInfo) => {
    // cliente_info ya viene como objeto según la estructura del JSON
    const info = typeof clienteInfo === 'object' ? clienteInfo : parsearClienteInfo(clienteInfo);
    if (!info || typeof info !== 'object') return null;

    const campos = [
      { key: 'nombre_completo', label: 'Nombre Completo' },
      { key: 'primer_nombre', label: 'Primer Nombre' },
      { key: 'segundo_nombre', label: 'Segundo Nombre' },
      { key: 'apellidos', label: 'Apellidos' },
      { key: 'fecha_nacimiento', label: 'Fecha de Nacimiento', formatter: (v) => formatearFecha(v) },
      { key: 'edad', label: 'Edad' },
      { key: 'genero', label: 'Género' },
      { key: 'idioma', label: 'Idioma' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'email', label: 'Email' },
      { key: 'calle', label: 'Calle' },
      { key: 'apto', label: 'Apartamento' },
      { key: 'ciudad', label: 'Ciudad' },
      { key: 'estado', label: 'Estado' },
      { key: 'codigo_postal', label: 'Código Postal' },
      { key: 'condado', label: 'Condado' },
      { key: 'dir_correspondencia', label: 'Dirección de Correspondencia' },
      { key: 'ingreso_anual', label: 'Ingreso Anual', formatter: formatearDinero },
      { key: 'ingreso_por_periodo', label: 'Ingreso por Período', formatter: formatearDinero },
      { key: 'periodo_ingreso', label: 'Período de Ingreso' },
      { key: 'tipo_ingreso', label: 'Tipo de Ingreso' },
      { key: 'empleador', label: 'Empleador' },
      { key: 'telefono_empleador', label: 'Teléfono Empleador' },
      { key: 'status', label: 'Status' },
      { key: 'social', label: 'Social Security' },
      { key: 'auscis', label: 'AUSCIS' },
      { key: 'tarjeta_numero', label: 'Número de Tarjeta' },
      { key: 'categoria', label: 'Categoría' },
      { key: 'fecha_emision', label: 'Fecha de Emisión' },
      { key: 'fecha_expiracion', label: 'Fecha de Expiración' },
      { key: 'nota', label: 'Nota' },
      { key: 'estado_cliente', label: 'Estado del Cliente' },
    ];
    
    // Agregar información de teléfonos si existe
    const telefonos = info.telefonos || [];

    return (
      <div className="row g-3 mt-2">
        {campos.map((campo) => {
          const valor = info[campo.key];
          if (valor === null || valor === undefined || valor === '') return null;
          
          return (
            <div key={campo.key} className="col-md-6">
              <small className="text-muted d-block">{campo.label}:</small>
              <div className="fw-semibold">
                {campo.formatter ? campo.formatter(valor) : String(valor)}
              </div>
            </div>
          );
        })}
        
        {/* Mostrar teléfonos si existen */}
        {telefonos.length > 0 && (
          <div className="col-md-12">
            <small className="text-muted d-block">Teléfonos:</small>
            <div className="fw-semibold">
              {telefonos.map((tel, idx) => (
                <div key={idx} className="mb-1">
                  {tel.numero && (
                    <span>
                      {tel.indicativo ? `+${tel.indicativo} ` : ''}
                      {tel.numero}
                      {tel.tipo && ` (${tel.tipo})`}
                      {tel.principal && <Badge bg="primary" className="ms-1">Principal</Badge>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const historialOrdenado = useMemo(
    () => ordenarHistorialAgrupado(historial),
    [historial]
  );

  const resumenProductos = useMemo(() => {
    let dental = 0;
    let salud = 0;
    historialOrdenado.forEach((item) => {
      if (isDentalCoberturaTipo(item?.cobertura_tipo)) dental += 1;
      else salud += 1;
    });
    return { dental, salud, total: historialOrdenado.length };
  }, [historialOrdenado]);

  const renderBadgeProducto = (item, { large = false } = {}) => {
    const esDental = isDentalCoberturaTipo(item?.cobertura_tipo);
    const label = getEtiquetaProductoHistorial(item);
    return (
      <span
        className={`hcc-badge-producto ${
          esDental ? "hcc-badge-producto--dental" : "hcc-badge-producto--salud"
        }${large ? " px-2 py-1" : ""}`}
        title={esDental ? "Cancelación o retiro del producto dental" : "Cancelación o retiro de salud"}
      >
        {esDental && <i className="fas fa-tooth" aria-hidden="true" />}
        {label}
      </span>
    );
  };

  // Renderizar información completa de la cobertura
  const renderCoberturaCompleta = (item) => {
    const esDental = isDentalCoberturaTipo(item?.cobertura_tipo);

    return (
      <div className="row g-3">
        {esDental && (
          <Col md={12}>
            <Alert variant="info" className="hcc-alert py-2 mb-0 small">
              <i className="fas fa-tooth me-2" aria-hidden="true" />
              Este registro corresponde a una <strong>cancelación o retiro de Dental MS</strong>.
              La cobertura de salud del miembro no se ve afectada por este movimiento.
            </Alert>
          </Col>
        )}

        {/* Información de la Cobertura */}
        <Col md={6}>
          <div className="hcc-detail-card h-100">
            <div className={`hcc-detail-card__header${esDental ? " hcc-detail-card__header--dental" : ""}`}>
              <i className="fas fa-shield-alt me-2" aria-hidden="true" />
              Información de la Cobertura
              <span className="ms-2">{renderBadgeProducto(item)}</span>
            </div>
            <div className="hcc-detail-card__body">
              <div className="row g-2">
                <div className="col-12">
                  <small className="text-muted">Numero ID:</small>
                  <div className="fw-semibold">{item?.codigo_poliza || "-"}</div>
                </div>
                <div className="col-12">
                  <small className="text-muted">Producto:</small>
                  <div className="fw-semibold mt-1">
                    {renderBadgeProducto(item, { large: true })}
                  </div>
                </div>
                <div className="col-12">
                  <small className="text-muted">Tipo de Cobertura:</small>
                  <div className="fw-semibold">{item?.cobertura_tipo || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Plan:</small>
                  <div className="fw-semibold">{item?.plan || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Metal:</small>
                  <div className="fw-semibold">{item?.metal || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Red:</small>
                  <div className="fw-semibold">{item?.red || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Grupo:</small>
                  <div className="fw-semibold">{item?.grupo || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Año de Cobertura:</small>
                  <div className="fw-semibold">{item?.ano_cobertura || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Elegibilidad:</small>
                  <div className="fw-semibold">{item?.elegibilidad || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Estado de Cobertura:</small>
                  <div className="fw-semibold">{item?.estado_cobertura || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Precio:</small>
                  <div className="fw-semibold text-success">
                    {formatearDinero(item?.precio)}
                  </div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Compañía:</small>
                  <div className="fw-semibold">
                    {item?.compania?.nombre || "-"}
                  </div>
                </div>
                <div className="col-6">
                  <small className="text-muted">ID Cobertura Original:</small>
                  <div className="fw-semibold">{item?.cobertura_id_original || "-"}</div>
                </div>
              </div>
            </div>
          </div>
        </Col>

        {/* Información de Fechas y Pagos */}
        <Col md={6}>
          <div className="hcc-detail-card h-100">
            <div className="hcc-detail-card__header">
              <i className="fas fa-calendar-alt me-2" aria-hidden="true" />
              Fechas y Pagos
            </div>
            <div className="hcc-detail-card__body">
              <div className="row g-2">
                <div className="col-6">
                  <small className="text-muted">Fecha de Activación:</small>
                  <div className="fw-semibold">
                    {formatearFecha(item?.fecha_activacion)}
                  </div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Fecha de expiración:</small>
                  <div className="fw-semibold text-danger">
                    {formatearFecha(item?.fecha_cancelacion)}
                  </div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Fecha de Retiro:</small>
                  <div className="fw-semibold">
                    {formatearFecha(item?.fecha_retiro)}
                  </div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Tipo de Pago:</small>
                  <div className="fw-semibold">{item?.tipo_pago || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Día de Pago:</small>
                  <div className="fw-semibold">{item?.dia_pago || "-"}</div>
                </div>
                <div className="col-12">
                  <small className="text-muted">Parentesco:</small>
                  <div className="fw-semibold">
                    {item?.parentesco || "-"}
                    {item?.parentesco?.toUpperCase() === "TOMADOR" && (
                      <Badge bg="warning" text="dark" className="ms-2">TOMADOR</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Col>

        {/* Información de Cancelación */}
        <Col md={12}>
          <div className="hcc-detail-card">
            <div className="hcc-detail-card__header hcc-detail-card__header--warning">
              <i className="fas fa-exclamation-triangle me-2" aria-hidden="true" />
              Información de Cancelación / Retiro
            </div>
            <div className="hcc-detail-card__body">
              <div className="row g-2">
                <div className="col-md-4">
                  <small className="text-muted">Motivo de Cancelación:</small>
                  <div className="fw-semibold">
                    {item?.motivo_cancelacion || "-"}
                  </div>
                </div>
                <div className="col-md-4">
                  <small className="text-muted">Producto afectado:</small>
                  <div className="fw-semibold mt-1">
                    {renderBadgeProducto(item, { large: true })}
                  </div>
                </div>
                <div className="col-md-4">
                  <small className="text-muted">Acción Origen:</small>
                  <div className="fw-semibold">
                    <Badge bg="secondary" className="hcc-badge-origen">
                      {item?.accion_origen || "N/A"}
                    </Badge>
                  </div>
                </div>
                <div className="col-md-4">
                  <small className="text-muted">Estado definido:</small>
                  <div className="fw-semibold">
                    {item?.cobertura_definida || "-"}
                  </div>
                </div>
                <div className="col-md-4">
                  <small className="text-muted">Motivo de Retiro:</small>
                  <div className="fw-semibold">
                    {item?.motivo_retiro || "-"}
                  </div>
                </div>
                <div className="col-md-12">
                  <small className="text-muted">Nota de Retiro:</small>
                  <div className="fw-semibold">
                    {item?.nota_retiro || "-"}
                  </div>
                </div>
                <div className="col-md-12">
                  <small className="text-muted">Nota de Cancelación:</small>
                  <div className="fw-semibold">
                    {item?.nota_cancel || "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Col>
      </div>
    );
  };

  return (
      <Modal
        show={show}
        onHide={onClose}
        size="xl"
        centered
        dialogClassName="hcc-modal"
      >
        <Modal.Header closeButton className="hcc-modal__header">
          <div className="hcc-modal__header-main">
            <div className="hcc-modal__header-icon" aria-hidden="true">
              <i className="fas fa-history" />
            </div>
            <div>
              <h5 className="hcc-modal__title">
                Historial de cancelaciones y retiros
                {soloAnioInicial && anioInicialStr ? ` — ${anioInicialStr}` : ""}
              </h5>
              <p className="hcc-modal__subtitle">
                Registro de coberturas canceladas o retiradas del grupo familiar
              </p>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="hcc-modal__body">
        {/* Información del Grupo Familiar (Encabezado) */}
        {grupoFamiliarInfo && (
          <section className="hcc-section">
            <div className="hcc-section__title">
              <i className="fas fa-users" aria-hidden="true" />
              Información del grupo familiar
            </div>
            <div className="hcc-info-grid">
              {grupoFamiliarInfo.responsable && (
                <div className="hcc-info-item">
                  <div className="hcc-info-item__label">Responsable</div>
                  <div className="hcc-info-item__value">{grupoFamiliarInfo.responsable}</div>
                </div>
              )}
              {grupoFamiliarInfo.persona_contacto && (
                <div className="hcc-info-item">
                  <div className="hcc-info-item__label">Persona de contacto</div>
                  <div className="hcc-info-item__value">{grupoFamiliarInfo.persona_contacto}</div>
                </div>
              )}
              {grupoFamiliarInfo.ingreso_familiar_anual && (
                <div className="hcc-info-item">
                  <div className="hcc-info-item__label">Ingreso familiar anual</div>
                  <div className="hcc-info-item__value">
                    {formatearDinero(grupoFamiliarInfo.ingreso_familiar_anual)}
                  </div>
                </div>
              )}
              {grupoFamiliarInfo.personas_cobertura && (
                <div className="hcc-info-item">
                  <div className="hcc-info-item__label">Personas en cobertura</div>
                  <div className="hcc-info-item__value">{grupoFamiliarInfo.personas_cobertura}</div>
                </div>
              )}
              {grupoFamiliarInfo.personas_taxes && (
                <div className="hcc-info-item">
                  <div className="hcc-info-item__label">Personas en taxes</div>
                  <div className="hcc-info-item__value">{grupoFamiliarInfo.personas_taxes}</div>
                </div>
              )}
              {grupoFamiliarInfo.zip_code && (
                <div className="hcc-info-item">
                  <div className="hcc-info-item__label">ZIP code</div>
                  <div className="hcc-info-item__value">{grupoFamiliarInfo.zip_code}</div>
                </div>
              )}
              {grupoFamiliarInfo.nota && (
                <div className="hcc-info-item" style={{ gridColumn: "1 / -1" }}>
                  <div className="hcc-info-item__label">Nota</div>
                  <div className="hcc-info-item__value">{stripHtmlTags(grupoFamiliarInfo.nota)}</div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Filtros */}
        <section className="hcc-section">
          <div className="hcc-filters">
            <div className="hcc-section__title mb-0 pb-0 border-0">
              <i className="fas fa-filter" aria-hidden="true" />
              Filtros de búsqueda
            </div>
            {hayFiltrosActivos && (
              <Button
                variant="outline-secondary"
                size="sm"
                className="hcc-filters__clear"
                onClick={limpiarFiltros}
              >
                <i className="fas fa-times me-1" aria-hidden="true" />
                Limpiar filtros
              </Button>
            )}
          </div>

          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>
                  <small className="text-muted">Cliente</small>
                </Form.Label>
                <Form.Select
                  value={filtroClienteId}
                  onChange={(e) => setFiltroClienteId(e.target.value)}
                  size="sm"
                >
                  <option value="">Todos los clientes</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>
                  <small className="text-muted">
                    Año
                    {soloAnioInicial ? " (año cerrado)" : ""}
                  </small>
                </Form.Label>
                <Form.Select
                  value={filtroAnio}
                  onChange={(e) => setFiltroAnio(e.target.value)}
                  size="sm"
                  disabled={soloAnioInicial}
                >
                  {!soloAnioInicial && (
                    <option value="">Todos los años</option>
                  )}
                  {anios.map((anio) => (
                    <option key={anio} value={anio}>
                      {anio}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>
                  <small className="text-muted">Compañía</small>
                </Form.Label>
                <Form.Select
                  value={filtroCompaniaId}
                  onChange={(e) => setFiltroCompaniaId(e.target.value)}
                  size="sm"
                >
                  <option value="">Todas las compañías</option>
                  {companias.map((compania) => (
                    <option key={compania.id} value={compania.id}>
                      {compania.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          {hayFiltrosActivos && (
            <div className="mt-2">
              <small className="text-muted">
                <i className="fas fa-info-circle me-1" aria-hidden="true" />
                Filtros activos:{" "}
                {filtroClienteId && (
                  <Badge bg="primary" className="me-1">
                    Cliente: {clientes.find((c) => c.id === Number(filtroClienteId))?.nombre || filtroClienteId}
                  </Badge>
                )}
                {filtroAnio && (
                  <Badge bg="info" className="me-1">
                    Año: {filtroAnio}
                  </Badge>
                )}
                {filtroCompaniaId && (
                  <Badge bg="success" className="me-1">
                    Compañía: {companias.find((c) => c.id === Number(filtroCompaniaId))?.nombre || filtroCompaniaId}
                  </Badge>
                )}
              </small>
            </div>
          )}
        </section>

        {loadingOpciones ? (
          <div className="hcc-loading py-2">
            <Spinner animation="border" size="sm" variant="secondary" />
            <small className="text-muted ms-2">Cargando opciones...</small>
          </div>
        ) : null}

        {loading ? (
          <div className="hcc-loading">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted mb-0">Cargando historial...</p>
          </div>
        ) : error ? (
          <Alert variant="danger" className="hcc-alert">
            <i className="fas fa-exclamation-circle me-2" aria-hidden="true" />
            {error}
          </Alert>
        ) : historial.length === 0 ? (
          <Alert variant="info" className="hcc-alert">
            <i className="fas fa-info-circle me-2" aria-hidden="true" />
            {hayFiltrosActivos
              ? "No se encontraron coberturas canceladas con los filtros seleccionados."
              : "No hay coberturas canceladas registradas en el historial."}
          </Alert>
        ) : (
          <>
            <div className="hcc-chips">
              <span className="hcc-chip hcc-chip--total">
                Total: {resumenProductos.total}
              </span>
              {resumenProductos.salud > 0 && (
                <span className="hcc-chip hcc-chip--salud">
                  Salud: {resumenProductos.salud}
                </span>
              )}
              {resumenProductos.dental > 0 && (
                <span className="hcc-chip hcc-chip--dental">
                  <i className="fas fa-tooth" aria-hidden="true" />
                  Dental MS: {resumenProductos.dental}
                </span>
              )}
            </div>

            <div className="hcc-table-wrap table-responsive">
              <Table className="hcc-table" hover size="sm">
                <thead>
                  <tr>
                    <th style={{ width: 36 }} aria-label="Expandir" />
                    <th>Producto</th>
                    <th>Número ID</th>
                    <th>Cliente</th>
                    <th>Parentesco</th>
                    <th>Plan</th>
                    <th>F. expiración</th>
                    <th>F. retiro</th>
                    <th>Estado</th>
                    <th>Motivo canc.</th>
                    <th>Motivo ret.</th>
                    <th>Nota canc.</th>
                    <th>Nota ret.</th>
                    <th>Acción origen</th>
                    <th>Navegación</th>
                  </tr>
                </thead>
                <tbody>
                  {historialOrdenado.map((item, index) => {
                    const coberturaId = item?.id || `cobertura-${index}`;
                    const isExpanded = filasExpandidas.has(coberturaId);
                    const esDental = isDentalCoberturaTipo(item?.cobertura_tipo);
                    const clienteInfo = item?.cliente_info;
                    const anioItem = item?.ano_cobertura;
                    const grupoIdNavegar =
                      item?.grupo_familiar_id || grupoFamiliarId;

                    let nombreCliente = "-";
                    if (clienteInfo && typeof clienteInfo === "object") {
                      nombreCliente =
                        clienteInfo.nombre_completo ||
                        `${clienteInfo.primer_nombre || ""} ${clienteInfo.apellidos || ""}`.trim() ||
                        "-";
                    }

                    return (
                      <React.Fragment key={coberturaId}>
                        <tr
                          className={`hcc-row--clickable${esDental ? " hcc-row--dental" : ""}${
                            isExpanded ? " hcc-row--expanded" : ""
                          }`}
                          onClick={() => toggleFila(coberturaId)}
                        >
                          <td
                            className="text-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFila(coberturaId);
                            }}
                          >
                            {isExpanded ? (
                              <FaChevronDown className="text-primary" />
                            ) : (
                              <FaChevronRight className="text-muted" />
                            )}
                          </td>
                          <td>{renderBadgeProducto(item)}</td>
                          <td>
                            <strong>{item?.codigo_poliza || "-"}</strong>
                          </td>
                          <td>
                            <div className="fw-semibold">{nombreCliente}</div>
                            {item?.parentesco?.toUpperCase() === "TOMADOR" && (
                              <Badge bg="warning" text="dark" className="mt-1" style={{ fontSize: "0.62rem" }}>
                                TOMADOR
                              </Badge>
                            )}
                          </td>
                          <td>{item?.parentesco || "-"}</td>
                          <td>{item?.plan || "-"}</td>
                          <td>{formatearFecha(item?.fecha_cancelacion)}</td>
                          <td>{formatearFecha(item?.fecha_retiro)}</td>
                          <td>
                            <span className={badgeEstadoClase(item?.cobertura_definida)}>
                              {item?.cobertura_definida || "-"}
                            </span>
                          </td>
                          <td>{item?.motivo_cancelacion || "-"}</td>
                          <td>{item?.motivo_retiro || "-"}</td>
                          <td>
                            <small className="text-muted">{item?.nota_cancel || "-"}</small>
                          </td>
                          <td>
                            <small className="text-muted">{item?.nota_retiro || "-"}</small>
                          </td>
                          <td>
                            <Badge bg="secondary" className="hcc-badge-origen">
                              {item?.accion_origen || "N/A"}
                            </Badge>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {grupoIdNavegar && anioItem ? (
                              <Button
                                variant="link"
                                size="sm"
                                className="hcc-link-nav p-0"
                                onClick={() => {
                                  onClose?.();
                                  navigate(
                                    `/grupo_familiar/${grupoIdNavegar}?anio=${anioItem}`
                                  );
                                }}
                              >
                                Ver grupo en {anioItem}
                              </Button>
                            ) : (
                              <span className="text-muted small">—</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={15} style={{ padding: 0, border: "none" }}>
                              <div className="hcc-expand-panel">
                                {renderCoberturaCompleta(item)}

                                {clienteInfo && (
                                  <div className="mt-3">
                                    <div className="hcc-detail-card">
                                      <div className="hcc-detail-card__header hcc-detail-card__header--client">
                                        <i className="fas fa-user me-2" aria-hidden="true" />
                                        Información del cliente
                                      </div>
                                      <div className="hcc-detail-card__body">
                                        {renderClienteInfo(clienteInfo)}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="hcc-modal__footer d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div className="hcc-audit">
          {(() => {
            const infoAuditoria = obtenerInfoAuditoria();
            if (!infoAuditoria || !infoAuditoria.tieneInfo) {
              return (
                <div className="d-flex align-items-center gap-2">
                  <i className="fas fa-info-circle" aria-hidden="true" />
                  <span>Información de auditoría no disponible</span>
                </div>
              );
            }

            return (
              <div className="d-flex align-items-center flex-wrap gap-3">
                {infoAuditoria.usuario && infoAuditoria.usuario !== "Sistema" && (
                  <div className="d-flex align-items-center">
                    <i className="fas fa-user me-1" style={{ color: "#1a365d" }} aria-hidden="true" />
                    <span>
                      <strong>Procesado por:</strong> {infoAuditoria.usuario}
                    </span>
                  </div>
                )}
                {infoAuditoria.fecha && (
                  <div className="d-flex align-items-center">
                    <i className="fas fa-clock me-1" style={{ color: "#64748b" }} aria-hidden="true" />
                    <span>
                      <strong>Fecha y hora:</strong> {formatearFechaHora(infoAuditoria.fecha)}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        <Button variant="secondary" className="hcc-btn-close-modal" onClick={onClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default HistorialCoberturasCanceladasModal;

