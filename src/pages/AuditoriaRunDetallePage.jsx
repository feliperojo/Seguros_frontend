// pages/AuditoriaRunDetallePage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Table, Button, Badge, Alert, Spinner, Form, Modal } from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import {
  FaSort,
  FaSortUp,
  FaSortDown,
  FaFileAlt,
  FaComment,
  FaTasks,
  FaHistory,
  FaExclamationTriangle,
  FaDollarSign,
} from "react-icons/fa";
import { getRunReporte, updateItem, getRun } from "../services/auditoriasService";
import { fetchCompanies } from "../services/companies";
import RequerimientosCoberturaModal from "../components/RequerimientosCoberturaModal";
import Pagination from "../components/Pagination";
import useToast from "../hooks/useToast";
import NuevaTareaAuditoriaModal from "../components/Tareas/NuevaTareaAuditoriaModal";
import HistorialTareasAuditoriaModal from "../components/Tareas/HistorialTareasAuditoriaModal";
import { getItemTasks, listTasks } from "../services/auditoriasTasksService";
import apiRequest from "../services/api";
import {
  agruparPagosPorMesEnAnio,
  indicadorMorosidadPagosPorMes,
  PAGOS_INFORME_MONTH_ABBR,
} from "../utils/pagosMorosidad";

/**
 * Estados de auditoría permitidos
 */
const AUDIT_STATUSES = [
  { value: "PENDIENTE", label: "Pendiente", variant: "warning" },
  { value: "OK", label: "OK", variant: "success" },
  { value: "NOVEDAD", label: "Novedad", variant: "warning" },
  { value: "PERDIDA", label: "Perdida", variant: "danger" },
  { value: "SOLUCIONADO", label: "Solucionado", variant: "info" },
];

/**
 * Estados que requieren comentario obligatorio
 */
const STATUSES_REQUIRING_COMMENT = ["NOVEDAD", "PERDIDA"];

/**
 * Orden del reporte en el cliente: el API suele devolver 422 para varios `sort_by`.
 * `filters.sort_by` / `sort_dir` solo afectan el orden en pantalla (página actual).
 */
const parseDateMs = (v) => {
  if (v == null || v === "") return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

const compareDate = (a, b, getv) => {
  const ta = parseDateMs(getv(a));
  const tb = parseDateMs(getv(b));
  if (ta == null && tb == null) return 0;
  if (ta == null) return 1;
  if (tb == null) return -1;
  return ta - tb;
};

const PAGO_ESTADO_ORDEN = { pendiente: 0, procesando: 1, pagado: 2 };

/** Run anterior (mismo tipo): API envía prev_no_ok, prev_audit_status, prev_periodo, prev_run_id */
const filaPendienteAuditoriaAnterior = (row) => {
  const periodo = row?.prev_periodo;
  const tienePeriodo = periodo != null && String(periodo).trim() !== "";
  return row?.prev_no_ok === true && tienePeriodo;
};

const tituloPendienteAuditoriaAnterior = (row) => {
  if (!filaPendienteAuditoriaAnterior(row)) return undefined;
  const st = row.prev_audit_status ?? "—";
  const per = row.prev_periodo ?? "";
  return `Pendiente de auditoría anterior: ${st} (${per})`;
};

const buildPagoRowResolver = (includePagosEnabled, pagosPorEntidad) => (c) => {
  if (!includePagosEnabled) return null;
  const coberturaId = c?.cobertura_id ?? c?.id ?? null;
  const clienteId = c?.cliente_id ?? null;
  const codigoPoliza = c?.codigo_poliza ? String(c.codigo_poliza).trim() : "";
  if (coberturaId != null && pagosPorEntidad[`cobertura:${coberturaId}`]) {
    return pagosPorEntidad[`cobertura:${coberturaId}`];
  }
  if (clienteId != null && pagosPorEntidad[`cliente:${clienteId}`]) {
    return pagosPorEntidad[`cliente:${clienteId}`];
  }
  if (codigoPoliza && pagosPorEntidad[`poliza:${codigoPoliza}`]) {
    return pagosPorEntidad[`poliza:${codigoPoliza}`];
  }
  return null;
};

/** Pagos del GET listado que corresponden a la misma cobertura/cliente/póliza que la fila del reporte. */
const filterPagosListForCoberturaRow = (list, cobertura) => {
  if (!Array.isArray(list) || !cobertura) return [];
  const cid = cobertura.cobertura_id ?? cobertura.id ?? null;
  const clid = cobertura.cliente_id ?? null;
  const codigoPoliza = cobertura.codigo_poliza ? String(cobertura.codigo_poliza).trim() : "";
  return list.filter((p) => {
    const pCob = p?.cobertura?.id ?? p?.cobertura_id ?? null;
    const pCli = p?.cliente?.id ?? p?.cliente_id ?? null;
    const pCodRaw = p?.cobertura?.codigo_poliza ?? p?.codigo_poliza ?? null;
    const pCod = pCodRaw != null ? String(pCodRaw).trim() : "";
    if (cid != null && pCob != null && Number(pCob) === Number(cid)) return true;
    if (clid != null && pCli != null && Number(pCli) === Number(clid)) return true;
    if (codigoPoliza && pCod && pCod === codigoPoliza) return true;
    return false;
  });
};

/** Meses abreviados (misma convención que `PagosInforme` / cartera). */
const pagoEstadoBadgeTonePagosInforme = (estado) => {
  const e = (estado || "").toLowerCase();
  if (e === "pagado") return "success";
  if (e === "pendiente") return "warning";
  if (e === "cancelado") return "danger";
  if (e === "procesando") return "warning";
  return "secondary";
};

/**
 * Construye los query params desde el estado de filtros
 */
const buildQueryParams = (filters) => {
  const params = {};
  
  if (filters.page) params.page = filters.page;
  if (filters.per_page) params.per_page = filters.per_page;
  if (filters.compania_id) params.compania_id = filters.compania_id;
  const gfFilter = filters.grupo_familiar_id != null ? String(filters.grupo_familiar_id).trim() : "";
  if (gfFilter) params.grupo_familiar_id = gfFilter;
  if (filters.audit_status) params.audit_status = filters.audit_status;
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;
  if (filters.search) params.search = filters.search;
  // sort_by / sort_dir: ordenación solo en cliente (ver coberturasOrdenCliente)

  return params;
};

/**
 * Formatea una fecha para mostrar
 */
const formatDate = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateString;
  }
};

/**
 * Formatea fecha y hora para mostrar
 */
const formatDateTime = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};

/**
 * Periodo del run (YYYY-MM) → etiqueta en español, p. ej. "julio de 2026".
 */
const formatPeriodoRunEtiqueta = (yyyyMm) => {
  if (!yyyyMm || typeof yyyyMm !== "string") return null;
  const s = yyyyMm.trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  const [ys, ms] = s.split("-");
  const y = Number(ys, 10);
  const mo = Number(ms, 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  try {
    const d = new Date(y, mo - 1, 1);
    const raw = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  } catch {
    return s;
  }
};

/**
 * Texto legible para fecha de pago de un pago generado (evita desfaces TZ en "YYYY-MM-DD").
 */
const formatPagoFechaMostrar = (fechaPagoRaw) => {
  if (fechaPagoRaw == null || fechaPagoRaw === "") return null;
  const s = String(fechaPagoRaw).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  return formatDate(s);
};

const diaDelMesDesdeFechaPago = (fechaPagoRaw) => {
  if (fechaPagoRaw == null || fechaPagoRaw === "") return null;
  const s = String(fechaPagoRaw).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const day = parseInt(m[3], 10);
    return Number.isFinite(day) ? day : null;
  }
  try {
    const date = new Date(s);
    if (!Number.isNaN(date.getTime())) return date.getDate();
  } catch {
    /* ignore */
  }
  return null;
};

/**
 * Formatea un valor monetario
 */
const formatCurrency = (value) => {
  if (!value && value !== 0) return "-";
  try {
    return new Intl.NumberFormat("es-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return value;
  }
};

/**
 * Columnas ordenables permitidas
 */
const SORTABLE_COLUMNS = {
  fecha_activacion: "fecha_activacion",
  cliente: "cliente",
  codigo_poliza: "codigo_poliza",
  grupo_familiar_id: "grupo_familiar_id",
  /** Pagos asociados al ítem (ordenación solo en cliente; ver coberturasOrdenCliente) */
  fecha_pago: "fecha_pago",
  pago_estado: "pago_estado",
  precio: "precio",
  req_pendientes: "req_pendientes",
  req_total: "req_total",
};

/** Convierte valores típicos de API a boolean (evita Boolean("false") === true). */
const toBool = (v) => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v === null || v === undefined || v === "") return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "si" || s === "sí") return true;
    if (s === "false" || s === "0" || s === "no") return false;
  }
  return Boolean(v);
};

/**
 * Normaliza respuestas del GET run: { data: { run, metrics, … } }, { data: run }, { run } o el run plano.
 */
const normalizeRunPayload = (raw) => {
  if (!raw || typeof raw !== "object") return raw;
  let node = raw;
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    node = raw.data;
  }
  if (node.run && typeof node.run === "object") {
    return node.run;
  }
  if (raw.run && typeof raw.run === "object") return raw.run;
  return node;
};

/**
 * Nombre legible del tipo / fuente (p. ej. tipo de póliza o nombre del tipo de auditoría configurado).
 * No usa solo el código legacy string en audit_type para evitar duplicar el badge "SHERPA", etc.
 */
const resolveTipoPolizaTitulo = (run) => {
  if (!run || typeof run !== "object") return null;
  const at = run.audit_type;
  if (at && typeof at === "object") {
    const n = at.nombre || at.name || at.label;
    if (n != null && String(n).trim()) return String(n).trim();
  }
  const tipoRaw = run.tipo_poliza;
  if (tipoRaw && typeof tipoRaw === "object") {
    const tn = tipoRaw.nombre || tipoRaw.name || tipoRaw.label;
    if (tn != null && String(tn).trim()) return String(tn).trim();
  }
  const direct = [
    run.tipo_poliza_nombre,
    typeof tipoRaw === "string" ? tipoRaw : null,
    run.audit_type_nombre,
    run.audit_type_name,
    run.nombre_tipo_auditoria,
    run.audit_type_label,
  ];
  for (const d of direct) {
    if (d != null && String(d).trim()) return String(d).trim();
  }
  return null;
};

const resolveItemIdFromRow = (c) =>
  c?.item_id || c?.auditoria_item_id || c?.audit_item_id || c?.id || null;

/** Clave estable para UI de tareas cuando no hay item_id (usa cobertura/cliente). */
const taskRowStorageKey = (c) => {
  if (c?.cobertura_id != null) return `cobertura:${c.cobertura_id}`;
  if (c?.cliente_id != null) return `cliente:${c.cliente_id}`;
  return null;
};

const inferItemIdFromTask = (t) =>
  t?.item_id ??
  t?.auditoria_item_id ??
  t?.audit_item_id ??
  t?.item?.id ??
  t?.audit_item?.id ??
  null;

const taskMatchesCoberturaRow = (t, cobertura) => {
  const cid = cobertura?.cobertura_id;
  const clid = cobertura?.cliente_id;
  if (cid != null) {
    const tc =
      t?.cobertura_id ??
      t?.cobertura?.id ??
      t?.item?.cobertura_id ??
      t?.item?.cobertura?.id;
    if (tc != null && Number(tc) === Number(cid)) return true;
  }
  if (clid != null) {
    const tcl =
      t?.cliente_id ??
      t?.cliente?.id ??
      t?.item?.cliente_id ??
      t?.item?.cliente?.id;
    if (tcl != null && Number(tcl) === Number(clid)) return true;
  }
  return false;
};

const AuditoriaRunDetallePage = () => {
  const { runId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  // Estado de datos del run
  const [runInfo, setRunInfo] = useState(null);
  const [loadingRunInfo, setLoadingRunInfo] = useState(false);
  
  // Estado de datos
  const [coberturas, setCoberturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({ page: 1, per_page: 25, total: 0, last_page: 1 });

  // Pagos relacionados (cuando el run fue creado con include_pagos)
  const [pagosPorEntidad, setPagosPorEntidad] = useState({}); // { entityKey: pago }
  /** Listado completo GET pagos (solo si el run incluye pagos); sirve para mora/riesgo y modal. */
  const [pagosListadoCompleto, setPagosListadoCompleto] = useState([]);
  const [loadingPagos, setLoadingPagos] = useState(false);
  const [savingPagoId, setSavingPagoId] = useState(null);
  
  // Estado de filtros
  const [filters, setFilters] = useState({
    page: 1,
    per_page: 25,
    compania_id: "",
    grupo_familiar_id: "",
    audit_status: "",
    date_from: "",
    date_to: "",
    search: "",
    sort_by: "",
    sort_dir: "",
  });
  
  // Estado de filtros temporales
  const [tempFilters, setTempFilters] = useState({
    compania_id: "",
    grupo_familiar_id: "",
    audit_status: "",
    date_from: "",
    date_to: "",
    search: "",
  });
  
  // Estado para compañías
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  
  // Estado para el modal de requerimientos
  const [showModal, setShowModal] = useState(false);
  const [selectedCobertura, setSelectedCobertura] = useState(null);
  
  // Estado para edición de status
  const [editingItem, setEditingItem] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusForm, setStatusForm] = useState({
    status: "",
    comment: "",
  });
  const [savingStatus, setSavingStatus] = useState(false);
  /** entityId (cobertura_id | cliente_id) mientras se aplica marcar OK desde la tabla */
  const [quickOkEntityId, setQuickOkEntityId] = useState(null);
  
  // Estado para tareas de auditoría
  const [showNuevaTareaModal, setShowNuevaTareaModal] = useState(false);
  const [selectedItemForTask, setSelectedItemForTask] = useState(null);
  const [tareasPorItem, setTareasPorItem] = useState({}); // { itemId: [tareas] }
  const [loadingTareas, setLoadingTareas] = useState({}); // { itemId: boolean }
  const [itemsConTareasExpandidos, setItemsConTareasExpandidos] = useState({}); // { itemId: boolean }
  const [historialModalPayload, setHistorialModalPayload] = useState(null);
  /** Modal listado de pagos del cliente: { cobertura, items, loading, error } | null */
  const [pagosClienteVista, setPagosClienteVista] = useState(null);

  // AbortController para cancelar peticiones
  const abortControllerRef = useRef(null);
  /** Cache: `${runId}:${taskRowStorageKey}` -> audit item id */
  const auditItemIdByRowKeyRef = useRef(new Map());
  
  // Cargar información del run al montar
  useEffect(() => {
    if (!runId) return;
    
    const loadRunInfo = async () => {
      setLoadingRunInfo(true);
      try {
        const runData = await getRun(runId);
        setRunInfo(normalizeRunPayload(runData));
      } catch (err) {
        console.error("Error al cargar información del run:", err);
        // Si falla, al menos establecer un objeto básico
        setRunInfo({ id: runId, nombre: `Auditoría #${runId}`, audit_type: "SHERPA" });
      } finally {
        setLoadingRunInfo(false);
      }
    };
    
    loadRunInfo();
  }, [runId]);

  const includePagosFromRun = toBool(
    runInfo?.include_pagos ??
      runInfo?.includePagos ??
      runInfo?.pagos_incluidos ??
      runInfo?.pagosIncluidos ??
      runInfo?.with_pagos ??
      runInfo?.withPagos
  );
  const includePagosFromMeta = toBool(
    meta?.include_pagos ??
      meta?.includePagos ??
      meta?.pagos_incluidos ??
      meta?.pagosIncluidos ??
      meta?.with_pagos ??
      meta?.withPagos
  );
  const includePagosEnabled = includePagosFromRun || includePagosFromMeta;

  const periodoRunRaw =
    runInfo?.periodo ??
    runInfo?.period ??
    runInfo?.periodo_run ??
    runInfo?.periodoRun ??
    runInfo?.mes ??
    runInfo?.month ??
    meta?.periodo ??
    meta?.period ??
    meta?.periodo_run ??
    meta?.periodoRun ??
    meta?.mes ??
    meta?.month ??
    null;
  const periodoRun =
    typeof periodoRunRaw === "string" && /^\d{4}-\d{2}$/.test(periodoRunRaw.trim())
      ? periodoRunRaw.trim()
      : null; // "YYYY-MM"

  const periodoRunEtiqueta = periodoRun
    ? formatPeriodoRunEtiqueta(periodoRun) || periodoRun
    : null;

  const tipoPolizaTitulo = useMemo(() => resolveTipoPolizaTitulo(runInfo), [runInfo]);

  const loadPagosDelRun = useCallback(async () => {
    if (!includePagosEnabled) {
      setPagosListadoCompleto([]);
      setPagosPorEntidad({});
      return;
    }

    setLoadingPagos(true);
    try {
      const pagos = await apiRequest("cobertura/pagos/listado", "GET");
      const list = Array.isArray(pagos) ? pagos : pagos?.data || [];
      setPagosListadoCompleto(Array.isArray(list) ? list : []);

      let candidatos = list;
      if (periodoRun) {
        const prefix = `${periodoRun}-`;
        candidatos = list.filter(
          (p) => typeof p?.fecha_pago === "string" && p.fecha_pago.startsWith(prefix)
        );
      }

      // Mapear por entidad: prioridad cobertura_id, luego cliente_id, luego código póliza.
      const map = {};
      for (const p of candidatos) {
        const coberturaId = p?.cobertura?.id || p?.cobertura_id || null;
        const clienteId = p?.cliente?.id || p?.cliente_id || null;
        const codigoPoliza = p?.cobertura?.codigo_poliza || p?.codigo_poliza || null;
        if (coberturaId != null) map[`cobertura:${coberturaId}`] = p;
        if (clienteId != null) map[`cliente:${clienteId}`] = map[`cliente:${clienteId}`] || p;
        if (codigoPoliza) {
          const key = `poliza:${String(codigoPoliza).trim()}`;
          map[key] = map[key] || p;
        }
      }
      setPagosPorEntidad(map);
    } catch (err) {
      console.error("Error al cargar pagos del mes para auditoría:", err);
      setPagosListadoCompleto([]);
      setPagosPorEntidad({});
    } finally {
      setLoadingPagos(false);
    }
  }, [includePagosEnabled, periodoRun]);

  useEffect(() => {
    void loadPagosDelRun();
  }, [loadPagosDelRun]);

  const handlePagoEstadoChange = async (pago, nuevoEstado) => {
    if (!pago?.id) return;
    setSavingPagoId(pago.id);
    try {
      const payload = {
        estado: nuevoEstado,
        portal: pago?.portal ?? false,
      };
      await apiRequest(`cobertura/pagos/${pago.id}`, "PUT", payload);
      setPagosPorEntidad((prev) => {
        const next = { ...prev };
        // Actualizar en todos los keys que apunten al mismo pago
        Object.keys(next).forEach((k) => {
          if (next[k]?.id === pago.id) next[k] = { ...next[k], ...payload };
        });
        return next;
      });
      setPagosListadoCompleto((prev) =>
        Array.isArray(prev)
          ? prev.map((row) => (row?.id === pago.id ? { ...row, ...payload } : row))
          : prev
      );
      if (toast && typeof toast.showSuccess === "function") toast.showSuccess("Pago actualizado correctamente");
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Error al actualizar el pago";
      if (toast && typeof toast.showError === "function") toast.showError(msg);
      console.error("Error al actualizar pago desde auditoría:", err);
    } finally {
      setSavingPagoId(null);
    }
  };

  const handleOpenPagosCliente = useCallback(
    async (cobertura) => {
      setPagosClienteVista({ cobertura, items: [], loading: true, error: null });
      try {
        const pagos = await apiRequest("cobertura/pagos/listado", "GET");
        const list = Array.isArray(pagos) ? pagos : pagos?.data || [];
        const arr = Array.isArray(list) ? list : [];
        const items = filterPagosListForCoberturaRow(arr, cobertura).sort((a, b) => {
          const ta = parseDateMs(a?.fecha_pago) ?? 0;
          const tb = parseDateMs(b?.fecha_pago) ?? 0;
          return tb - ta;
        });
        setPagosClienteVista({ cobertura, items, loading: false, error: null });
      } catch (err) {
        const msg = err.response?.data?.message || err.message || "Error al cargar los pagos";
        setPagosClienteVista({ cobertura, items: [], loading: false, error: msg });
        if (toast && typeof toast.showError === "function") toast.showError(msg);
        console.error("Error al cargar pagos del cliente:", err);
      }
    },
    [toast]
  );

  useEffect(() => {
    auditItemIdByRowKeyRef.current = new Map();
  }, [runId]);

  const resolveAuditItemIdWithFallback = useCallback(
    async (cobertura) => {
      const direct = resolveItemIdFromRow(cobertura);
      if (direct) return direct;

      const rowKey = taskRowStorageKey(cobertura);
      if (!runId || !rowKey) return null;

      const cacheKey = `${runId}:${rowKey}`;
      const cached = auditItemIdByRowKeyRef.current.get(cacheKey);
      if (cached) return cached;

      const params = { run_id: runId, per_page: 100 };
      if (cobertura?.cobertura_id != null) params.cobertura_id = cobertura.cobertura_id;
      else if (cobertura?.cliente_id != null) params.cliente_id = cobertura.cliente_id;
      else return null;

      const response = await listTasks(params);
      const raw = response?.data ?? response ?? [];
      const arr = Array.isArray(raw) ? raw : [];
      const matched = arr.filter((t) => taskMatchesCoberturaRow(t, cobertura));
      for (const t of matched) {
        const inferred = inferItemIdFromTask(t);
        if (inferred) {
          auditItemIdByRowKeyRef.current.set(cacheKey, inferred);
          return inferred;
        }
      }
      return null;
    },
    [runId]
  );

  const loadTasksForCoberturaRow = useCallback(
    async (cobertura) => {
      const rowKey = taskRowStorageKey(cobertura);
      const directItemId = resolveItemIdFromRow(cobertura);
      const taskKey = directItemId || rowKey;
      if (!taskKey) return [];

      setLoadingTareas((prev) => ({ ...prev, [taskKey]: true }));
      try {
        let tareas = [];

        if (directItemId) {
          try {
            tareas = await getItemTasks(directItemId);
          } catch (e) {
            console.warn("getItemTasks falló, se intentará listTasks:", e);
            tareas = [];
          }
        }

        if (!Array.isArray(tareas) || tareas.length === 0) {
          const params = { run_id: runId, per_page: 100 };
          if (cobertura?.cobertura_id != null) params.cobertura_id = cobertura.cobertura_id;
          else if (cobertura?.cliente_id != null) params.cliente_id = cobertura.cliente_id;
          else {
            setTareasPorItem((prev) => ({ ...prev, [taskKey]: [] }));
            return [];
          }

          const response = await listTasks(params);
          const raw = response?.data ?? response ?? [];
          const arr = Array.isArray(raw) ? raw : [];
          tareas = arr.filter((t) => taskMatchesCoberturaRow(t, cobertura));
        }

        setTareasPorItem((prev) => ({ ...prev, [taskKey]: tareas }));

        // Si encontramos item_id en las tareas, cachearlo para endpoints legacy
        if (rowKey) {
          const cacheKey = `${runId}:${rowKey}`;
          for (const t of tareas) {
            const inferred = inferItemIdFromTask(t);
            if (inferred) {
              auditItemIdByRowKeyRef.current.set(cacheKey, inferred);
              break;
            }
          }
        }

        return tareas;
      } finally {
        setLoadingTareas((prev) => ({ ...prev, [taskKey]: false }));
      }
    },
    [runId]
  );
  
  // Cargar compañías al montar
  useEffect(() => {
    const loadCompanies = async () => {
      setLoadingCompanies(true);
      try {
        const data = await fetchCompanies();
        setCompanies(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error al cargar compañías:", err);
      } finally {
        setLoadingCompanies(false);
      }
    };
    loadCompanies();
  }, []);
  
  // Cargar datos cuando cambian los filtros
  useEffect(() => {
    if (!runId) return;
    
    let isMounted = true;
    let currentAbortController = null;
    
    // Cancelar petición anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Crear nuevo AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    currentAbortController = abortController;
    
    setLoading(true);
    setError(null);
    
    const loadData = async () => {
      try {
        const params = buildQueryParams(filters);
        const response = await getRunReporte(runId, params, abortController.signal);
        
        if (!abortController.signal.aborted && isMounted && currentAbortController === abortControllerRef.current) {
          if (Array.isArray(response)) {
            setCoberturas(response);
            setMeta({ page: 1, per_page: response.length, total: response.length, last_page: 1 });
          } else {
            setCoberturas(response?.data || []);
            setMeta(response?.meta || { page: 1, per_page: 25, total: 0, last_page: 1 });
          }
          setError(null);
        }
      } catch (err) {
        if (err.message === "Petición cancelada" || err.name === "AbortError") {
          return;
        }
        
        if (isMounted && currentAbortController === abortControllerRef.current) {
          const errorMessage = err.response?.data?.message || err.message || "Error al cargar el reporte";
          setError(errorMessage);
          // Usar toast de forma segura sin incluirlo en dependencias
          if (toast && typeof toast.showError === 'function') {
            toast.showError(errorMessage);
          }
          console.error("Error al cargar reporte:", err);
          setCoberturas([]);
          setMeta({ page: 1, per_page: 25, total: 0, last_page: 1 });
        }
      } finally {
        if (isMounted && !abortController.signal.aborted && currentAbortController === abortControllerRef.current) {
          setLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
      if (currentAbortController) {
        currentAbortController.abort();
      }
    };
    // Dependencias: sin sort_by/sort_dir (orden solo en cliente).
  }, [
    runId,
    filters.page,
    filters.per_page,
    filters.compania_id,
    filters.grupo_familiar_id,
    filters.audit_status,
    filters.date_from,
    filters.date_to,
    filters.search,
  ]);
  
  // Sincronizar filtros temporales con filtros activos (solo cuando cambian los filtros de búsqueda, no paginación)
  const prevFiltersRef = useRef({
    compania_id: "",
    grupo_familiar_id: "",
    audit_status: "",
    date_from: "",
    date_to: "",
    search: "",
  });
  
  useEffect(() => {
    const currentFilterValues = {
      compania_id: filters.compania_id,
      grupo_familiar_id: filters.grupo_familiar_id,
      audit_status: filters.audit_status,
      date_from: filters.date_from,
      date_to: filters.date_to,
      search: filters.search,
    };
    
    const filtersChanged = 
      prevFiltersRef.current.compania_id !== currentFilterValues.compania_id ||
      prevFiltersRef.current.grupo_familiar_id !== currentFilterValues.grupo_familiar_id ||
      prevFiltersRef.current.audit_status !== currentFilterValues.audit_status ||
      prevFiltersRef.current.date_from !== currentFilterValues.date_from ||
      prevFiltersRef.current.date_to !== currentFilterValues.date_to ||
      prevFiltersRef.current.search !== currentFilterValues.search;
    
    if (filtersChanged) {
      setTempFilters(currentFilterValues);
      prevFiltersRef.current = currentFilterValues;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.compania_id, filters.grupo_familiar_id, filters.audit_status, filters.date_from, filters.date_to, filters.search]);
  
  // Manejar cambio de filtros temporales
  const handleTempFilterChange = (key, value) => {
    setTempFilters((prev) => ({ ...prev, [key]: value }));
  };
  
  // Aplicar filtros
  const handleApplyFilters = () => {
    setFilters((prev) => ({
      ...prev,
      ...tempFilters,
      page: 1,
    }));
  };
  
  // Limpiar filtros
  const handleClearFilters = () => {
    const clearedFilters = {
      compania_id: "",
      grupo_familiar_id: "",
      audit_status: "",
      date_from: "",
      date_to: "",
      search: "",
    };
    setTempFilters(clearedFilters);
    setFilters((prev) => ({
      ...prev,
      ...clearedFilters,
      page: 1,
    }));
  };
  
  // Manejar ordenamiento
  const handleSort = (column) => {
    if (!SORTABLE_COLUMNS[column]) return;
    
    setFilters((prev) => {
      const isSameColumn = prev.sort_by === column;
      // Pagos: primer clic suele buscar "más reciente / mayor" → empezar en desc
      const preferDescFirst = column === "fecha_pago" || column === "pago_estado";
      let nextDir = "asc";
      if (preferDescFirst) {
        if (!isSameColumn) nextDir = "desc";
        else nextDir = prev.sort_dir === "desc" ? "asc" : "desc";
      } else {
        nextDir = isSameColumn && prev.sort_dir === "asc" ? "desc" : "asc";
      }
      return {
        ...prev,
        sort_by: column,
        sort_dir: nextDir,
        page: 1,
      };
    });
  };
  
  // Manejar cambio de página
  const handlePageChange = (page) => {
    setFilters((prev) => ({ ...prev, page }));
  };
  
  // Manejar cambio de per_page
  const handlePerPageChange = (e) => {
    const perPage = parseInt(e.target.value, 10);
    setFilters((prev) => ({ ...prev, per_page: perPage, page: 1 }));
  };
  
  // Abrir modal de requerimientos
  const handleViewRequerimientos = (cobertura) => {
    setSelectedCobertura(cobertura);
    setShowModal(true);
  };
  
  // Cerrar modal
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCobertura(null);
  };
  
  // Abrir modal de edición de status
  const handleEditStatus = (cobertura) => {
    setEditingItem(cobertura);
    setStatusForm({
      status: cobertura.audit_status || "PENDIENTE",
      comment: cobertura.audit_comment || "",
    });
    setShowStatusModal(true);
  };
  
  // Cerrar modal de status
  const handleCloseStatusModal = () => {
    setShowStatusModal(false);
    setEditingItem(null);
    setStatusForm({ status: "", comment: "" });
  };
  
  /** Refresca la tabla del reporte con los filtros actuales (misma lógica que tras guardar en el modal). */
  const refreshReporteCoberturas = async () => {
    const params = buildQueryParams(filters);
    const response = await getRunReporte(runId, params);
    if (Array.isArray(response)) {
      setCoberturas(response);
      setMeta({ page: 1, per_page: response.length, total: response.length, last_page: 1 });
    } else {
      setCoberturas(response?.data || []);
      setMeta(response?.meta || { page: 1, per_page: 25, total: 0, last_page: 1 });
    }
  };

  /**
   * Atajo: marcar OK sin abrir el modal (mismo endpoint que "Guardar" con estado OK).
   * Solo aplica cuando el estado actual es PENDIENTE; otros estados siguen usando el modal.
   */
  const handleQuickOkFromTable = async (cobertura, checkboxEl) => {
    const entityId = cobertura.cobertura_id || cobertura.cliente_id;
    if (!entityId) {
      toast.showError("No se pudo identificar el ID de la entidad");
      if (checkboxEl) checkboxEl.checked = false;
      return;
    }
    setQuickOkEntityId(entityId);
    try {
      await updateItem(runId, entityId, { status: "OK" });
      toast.showSuccess("Estado actualizado exitosamente");
      try {
        await refreshReporteCoberturas();
      } catch (refreshError) {
        console.error("Error al refrescar datos después de marcar OK:", refreshError);
        setCoberturas((prev) =>
          prev.map((item) => {
            const itemId = item.cobertura_id || item.cliente_id;
            return itemId === entityId
              ? {
                  ...item,
                  audit_status: "OK",
                  audit_comment: item.audit_comment ?? null,
                  reviewed_at: new Date().toISOString(),
                }
              : item;
          })
        );
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Error al actualizar el estado";
      toast.showError(errorMessage);
      console.error("Error al marcar OK desde tabla:", err);
      if (checkboxEl) checkboxEl.checked = false;
    } finally {
      setQuickOkEntityId(null);
    }
  };

  // Guardar cambio de status
  const handleSaveStatus = async () => {
    if (!editingItem) return;
    
    // Validar comentario obligatorio
    if (STATUSES_REQUIRING_COMMENT.includes(statusForm.status) && !statusForm.comment?.trim()) {
      toast.showWarning("El comentario es obligatorio para este estado");
      return;
    }
    
    setSavingStatus(true);
    
    try {
      // Construir payload: comment solo si tiene valor o es requerido
      const payload = {
        status: statusForm.status,
      };
      
      // Incluir comment si tiene valor o si es requerido (aunque esté vacío, la validación previa lo evita)
      if (statusForm.comment?.trim()) {
        payload.comment = statusForm.comment.trim();
      } else if (STATUSES_REQUIRING_COMMENT.includes(statusForm.status)) {
        // Esto no debería pasar por la validación previa, pero por seguridad
        payload.comment = "";
      }
      
      // Usar el ID correcto según el target_type del run
      // Puede ser cobertura_id o cliente_id
      const entityId = editingItem.cobertura_id || editingItem.cliente_id;
      if (!entityId) {
        toast.showError("No se pudo identificar el ID de la entidad");
        return;
      }
      
      await updateItem(runId, entityId, payload);
      
      toast.showSuccess("Estado actualizado exitosamente");
      
      try {
        await refreshReporteCoberturas();
      } catch (refreshError) {
        console.error("Error al refrescar datos después de actualizar:", refreshError);
        const currentEntityId = editingItem.cobertura_id || editingItem.cliente_id;
        setCoberturas((prev) =>
          prev.map((item) => {
            const itemId = item.cobertura_id || item.cliente_id;
            return itemId === currentEntityId
              ? {
                  ...item,
                  audit_status: statusForm.status,
                  audit_comment: statusForm.comment || null,
                  reviewed_at: new Date().toISOString(),
                }
              : item;
          })
        );
      }
      
      handleCloseStatusModal();
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Error al actualizar el estado";
      toast.showError(errorMessage);
      console.error("Error al actualizar status:", err);
    } finally {
      setSavingStatus(false);
    }
  };
  
  // Obtener badge variant para status
  const getStatusBadgeVariant = (status) => {
    const statusObj = AUDIT_STATUSES.find((s) => s.value === status);
    return statusObj?.variant || "secondary";
  };
  
  // Renderizar icono de ordenamiento
  const renderSortIcon = (column) => {
    if (filters.sort_by !== column) {
      return <FaSort className="ms-1 text-muted" />;
    }
    return filters.sort_dir === "asc" ? (
      <FaSortUp className="ms-1" />
    ) : (
      <FaSortDown className="ms-1" />
    );
  };

  const getGrupoFamiliarId = useCallback((cobertura) => {
    const raw =
      cobertura?.grupo_familiar_id ??
      cobertura?.grupo_familiar?.id ??
      cobertura?.gf_id ??
      cobertura?.grupoFamiliarId ??
      cobertura?.grupoFamiliar?.id;
    if (raw === null || raw === undefined || raw === "") return null;
    return raw;
  }, []);

  /**
   * Refuerzo en cliente: si el endpoint del reporte no aplica `grupo_familiar_id` o `audit_status`,
   * aquí se ocultan filas que no coinciden (solo dentro del lote paginado actual).
   */
  const coberturasTrasFiltroGf = useMemo(() => {
    if (!Array.isArray(coberturas)) return coberturas;
    let rows = coberturas;

    const wantGf = String(filters.grupo_familiar_id ?? "").trim();
    if (wantGf) {
      rows = rows.filter((c) => {
        const gf = getGrupoFamiliarId(c);
        if (gf === null || gf === undefined || gf === "") return false;
        const nw = Number(wantGf);
        const ng = Number(gf);
        if (Number.isFinite(nw) && Number.isFinite(ng)) return nw === ng;
        return String(gf).trim() === wantGf;
      });
    }

    const wantAudit = String(filters.audit_status ?? "").trim();
    if (wantAudit) {
      const w = wantAudit.toUpperCase();
      rows = rows.filter((c) => {
        const raw =
          c?.audit_status ??
          c?.estado_auditoria ??
          c?.auditStatus ??
          c?.status_auditoria ??
          "PENDIENTE";
        return String(raw).trim().toUpperCase() === w;
      });
    }

    return rows;
  }, [coberturas, filters.grupo_familiar_id, filters.audit_status, getGrupoFamiliarId]);

  const gfFiltroActivo = String(filters.grupo_familiar_id ?? "").trim().length > 0;

  const coberturasOrdenCliente = useMemo(() => {
    if (!Array.isArray(coberturasTrasFiltroGf) || coberturasTrasFiltroGf.length === 0) {
      return coberturasTrasFiltroGf;
    }
    const sortBy = filters.sort_by || "";
    if (!sortBy) return coberturasTrasFiltroGf;

    const dir = filters.sort_dir === "asc" ? 1 : -1;
    const getPago = buildPagoRowResolver(includePagosEnabled, pagosPorEntidad);

    const compareGrupoFamiliar = (a, b) => {
      const ga = getGrupoFamiliarId(a);
      const gb = getGrupoFamiliarId(b);
      const na = Number(ga);
      const nb = Number(gb);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return String(ga ?? "").localeCompare(String(gb ?? ""), "es", { numeric: true, sensitivity: "base" });
    };

    const arr = [...coberturasTrasFiltroGf];
    arr.sort((a, b) => {
      switch (sortBy) {
        case "grupo_familiar_id":
          return compareGrupoFamiliar(a, b) * dir;
        case "fecha_activacion":
          return compareDate(a, b, (c) => c?.fecha_activacion) * dir;
        case "codigo_poliza":
          return (
            String(a?.codigo_poliza ?? "").localeCompare(String(b?.codigo_poliza ?? ""), "es", {
              numeric: true,
              sensitivity: "base",
            }) * dir
          );
        case "cliente":
          return (
            String(a?.cliente ?? "").localeCompare(String(b?.cliente ?? ""), "es", {
              numeric: true,
              sensitivity: "base",
            }) * dir
          );
        case "precio": {
          const pa = Number(a?.precio ?? 0);
          const pb = Number(b?.precio ?? 0);
          return (pa - pb) * dir;
        }
        case "req_pendientes": {
          const pa = Number(a?.req_pendientes ?? a?.req_pendiente ?? 0);
          const pb = Number(b?.req_pendientes ?? b?.req_pendiente ?? 0);
          const aOk = Number.isFinite(pa);
          const bOk = Number.isFinite(pb);
          if (!aOk && !bOk) return 0;
          if (!aOk) return 1 * dir;
          if (!bOk) return -1 * dir;
          return (pa - pb) * dir;
        }
        case "fecha_pago": {
          const pa = getPago(a);
          const pb = getPago(b);
          const ta = parseDateMs(pa?.fecha_pago);
          const tb = parseDateMs(pb?.fecha_pago);
          if (ta == null && tb == null) return 0;
          if (ta == null) return 1 * dir;
          if (tb == null) return -1 * dir;
          return (ta - tb) * dir;
        }
        case "pago_estado": {
          const pa = getPago(a);
          const pb = getPago(b);
          const oa = PAGO_ESTADO_ORDEN[String(pa?.estado ?? "").toLowerCase()] ?? 99;
          const ob = PAGO_ESTADO_ORDEN[String(pb?.estado ?? "").toLowerCase()] ?? 99;
          return (oa - ob) * dir;
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [
    coberturasTrasFiltroGf,
    filters.sort_by,
    filters.sort_dir,
    getGrupoFamiliarId,
    includePagosEnabled,
    pagosPorEntidad,
  ]);

  // Agrupamiento estable por GF (sin alterar el orden dentro de cada grupo).
  // Esto evita que integrantes del mismo grupo queden "regados" cuando el backend ordena por otras columnas.
  const coberturasAgrupadas = useMemo(() => {
    if (!Array.isArray(coberturasOrdenCliente) || coberturasOrdenCliente.length === 0) return [];

    // Si el usuario ordena por columnas distintas de GF, NO re-agrupamos por GF en cliente:
    // rompería el orden elegido para la página actual.
    const sortBy = filters.sort_by || "";
    if (
      sortBy &&
      sortBy !== "grupo_familiar_id" &&
      sortBy !== "gf" &&
      sortBy !== "grupoFamiliarId"
    ) {
      return coberturasOrdenCliente;
    }

    const withIndex = coberturasOrdenCliente.map((c, index) => ({
      c,
      index,
      gf: getGrupoFamiliarId(c),
    }));

    const compareGf = (a, b) => {
      const aMissing = a.gf === null;
      const bMissing = b.gf === null;
      if (aMissing && bMissing) return a.index - b.index;
      if (aMissing) return 1;
      if (bMissing) return -1;

      const aNum = typeof a.gf === "number" ? a.gf : Number(a.gf);
      const bNum = typeof b.gf === "number" ? b.gf : Number(b.gf);
      const aIsNum = Number.isFinite(aNum);
      const bIsNum = Number.isFinite(bNum);

      if (aIsNum && bIsNum) return aNum - bNum;

      const aStr = String(a.gf);
      const bStr = String(b.gf);
      return aStr.localeCompare(bStr, "es");
    };

    withIndex.sort((a, b) => {
      const gfCmp = compareGf(a, b);
      if (gfCmp !== 0) return gfCmp;
      return a.index - b.index;
    });

    return withIndex.map((x) => x.c);
  }, [coberturasOrdenCliente, getGrupoFamiliarId, filters.sort_by]);

  const indicadorMoraPorCoberturaKey = useMemo(() => {
    const map = new Map();
    if (!includePagosEnabled || !Array.isArray(pagosListadoCompleto) || pagosListadoCompleto.length === 0) {
      return map;
    }
    const seen = new Set();
    const filasReporte = Array.isArray(coberturasTrasFiltroGf) ? coberturasTrasFiltroGf : [];
    for (const c of filasReporte) {
      const entityId = c?.cobertura_id || c?.cliente_id;
      const k =
        entityId != null
          ? `id:${entityId}`
          : `pol:${String(c?.codigo_poliza ?? "").trim()}`;
      if (k === "pol:" || seen.has(k)) continue;
      seen.add(k);
      const filtered = filterPagosListForCoberturaRow(pagosListadoCompleto, c);
      const { porMes } = agruparPagosPorMesEnAnio(filtered, periodoRun);
      map.set(k, indicadorMorosidadPagosPorMes(porMes));
    }
    return map;
  }, [includePagosEnabled, pagosListadoCompleto, coberturasTrasFiltroGf, periodoRun]);
  
  return (
    <div className="container-fluid py-4">
      <Helmet>
        <title>
          {[
            tipoPolizaTitulo ||
              (typeof runInfo?.audit_type === "string" ? runInfo.audit_type : null) ||
              "Auditoría",
            periodoRunEtiqueta,
            runId != null ? `#${runId}` : null,
          ]
            .filter(Boolean)
            .join(" · ") + " - Detalle"}
        </title>
      </Helmet>
      
      <div className="card border-0 shadow-sm mb-4 overflow-hidden">
        <div className="border-start border-primary border-4 bg-white">
          <div className="px-4 py-4">
            {loadingRunInfo ? (
              <div className="d-flex align-items-center gap-3 py-2">
                <Spinner animation="border" size="sm" role="status" />
                <span className="text-muted">Cargando información del proceso…</span>
              </div>
            ) : runInfo ? (
              <div className="d-flex flex-column flex-xl-row justify-content-between align-items-stretch align-items-xl-center gap-4">
                <div className="min-w-0 flex-grow-1">
                  <div className="d-flex flex-column flex-md-row align-items-stretch gap-3 gap-md-4">
                    {runInfo.audit_type && (
                      <div
                        className="d-flex flex-column rounded-3 border border-light-subtle bg-light px-3 py-3 flex-grow-1 flex-md-grow-0"
                        style={{ minWidth: 0, flexBasis: "clamp(10rem, 32vw, 18rem)" }}
                      >
                        <span
                          className="text-uppercase text-muted fw-semibold mb-2 d-block"
                          style={{ fontSize: "0.68rem", letterSpacing: "0.12em" }}
                        >
                          Tipo de auditoría
                        </span>
                        <Badge
                          bg={
                            (typeof runInfo.audit_type === "object"
                              ? runInfo.audit_type?.codigo
                              : runInfo.audit_type) === "SHERPA"
                              ? "primary"
                              : "info"
                          }
                          className="px-3 py-2 fw-semibold rounded-pill align-self-start mt-auto"
                          style={{ fontSize: "0.8rem" }}
                        >
                          {typeof runInfo.audit_type === "object"
                            ? runInfo.audit_type?.nombre || runInfo.audit_type?.codigo || "—"
                            : runInfo.audit_type}
                        </Badge>
                      </div>
                    )}
                    {periodoRunEtiqueta && (
                      <div
                        className="d-flex flex-column rounded-3 border border-light-subtle bg-light px-3 py-3 flex-grow-1"
                        style={{ minWidth: 0, flex: "1 1 clamp(10rem, 40vw, 22rem)" }}
                      >
                        <span
                          className="text-uppercase text-muted fw-semibold mb-2 d-block"
                          style={{ fontSize: "0.68rem", letterSpacing: "0.12em" }}
                        >
                          Periodo de trabajo
                        </span>
                        <div className="d-flex flex-wrap align-items-baseline column-gap-2 row-gap-1 mt-auto">
                          <span className="fw-semibold text-body fs-5 lh-sm">
                            {periodoRunEtiqueta}
                          </span>
                          {periodoRun && (
                            <span className="text-muted small font-monospace">{periodoRun}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 align-self-start align-self-xl-center">
                  <Button
                    variant="outline-secondary"
                    className="px-3 fw-semibold"
                    onClick={() => navigate("/auditorias")}
                  >
                    Volver a Auditorías
                  </Button>
                </div>
              </div>
            ) : (
              <div className="d-flex flex-column flex-xl-row justify-content-between align-items-stretch align-items-xl-center gap-4">
                <div className="min-w-0 flex-grow-1">
                  {periodoRunEtiqueta && (
                    <div
                      className="d-flex flex-column rounded-3 border border-light-subtle bg-light px-3 py-3"
                      style={{ minWidth: 0, maxWidth: "22rem" }}
                    >
                      <span
                        className="text-uppercase text-muted fw-semibold mb-2 d-block"
                        style={{ fontSize: "0.68rem", letterSpacing: "0.12em" }}
                      >
                        Periodo de trabajo
                      </span>
                      <div className="d-flex flex-wrap align-items-baseline column-gap-2 row-gap-1">
                        <span className="fw-semibold text-body fs-5 lh-sm">
                          {periodoRunEtiqueta}
                        </span>
                        {periodoRun && (
                          <span className="text-muted small font-monospace">{periodoRun}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 align-self-start align-self-xl-center">
                  <Button
                    variant="outline-secondary"
                    className="px-3 fw-semibold"
                    onClick={() => navigate("/auditorias")}
                  >
                    Volver a Auditorías
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Filtros */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0">Filtros</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {/* Búsqueda */}
            <div className="col-md-3">
              <Form.Label>Búsqueda</Form.Label>
              <Form.Control
                type="text"
                placeholder="Cliente o Numero ID..."
                value={tempFilters.search}
                onChange={(e) => handleTempFilterChange("search", e.target.value)}
              />
            </div>
            
            {/* Compañía */}
            <div className="col-md-2">
              <Form.Label>Compañía</Form.Label>
              <Form.Select
                value={tempFilters.compania_id}
                onChange={(e) => handleTempFilterChange("compania_id", e.target.value)}
                disabled={loadingCompanies}
              >
                <option value="">Todas</option>
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.nombre}
                  </option>
                ))}
              </Form.Select>
            </div>
            
            {/* Grupo familiar (GF) */}
            <div className="col-md-2">
              <Form.Label>Grupo familiar (GF)</Form.Label>
              <Form.Control
                type="text"
                inputMode="numeric"
                placeholder="Ej: 71"
                value={tempFilters.grupo_familiar_id}
                onChange={(e) => handleTempFilterChange("grupo_familiar_id", e.target.value.replace(/\D/g, ""))}
              />
              <Form.Text className="text-muted">Filtra por el mismo ID que la columna GF.</Form.Text>
            </div>
            
            {/* Estado de Auditoría */}
            <div className="col-md-2">
              <Form.Label>Estado Auditoría</Form.Label>
              <Form.Select
                value={tempFilters.audit_status}
                onChange={(e) => handleTempFilterChange("audit_status", e.target.value)}
              >
                <option value="">Todos</option>
                {AUDIT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </Form.Select>
            </div>
            
            {/* Fecha Desde */}
            <div className="col-md-2">
              <Form.Label>Fecha Desde</Form.Label>
              <Form.Control
                type="date"
                value={tempFilters.date_from}
                onChange={(e) => handleTempFilterChange("date_from", e.target.value)}
              />
            </div>
            
            {/* Fecha Hasta */}
            <div className="col-md-2">
              <Form.Label>Fecha Hasta</Form.Label>
              <Form.Control
                type="date"
                value={tempFilters.date_to}
                onChange={(e) => handleTempFilterChange("date_to", e.target.value)}
              />
            </div>
            
            {/* Resultados por página */}
            <div className="col-md-2">
              <Form.Label>Resultados por página</Form.Label>
              <Form.Select value={filters.per_page} onChange={handlePerPageChange}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </Form.Select>
            </div>
            
            {/* Botones */}
            <div className="col-md-12 d-flex gap-2 mt-3">
              <Button variant="primary" onClick={handleApplyFilters}>
                Aplicar Filtros
              </Button>
              <Button variant="secondary" onClick={handleClearFilters}>
                Limpiar
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mensaje de error */}
      {error && (
        <Alert variant="danger" className="mb-4">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
        </Alert>
      )}
      
      {/* Tabla */}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Coberturas</h5>
          {meta.total > 0 && (
            <span className="text-muted">
              Total reporte: {meta.total} | Página {meta.page} de {meta.last_page}
              {gfFiltroActivo && coberturas.length > 0 && (
                <>
                  {" "}
                  · GF {String(filters.grupo_familiar_id).trim()}:{" "}
                  {coberturasTrasFiltroGf.length}/{coberturas.length} filas en esta página
                </>
              )}
            </span>
          )}
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Cargando...</span>
              </Spinner>
              <p className="mt-2 text-muted">Cargando coberturas...</p>
            </div>
          ) : coberturas.length === 0 ? (
            <Alert variant="info">
              No se encontraron coberturas con los filtros aplicados.
            </Alert>
          ) : coberturasTrasFiltroGf.length === 0 ? (
            <Alert variant="warning">
              No hay coberturas de este grupo familiar en la página actual del reporte. Si el total global
              sigue alto, es probable que el servidor no esté aplicando el filtro por GF; revisa también las
              demás páginas.
            </Alert>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("grupo_familiar_id")}
                        title="Identificador único del grupo familiar al que pertenece la cobertura"
                      >
                        GF {renderSortIcon("grupo_familiar_id")}
                      </th>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("fecha_activacion")}
                      >
                        Fecha Activación {renderSortIcon("fecha_activacion")}
                      </th>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("codigo_poliza")}
                      >
                        Numero ID {renderSortIcon("codigo_poliza")}
                      </th>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("cliente")}
                      >
                        Cliente {renderSortIcon("cliente")}
                      </th>
                      <th>Compañía</th>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("precio")}
                      >
                        Precio {renderSortIcon("precio")}
                      </th>
                      <th
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort("req_pendientes")}
                      >
                        Requerimientos {renderSortIcon("req_pendientes")}
                      </th>
                      <th>Estado Auditoría</th>
                      <th>Revisado En</th>
                      {includePagosEnabled && (
                        <th
                          style={{ cursor: "pointer" }}
                          onClick={() => handleSort("fecha_pago")}
                          title="Ordenar por fecha de pago generado"
                        >
                          Fecha de pago {renderSortIcon("fecha_pago")}
                        </th>
                      )}
                      {includePagosEnabled && (
                        <th
                          style={{ cursor: "pointer" }}
                          onClick={() => handleSort("pago_estado")}
                          title="Ordenar por estado del pago (pendiente / procesando / pagado)"
                        >
                          Pago {renderSortIcon("pago_estado")}
                        </th>
                      )}
                      {includePagosEnabled && (
                        <th
                          title="Mora: 1–2 meses con generación distinta de pagado. Riesgo: 3 o más. Solo meses con pago generado en el año."
                          className="text-nowrap"
                        >
                          Situación pago
                        </th>
                      )}
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coberturasAgrupadas.map((cobertura) => {
                      const entityId = cobertura.cobertura_id || cobertura.cliente_id;
                      const rowItemId = resolveItemIdFromRow(cobertura);
                      const rowTaskKey = taskRowStorageKey(cobertura);
                      const taskUiKey = rowItemId || rowTaskKey;

                      const tareasDelItem = taskUiKey ? (tareasPorItem[taskUiKey] || []) : [];
                      const tieneTareas = tareasDelItem.length > 0;
                      const estaExpandido = taskUiKey ? itemsConTareasExpandidos[taskUiKey] : false;
                      const estaCargandoTareas = taskUiKey ? loadingTareas[taskUiKey] : false;

                      const pagoRelacionado = (() => {
                        if (!includePagosEnabled) return null;
                        const coberturaId = cobertura?.cobertura_id ?? cobertura?.id ?? null;
                        const clienteId = cobertura?.cliente_id ?? null;
                        const codigoPoliza = cobertura?.codigo_poliza
                          ? String(cobertura.codigo_poliza).trim()
                          : "";
                        if (coberturaId != null && pagosPorEntidad[`cobertura:${coberturaId}`]) {
                          return pagosPorEntidad[`cobertura:${coberturaId}`];
                        }
                        if (clienteId != null && pagosPorEntidad[`cliente:${clienteId}`]) {
                          return pagosPorEntidad[`cliente:${clienteId}`];
                        }
                        if (codigoPoliza && pagosPorEntidad[`poliza:${codigoPoliza}`]) {
                          return pagosPorEntidad[`poliza:${codigoPoliza}`];
                        }
                        return null;
                      })();

                      const pendienteAuditoriaAnterior = filaPendienteAuditoriaAnterior(cobertura);
                      const tituloPendienteAudAnt = tituloPendienteAuditoriaAnterior(cobertura);

                      return (
                        <tr
                          key={entityId}
                          className={pendienteAuditoriaAnterior ? "bg-danger-subtle" : undefined}
                          title={tituloPendienteAudAnt}
                        >
                        <td>
                          <span className="d-inline-flex align-items-center gap-2 flex-wrap">
                            {pendienteAuditoriaAnterior && (
                              <FaExclamationTriangle
                                className="text-danger flex-shrink-0"
                                title={tituloPendienteAudAnt}
                                aria-hidden
                              />
                            )}
                            <span>
                              {cobertura.grupo_familiar_id ||
                                cobertura.grupo_familiar?.id ||
                                cobertura.gf_id ||
                                "-"}
                            </span>
                          </span>
                        </td>
                        <td>{formatDate(cobertura.fecha_activacion)}</td>
                        <td>{cobertura.codigo_poliza || "-"}</td>
                        <td>{cobertura.cliente || "-"}</td>
                        <td>{cobertura.compania || "-"}</td>
                        <td>{formatCurrency(cobertura.precio)}</td>
                        <td>
                          {cobertura.req_total === 0 ? (
                            <span className="text-muted">0/0</span>
                          ) : (
                            <>
                              {cobertura.req_pendientes > 0 && (
                                <Badge bg="warning" className="me-1">
                                  {cobertura.req_pendientes}
                                </Badge>
                              )}
                              <span>
                                {cobertura.req_pendientes}/{cobertura.req_total}
                              </span>
                            </>
                          )}
                        </td>
                        <td>
                          {(() => {
                            const rawStatus = cobertura.audit_status || "PENDIENTE";
                            const normalizedStatus = String(rawStatus).toUpperCase();
                            const showQuickOk = normalizedStatus === "PENDIENTE";
                            const isQuickOkSaving = quickOkEntityId === entityId;
                            return (
                              <div className="d-flex align-items-center gap-2 flex-wrap">
                                <Badge bg={getStatusBadgeVariant(normalizedStatus)}>
                                  {normalizedStatus}
                                </Badge>
                                {showQuickOk && (
                                  <Form.Check
                                    type="checkbox"
                                    id={`audit-quick-ok-${entityId}`}
                                    className="mb-0 small"
                                    title="Marcar como OK (atajo; otros estados desde el botón de comentario)"
                                    disabled={isQuickOkSaving}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        void handleQuickOkFromTable(cobertura, e.target);
                                      }
                                    }}
                                  />
                                )}
                                {isQuickOkSaving && (
                                  <Spinner animation="border" size="sm" className="text-primary" />
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td>{formatDateTime(cobertura.reviewed_at)}</td>
                        {includePagosEnabled && (
                          <td style={{ minWidth: 120 }}>
                            {loadingPagos ? (
                              <div className="d-flex align-items-center gap-2">
                                <Spinner animation="border" size="sm" />
                                <span className="text-muted small">Cargando...</span>
                              </div>
                            ) : pagoRelacionado ? (
                              pagoRelacionado.fecha_pago ? (
                                <div className="small">
                                  <div className="fw-semibold">
                                    {formatPagoFechaMostrar(pagoRelacionado.fecha_pago) || "-"}
                                  </div>
                                  {(() => {
                                    const dia = diaDelMesDesdeFechaPago(pagoRelacionado.fecha_pago);
                                    return dia != null ? (
                                      <div className="text-muted">Día {String(dia).padStart(2, "0")}</div>
                                    ) : null;
                                  })()}
                                </div>
                              ) : (
                                <span className="text-muted">-</span>
                              )
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        )}
                        {includePagosEnabled && (
                          <td style={{ minWidth: 160 }}>
                            {loadingPagos ? (
                              <span className="text-muted small">…</span>
                            ) : pagoRelacionado ? (
                              <div className="d-flex align-items-center gap-2">
                                <Form.Select
                                  value={pagoRelacionado.estado}
                                  onChange={(e) => void handlePagoEstadoChange(pagoRelacionado, e.target.value)}
                                  disabled={savingPagoId === pagoRelacionado.id}
                                  className={`text-center fw-bold ${
                                    pagoRelacionado.estado === "pagado"
                                      ? "bg-success text-white"
                                      : pagoRelacionado.estado === "pendiente"
                                      ? "bg-secondary text-white"
                                      : pagoRelacionado.estado === "procesando"
                                      ? "bg-warning text-dark"
                                      : "bg-secondary"
                                  }`}
                                >
                                  <option value="pendiente">Pendiente</option>
                                  <option value="pagado">Pagado</option>
                                  <option value="procesando">Procesando</option>
                                </Form.Select>
                                {savingPagoId === pagoRelacionado.id && (
                                  <Spinner animation="border" size="sm" className="text-primary" />
                                )}
                              </div>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        )}
                        {includePagosEnabled && (
                          <td className="text-center">
                            {loadingPagos ? (
                              <span className="text-muted small">…</span>
                            ) : (() => {
                              const eid = cobertura.cobertura_id || cobertura.cliente_id;
                              const moraKey =
                                eid != null
                                  ? `id:${eid}`
                                  : `pol:${String(cobertura.codigo_poliza || "").trim()}`;
                              const ind = indicadorMoraPorCoberturaKey.get(moraKey);
                              if (!ind || ind.nivel === "sin_datos" || ind.nivel === "sin_generacion") {
                                return (
                                  <span className="text-muted small" title={ind?.titulo}>
                                    —
                                  </span>
                                );
                              }
                              if (ind.nivel === "riesgo") {
                                return (
                                  <Badge bg="danger" title={ind.titulo}>
                                    {ind.etiqueta}
                                  </Badge>
                                );
                              }
                              if (ind.nivel === "mora") {
                                return (
                                  <Badge bg="warning" text="dark" title={ind.titulo}>
                                    {ind.etiqueta}
                                  </Badge>
                                );
                              }
                              return (
                                <Badge bg="success" title={ind.titulo}>
                                  {ind.etiqueta}
                                </Badge>
                              );
                            })()}
                          </td>
                        )}
                        <td>
                          <div className="d-flex gap-1">
                            <Button
                              variant={cobertura.req_total === 0 ? "secondary" : "primary"}
                              size="sm"
                              onClick={() => handleViewRequerimientos(cobertura)}
                              disabled={cobertura.req_total === 0}
                              title="Ver documentos"
                            >
                              <FaFileAlt />
                            </Button>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEditStatus(cobertura)}
                              title="Editar estado"
                            >
                              <FaComment />
                            </Button>
                            <Button
                              variant="outline-info"
                              size="sm"
                              onClick={() => void handleOpenPagosCliente(cobertura)}
                              title="Ver pagos generados para este cliente / póliza"
                            >
                              <FaDollarSign />
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => setHistorialModalPayload({ cobertura })}
                              title={
                                filaPendienteAuditoriaAnterior(cobertura) &&
                                cobertura.prev_run_id != null &&
                                cobertura.prev_run_id !== ""
                                  ? "Historial de tareas y comentarios (este periodo y pestaña de auditoría anterior)"
                                  : "Historial de tareas y comentarios"
                              }
                            >
                              <FaHistory />
                            </Button>
                            <Button
                              variant="outline-success"
                              size="sm"
                              onClick={async () => {
                                if (!taskUiKey) {
                                  toast.showWarning(
                                    "No se pudo identificar la cobertura/cliente para cargar tareas de auditoría."
                                  );
                                  return;
                                }

                                if (!estaCargandoTareas) {
                                  try {
                                    await loadTasksForCoberturaRow(cobertura);
                                  } catch (e) {
                                    console.warn("Auditoría: no se pudo refrescar tareas antes del modal:", e);
                                  }
                                }

                                const inferredItemId = await resolveAuditItemIdWithFallback(cobertura);
                                setSelectedItemForTask({
                                  id: inferredItemId,
                                  item_id: inferredItemId,
                                  entityId,
                                  runId,
                                  cobertura_id: cobertura.cobertura_id,
                                  cliente_id: cobertura.cliente_id,
                                  grupo_familiar_id:
                                    cobertura.grupo_familiar_id ||
                                    cobertura.grupo_familiar?.id ||
                                    cobertura.gf_id,
                                  ...cobertura,
                                });
                                setShowNuevaTareaModal(true);
                              }}
                              title="Nueva tarea de auditoría"
                            >
                              <FaTasks />
                            </Button>
                          </div>
                          {/* Mostrar tareas expandidas debajo de la fila */}
                          {taskUiKey && estaExpandido && tieneTareas && (
                            <div className="mt-2 p-2 bg-light rounded border">
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <strong className="small">Tareas de Auditoría ({tareasDelItem.length})</strong>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 text-decoration-none"
                                  onClick={() => {
                                    setItemsConTareasExpandidos(prev => ({
                                      ...prev,
                                      [taskUiKey]: false
                                    }));
                                  }}
                                >
                                  Ocultar
                                </Button>
                              </div>
                              {estaCargandoTareas ? (
                                <div className="text-center py-2">
                                  <Spinner animation="border" size="sm" />
                                </div>
                              ) : (
                                <div className="d-flex flex-column gap-2">
                                  {tareasDelItem.map((tarea) => (
                                    <div key={tarea.id} className="d-flex justify-content-between align-items-center p-2 bg-white rounded border">
                                      <div className="flex-grow-1">
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                          <Badge bg={
                                            tarea.status === "completed" ? "success" :
                                            tarea.status === "in_progress" ? "warning" : "secondary"
                                          }>
                                            {tarea.status === "completed" ? "Completada" :
                                             tarea.status === "in_progress" ? "En progreso" : "Pendiente"}
                                          </Badge>
                                          <small>
                                            Asignada a: {tarea.assigned_user?.name || "N/A"}
                                          </small>
                                        </div>
                                        {tarea.due_date && (
                                          <small className="text-muted d-block">
                                            Vence: {formatDate(tarea.due_date)}
                                          </small>
                                        )}
                                        {tarea.comments_count > 0 && (
                                          <small className="text-muted d-block">
                                            {tarea.comments_count} comentario{tarea.comments_count !== 1 ? "s" : ""}
                                          </small>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  <Button
                                    variant="outline-success"
                                    size="sm"
                                    className="mt-1"
                                    onClick={async () => {
                                      const inferredItemId = await resolveAuditItemIdWithFallback(cobertura);
                                      setSelectedItemForTask({
                                        id: inferredItemId,
                                        item_id: inferredItemId,
                                        entityId,
                                        runId,
                                        cobertura_id: cobertura.cobertura_id,
                                        cliente_id: cobertura.cliente_id,
                                        grupo_familiar_id:
                                          cobertura.grupo_familiar_id ||
                                          cobertura.grupo_familiar?.id ||
                                          cobertura.gf_id,
                                        ...cobertura,
                                      });
                                      setShowNuevaTareaModal(true);
                                    }}
                                  >
                                    <FaTasks className="me-1" />
                                    Crear Nueva Tarea
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
              
              {/* Paginación */}
              {meta.last_page > 1 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={meta.page}
                    totalPages={meta.last_page}
                    onPageChange={handlePageChange}
                    disabled={loading}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Modal de Requerimientos */}
      {selectedCobertura && (
        <RequerimientosCoberturaModal
          isOpen={showModal}
          onClose={handleCloseModal}
          cobertura={selectedCobertura}
        />
      )}
      
      {/* Modal de Nueva Tarea de Auditoría */}
      {selectedItemForTask && (
        <NuevaTareaAuditoriaModal
          show={showNuevaTareaModal}
          onHide={() => {
            setShowNuevaTareaModal(false);
            setSelectedItemForTask(null);
          }}
          onCreated={async () => {
            const ctx = selectedItemForTask;
            if (!ctx) return;

            const coberturaLike = {
              cobertura_id: ctx.cobertura_id,
              cliente_id: ctx.cliente_id,
              item_id: ctx.item_id,
              auditoria_item_id: ctx.auditoria_item_id,
              audit_item_id: ctx.audit_item_id,
              id: ctx.id,
            };

            try {
              const tareas = await loadTasksForCoberturaRow(coberturaLike);
              const taskUiKey =
                resolveItemIdFromRow(coberturaLike) || taskRowStorageKey(coberturaLike);
              if (taskUiKey) {
                setItemsConTareasExpandidos((prev) => ({ ...prev, [taskUiKey]: true }));
              }
              if (!Array.isArray(tareas) || tareas.length === 0) {
                // Fallback conservador si el listado no devolvió nada aún
                setTimeout(() => window.location.reload(), 500);
              }
            } catch (err) {
              console.error("Error al recargar tareas:", err);
              setTimeout(() => window.location.reload(), 1000);
            }
          }}
          runId={runId} // Pasar runId directamente
          itemInfo={selectedItemForTask}
        />
      )}
      
      <HistorialTareasAuditoriaModal
        show={Boolean(historialModalPayload)}
        onHide={() => setHistorialModalPayload(null)}
        runId={runId}
        cobertura={historialModalPayload?.cobertura ?? null}
      />

      <Modal
        show={pagosClienteVista != null}
        onHide={() => setPagosClienteVista(null)}
        size="xl"
        scrollable
        centered
        dialogClassName="modal-pagos-cliente-auditoria"
      >
        <style>{`
          .modal-pagos-cliente-auditoria {
            max-width: min(1320px, 98vw);
          }
        `}</style>
        <Modal.Header closeButton>
          <Modal.Title>Pagos del cliente</Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-3">
          {pagosClienteVista?.cobertura && (
            <div className="border rounded bg-light px-3 py-2 mb-2 small text-start">
              <strong>Cliente:</strong> {pagosClienteVista.cobertura.cliente || "—"} ·{" "}
              <strong>Numero ID:</strong> {pagosClienteVista.cobertura.codigo_poliza || "—"}
              {pagosClienteVista.cobertura.compania ? (
                <>
                  {" "}
                  · <strong>Compañía:</strong> {pagosClienteVista.cobertura.compania}
                </>
              ) : null}
            </div>
          )}
          {pagosClienteVista?.loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" className="me-2" />
              <span className="text-muted">Cargando pagos…</span>
            </div>
          ) : pagosClienteVista?.error ? (
            <Alert variant="danger">{pagosClienteVista.error}</Alert>
          ) : !pagosClienteVista?.items?.length ? (
            <Alert variant="info" className="mb-0">
              El cliente no presenta generación de pagos actualmente.
            </Alert>
          ) : (
            (() => {
              const c = pagosClienteVista.cobertura;
              const { year, porMes } = agruparPagosPorMesEnAnio(pagosClienteVista.items, periodoRun);
              const indModal = includePagosEnabled ? indicadorMorosidadPagosPorMes(porMes) : null;
              const pagador =
                c?.pagador ??
                c?.pagador_nombre ??
                c?.nombre_pagador ??
                c?.cobertura?.pagador?.nombre_completo ??
                "—";

              return (
                <>
                  <p className="text-muted small mb-2 mb-md-3 d-flex flex-wrap align-items-center gap-2">
                    <span>
                      Vista alineada al informe de cartera · <strong>Año {year}</strong>
                    </span>
                    {includePagosEnabled && indModal && indModal.nivel !== "sin_datos" && (
                      <>
                        <span className="text-muted">·</span>
                        <span className="text-muted">Situación pago:</span>
                        {indModal.nivel === "sin_generacion" ? (
                          <span className="text-muted small" title={indModal.titulo}>
                            —
                          </span>
                        ) : indModal.nivel === "riesgo" ? (
                          <Badge bg="danger" title={indModal.titulo}>
                            {indModal.etiqueta}
                          </Badge>
                        ) : indModal.nivel === "mora" ? (
                          <Badge bg="warning" text="dark" title={indModal.titulo}>
                            {indModal.etiqueta}
                          </Badge>
                        ) : (
                          <Badge bg="success" title={indModal.titulo}>
                            {indModal.etiqueta}
                          </Badge>
                        )}
                      </>
                    )}
                  </p>
                  <div className="table-responsive rounded border overflow-hidden shadow-sm">
                    <Table
                      striped
                      bordered
                      hover
                      responsive
                      className="w-100 text-center align-middle mb-0"
                    >
                      <thead className="table-light">
                        <tr>
                          <th className="text-start">Pagador</th>
                          {PAGOS_INFORME_MONTH_ABBR.map((m, idx) => (
                            <th key={idx} className="text-uppercase small">
                              {m}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="text-start fw-medium">{pagador}</td>
                          {porMes.map((pago, idx) => (
                            <td key={idx}>
                              {pago ? (
                                <>
                                  <span
                                    className={`badge text-bg-${pagoEstadoBadgeTonePagosInforme(pago.estado)}`}
                                  >
                                    {pago.estado}
                                  </span>
                                  <br />
                                  <small className="text-muted">
                                    ${Number(pago.monto ?? 0).toFixed(2)}
                                  </small>
                                </>
                              ) : (
                                "-"
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </Table>
                  </div>
                </>
              );
            })()
          )}
        </Modal.Body>
        <Modal.Footer className="border-top">
          <Button variant="secondary" onClick={() => setPagosClienteVista(null)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Edición de Status */}
      <Modal show={showStatusModal} onHide={handleCloseStatusModal} backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Editar Estado de Auditoría</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingItem && (
            <>
              <p className="mb-3">
                <strong>Cliente:</strong> {editingItem.cliente || "-"} <br />
                <strong>Numero ID:</strong> {editingItem.codigo_poliza || "-"}
              </p>
              
              <Form.Group className="mb-3">
                <Form.Label>Estado</Form.Label>
                <Form.Select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {AUDIT_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>
                  Comentario
                  {STATUSES_REQUIRING_COMMENT.includes(statusForm.status) && (
                    <span className="text-danger"> *</span>
                  )}
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={statusForm.comment}
                  onChange={(e) => setStatusForm((prev) => ({ ...prev, comment: e.target.value }))}
                  placeholder={
                    STATUSES_REQUIRING_COMMENT.includes(statusForm.status)
                      ? "El comentario es obligatorio para este estado"
                      : "Comentario opcional"
                  }
                />
                {STATUSES_REQUIRING_COMMENT.includes(statusForm.status) && (
                  <Form.Text className="text-muted">
                    Este estado requiere un comentario obligatorio.
                  </Form.Text>
                )}
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseStatusModal} disabled={savingStatus}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSaveStatus} disabled={savingStatus}>
            {savingStatus ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AuditoriaRunDetallePage;

