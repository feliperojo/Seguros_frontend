import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FaExternalLinkAlt, FaEdit } from "react-icons/fa";
import apiRequest from "../../services/api";
import NuevaTareaModal from "../Tareas/NuevaTareaModal";
import ResponderOportunidadModal from "../Tareas/ResponderOportunidadModa";

const PENDING_STATES = new Set(["pending", "processing", "in_progress"]);

export default function TareasPendientesPanel({
  className = "",
  items,
  clienteId,      // <-- ya viene desestructurado
  grupoId,
  perPage = 20,
  onCreate = () => {},
  onOpen = () => {},
  onEdit = () => {},
  emptyMessage = "No se tienen tareas pendientes o en progreso.",
}) {
  const [autoItems, setAutoItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [showNueva, setShowNueva] = useState(false);

  // Modal responder
  const [showResponder, setShowResponder] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loadingResponder, setLoadingResponder] = useState(false);

  const formatDate = (v) => {
    if (!v) return "mm/dd/aaaa";
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime())
      ? "mm/dd/aaaa"
      : d.toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
  };

  const getList = (res) => {
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res)) return res;
    return [];
  };

  const fetchTaskDetail = useCallback(async (task) => {
    const raw = task?.__raw ?? task;

    // Cliente puede venir en raw.log.cliente o raw.cliente
    const cliente = raw?.log?.cliente ?? raw?.cliente ?? null;

    // Fechas pueden venir con varios nombres
    const scheduled_date =
      raw?.scheduled_date ?? raw?.scheduled_at ?? raw?.fechaProgramada ?? null;

    const due_date =
      raw?.due_date ?? raw?.due_at ?? raw?.fechaLimite ?? null;

    return {
      ...raw,
      scheduled_date,
      due_date,
      log: {
        ...(raw.log || {}),
        cliente: cliente || {
          id: clienteId,
          nombre_completo: "Cliente", // Aquí se ajusta para tener un valor por defecto
          telefono: "",
          estado_cliente: "cliente",
        },
      },
    };
}, [clienteId]);

  
  
  const openResponder = async (taskLite) => {
    const full = await fetchTaskDetail(taskLite);
    console.log('full task details:', full);
    setSelectedTask(full);
    setShowResponder(true);
  };

  const closeResponder = (updated) => {
    setShowResponder(false);
    setSelectedTask(null);
    if (updated) fetchTasks();
  };

  const handleUpdated = async () => {
    await fetchTasks();
  };

  const normalizeTask = (t) => {
    const rawEstado = String(t?.estado ?? t?.status ?? "pending").toLowerCase();
    const nota =
      t?.nota ?? t?.note ?? t?.descripcion ?? t?.description ?? t?.detalle ?? "";
    return {
      id: t?.id,
      titulo: t?.titulo || t?.concepto || (typeof nota === "string" ? nota : "") || "Tarea",
      responsable:
        t?.responsable ?? t?.asignado_a ?? t?.assignedUser?.name ?? t?.assigned_user?.name ?? "—",
      estado: rawEstado,
      fechaLimite: t?.fechaLimite ?? t?.due_at ?? t?.scheduled_at ?? null,
      fechaCreacion: t?.fechaCreacion ?? t?.created_at ?? t?.fecha ?? null,
      nota: (typeof nota === "string" ? nota.trim() : "") || "",
      __raw: t.__raw ?? t,
    };
  };

  const sortTasks = (a, b) => {
    const ad = a.fechaLimite ? new Date(a.fechaLimite).getTime() : Number.POSITIVE_INFINITY;
    const bd = b.fechaLimite ? new Date(b.fechaLimite).getTime() : Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    const ac = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
    const bc = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
    return bc - ac;
  };

  const estadoLabel = (estado) => {
    switch ((estado || "").toLowerCase()) {
      case "pending": return "Pendiente";
      case "processing": return "Procesando";
      case "in_progress": return "En progreso";
      default: return estado || "Pendiente";
    }
  };

  const fetchTasks = useCallback(async () => {
    if (!clienteId || !grupoId) {
      setAutoItems([]);
      return;
    }
    setLoading(true);
    setErrMsg("");
    try {
      const qs = `include=log,log.cliente,concept,comments,assignedUser&per_page=${perPage}`;
      const res = await apiRequest(
        `tareas_operativas/cliente/${clienteId}/grupo/${grupoId}?${qs}`,
        "GET"
      );
      const merged = getList(res);
      const filtered = merged.filter((t) =>
        PENDING_STATES.has(String(t?.estado ?? t?.status ?? "").toLowerCase())
      );
      const unique = Object.values(
        filtered.reduce((acc, t) => {
          if (t && t.id != null) acc[t.id] = t;
          return acc;
        }, {})
      ).map(normalizeTask).sort(sortTasks);

      setAutoItems(unique);
    } catch {
      setErrMsg("No fue posible cargar las tareas.");
      setAutoItems([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, grupoId, perPage]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const data = useMemo(() => {
    const byApi = Array.isArray(autoItems) ? autoItems : [];
    const byProp = Array.isArray(items) ? items : [];
    if (clienteId && grupoId) return byApi.length ? byApi : byProp;
    return byProp.length ? byProp : byApi;
  }, [items, autoItems, clienteId, grupoId]);

  const openNueva = () => setShowNueva(true);
  const closeNueva = () => setShowNueva(false);

  const handleCreated = async (newTask) => {
    await fetchTasks();
    onCreate(newTask);
    closeNueva();
  };

  return (
    <div className={`card ${className}`}>
      <div className="card-header d-flex justify-content-between align-items-center py-2">
        <strong className="text-primary">Tareas Pendientes</strong>
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={openNueva}
          disabled={!clienteId || !grupoId}
          title={!clienteId || !grupoId ? "Selecciona un cliente/grupo para crear" : ""}
        >
          + Crear Tarea
        </button>
      </div>

      <div className="card-body">
        {loading && (
          <div className="d-flex align-items-center text-muted small">
            <span className="spinner-border spinner-border-sm me-2" />
            Cargando…
          </div>
        )}

        {!loading && errMsg && <div className="text-danger small">{errMsg}</div>}

        {!loading && !errMsg && (!data || data.length === 0) && (
          <div className="text-muted small">{emptyMessage}</div>
        )}

        {/* ✅ SOLO UN map (quitamos el duplicado) */}
        {!loading && !errMsg && data?.map((t) => (
          <div key={t.id} className="card mb-3 shadow-sm border-0">
            <div className="card-body py-3">
              <div className="d-flex justify-content-between">
                <div className="fw-semibold">{t.titulo}</div>
                <div className="small text-muted text-end">
                  <div><strong>Fecha Límite:</strong> {formatDate(t.fechaLimite)}</div>
                  <div><strong>Creada:</strong> {formatDate(t.fechaCreacion)}</div>
                </div>
              </div>

              <div className="small mt-2">
                <div><strong>Responsable:</strong> {t.responsable ?? "—"}</div>
                <div><strong>Estado:</strong> {estadoLabel(t.estado)}</div>
              </div>

              {t.nota && (
                <div className="mt-2 small">
                  <strong>Nota:</strong> <span className="text-muted">{t.nota}</span>
                </div>
              )}

              <div className="mt-2 d-flex gap-2">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => openResponder(t.__raw ?? t)}
                  disabled={loadingResponder}
                >
                  Responder <FaExternalLinkAlt className="ms-1" />
                </button>

             
              </div>
            </div>
          </div>
        ))}
      </div>

      <NuevaTareaModal
        show={showNueva}
        onHide={closeNueva}
        onCreated={handleCreated}
        grupoFamiliarId={grupoId}
        clienteId={clienteId}
      />

      {selectedTask && (
        <ResponderOportunidadModal
          show={showResponder}
          onHide={closeResponder}
          tarea={selectedTask}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
