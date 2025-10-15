import React, { useEffect, useMemo, useState } from "react";
import { FaExternalLinkAlt, FaEdit } from "react-icons/fa";
import apiRequest from "../../services/api";

const PENDING_STATES = new Set(["pending", "processing", "in_progress"]);

export default function TareasPendientesPanel({
  className = "",
  items,
  clienteId,
  grupoId,
  perPage = 20,
  onCreate = () => {},
  onOpen = () => {},
  onEdit = () => {},
}) {
  // ===== State =====
  const [autoItems, setAutoItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // ===== Helpers =====
  const formatDate = (v) => {
    if (!v) return "mm/dd/aaaa";
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime())
      ? "mm/dd/aaaa"
      : d.toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
  };

  // Extrae la lista de tareas desde varias formas de respuesta
  const getList = (res) => {
    if (Array.isArray(res?.data?.data)) return res.data.data; // Laravel paginado clásico
    if (Array.isArray(res?.data)) return res.data;            // JSON con data array + meta
    if (Array.isArray(res)) return res;                       // Array directo
    return [];
  };

  // Normaliza una tarea a nuestro modelo de UI
  const normalizeTask = (t) => {
    const rawEstado = String(t?.estado ?? t?.status ?? "pending").toLowerCase();

    const nota =
      t?.nota ??
      t?.note ??
      t?.descripcion ??
      t?.description ??
      t?.detalle ??
      "";

    return {
      id: t?.id,
      titulo: t?.titulo || t?.concepto || (typeof nota === "string" ? nota : "") || "Tarea",
      responsable:
        t?.responsable ??
        t?.asignado_a ??
        t?.assignedUser?.name ??
        t?.assigned_user?.name ??
        "—",
      estado: rawEstado, // conservar tal cual; lo traducimos en render
      fechaLimite: t?.fechaLimite ?? t?.due_at ?? t?.scheduled_at ?? null,
      fechaCreacion: t?.fechaCreacion ?? t?.created_at ?? t?.fecha ?? null,
      nota: (typeof nota === "string" ? nota.trim() : "") || "",
      __raw: t,
    };
  };

  // Ordena: due asc (null al final) y luego created desc
  const sortTasks = (a, b) => {
    const ad = a.fechaLimite ? new Date(a.fechaLimite).getTime() : Number.POSITIVE_INFINITY;
    const bd = b.fechaLimite ? new Date(b.fechaLimite).getTime() : Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    const ac = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
    const bc = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
    return bc - ac;
  };

  // Traduce el estado a texto legible
  const estadoLabel = (estado) => {
    switch ((estado || "").toLowerCase()) {
      case "pending": return "Pendiente";
      case "processing": return "Procesando";
      case "in_progress": return "En progreso";
      default: return estado || "Pendiente";
    }
  };

  // ===== Effect: carga desde backend (unificada, filtrando estados pendientes) =====
  useEffect(() => {
    if (!clienteId || !grupoId) {
      setAutoItems([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        // Petición unificada (el back ya puede devolver varias mezcladas)
        const qs = `include=assignedUser,concept,comments&per_page=${perPage}`;
        const res = await apiRequest(
          `tareas_operativas/cliente/${clienteId}/grupo/${grupoId}?${qs}`,
          "GET"
        );

        const merged = getList(res);

        // Filtrar por estados "pendientes" (pending, processing, in_progress)
        const filtered = merged.filter((t) =>
          PENDING_STATES.has(String(t?.estado ?? t?.status ?? "").toLowerCase())
        );

        // Desdup + normalizar + ordenar
        const unique = Object.values(
          filtered.reduce((acc, t) => {
            if (t && t.id != null) acc[t.id] = t;
            return acc;
          }, {})
        )
          .map(normalizeTask)
          .sort(sortTasks);

        if (!cancelled) setAutoItems(unique);
      } catch {
        if (!cancelled) {
          setErrMsg("No fue posible cargar las tareas.");
          setAutoItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clienteId, grupoId, perPage]);

  // ===== Data source (API vs props) =====
  const data = useMemo(() => {
    const byApi = Array.isArray(autoItems) ? autoItems : [];
    const byProp = Array.isArray(items) ? items : [];
    if (clienteId && grupoId) return byApi.length ? byApi : byProp;
    return byProp.length ? byProp : byApi;
  }, [items, autoItems, clienteId, grupoId]);

  // ===== Render =====
  return (
    <div className={`card ${className}`}>
      <div className="card-header d-flex justify-content-between align-items-center py-2">
        <strong className="text-primary">Tareas Pendientes</strong>
        <button className="btn btn-sm btn-outline-primary" onClick={onCreate}>
          + Crear Tarea
        </button>
      </div>

      <div className="card-body">
        {loading && (
          <div className="d-flex align-items-center text-muted small">
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            Cargando…
          </div>
        )}

        {!loading && errMsg && <div className="text-danger small">{errMsg}</div>}

        {!loading && !errMsg && (!data || data.length === 0) && (
          <div className="text-muted small">No hay tareas pendientes.</div>
        )}

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
                <div className="mt-2">
                  <div className="small">
                    <strong>Nota:</strong>{" "}
                    <span className="text-muted">{t.nota}</span>
                  </div>
                </div>
              )}

              <div className="mt-2 d-flex gap-2">
                <button className="btn btn-sm btn-primary" onClick={() => onOpen(t)}>
                  Abrir <FaExternalLinkAlt className="ms-1" />
                </button>
                <button className="btn btn-sm btn-outline-primary" onClick={() => onEdit(t)}>
                  Editar <FaEdit className="ms-1" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
