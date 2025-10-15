import React, { useEffect, useMemo, useState } from "react";
import { FaExternalLinkAlt, FaEdit } from "react-icons/fa";
import apiRequest from "../../services/api";

// Estados considerados como "terminadas"
const COMPLETED_STATES = new Set([
  "done", "completed", "complete", "finished", "resolved", "closed", "completada", "terminada",
]);

export default function TareasTerminadasPanel({
  className = "",
  clienteId,
  grupoId,
  perPage = 20,
  onOpen = () => {},
  onEdit = () => {},
  emptyMessage = "No se tienen tareas terminadas.",
}) {
  const [items, setItems] = useState([]);       // datos normalizados
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [term, setTerm] = useState("");         // 👈 SOLO UNA VEZ

  // ==== Helpers ====
  const formatDate = (v) => {
    if (!v) return "mm/dd/aaaa";
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime())
      ? "mm/dd/aaaa"
      : d.toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
  };

  const monthLabel = (d) =>
    new Intl.DateTimeFormat("es-CO", { month: "long", timeZone: "America/Bogota" }).format(d);

  const dayLabel = (v) => {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    const mes = monthLabel(d);
    const cap = mes.charAt(0).toUpperCase() + mes.slice(1);
    return `${cap} ${d.getDate()}`;
  };

  const getList = (res) => {
    if (Array.isArray(res?.data?.data)) return res.data.data; // axios: {data:{data:[...]}}
    if (Array.isArray(res?.data)) return res.data;            // apiRequest devolvió JSON
    if (Array.isArray(res)) return res;                       // array directo
    return [];
  };

  // Normaliza y DERIVA fechaTermino si no viene explícita
  const normalizeTask = (t) => {
    const rawEstado = String(t?.estado ?? t?.status ?? "").toLowerCase();
    const nota = t?.nota ?? t?.note ?? t?.descripcion ?? t?.description ?? t?.detalle ?? "";

    const fechaTermino =
      t?.fechaTermino ??
      t?.finished_at ??
      t?.completed_at ??
      t?.closed_at ??
      t?.fecha_cierre ??
      t?.fecha_termino ??
      t?.fecha_fin ??
      t?.fecha ??           // fallback a "fecha" (creación) si no hay otra
      t?.fechaLimite ??
      t?.due_at ??
      t?.scheduled_at ??
      null;

    return {
      id: t?.id,
      titulo: t?.titulo || t?.concepto || (typeof nota === "string" ? nota : "") || "Tarea",
      responsable: t?.responsable ?? t?.asignado_a ?? t?.assignedUser?.name ?? t?.assigned_user?.name ?? "—",
      estado: rawEstado,
      fechaCreacion: t?.fechaCreacion ?? t?.created_at ?? t?.fecha ?? null,
      fechaTermino,
      nota: (typeof nota === "string" ? nota.trim() : "") || "",
      __raw: t,
    };
  };

  // Orden: terminada desc; si no hay, creada desc
  const sortTasks = (a, b) => {
    const at = a.fechaTermino ? new Date(a.fechaTermino).getTime() : -Infinity;
    const bt = b.fechaTermino ? new Date(b.fechaTermino).getTime() : -Infinity;
    if (at !== bt) return bt - at;
    const ac = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
    const bc = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
    return bc - ac;
  };

  const estadoLabel = (estado) => {
    switch ((estado || "").toLowerCase()) {
      case "done":
      case "completed":
      case "complete":
      case "finished":
      case "resolved":
      case "closed":
      case "completada":
      case "terminada":
        return "Completada";
      case "cancelled":
      case "canceled":
      case "anulada":
        return "Cancelada";
      default:
        return estado || "Completada";
    }
  };

  // ==== Fetch autónomo ====
  useEffect(() => {
    if (!clienteId || !grupoId) {
      setItems([]);
      setLoading(false);
      setErrMsg("");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        const qs = `include=assignedUser,concept,comments&per_page=${perPage}`;
        const res = await apiRequest(
          `tareas_operativas/cliente/${clienteId}/grupo/${grupoId}?${qs}`,
          "GET"
        );

        const list = getList(res).filter((t) => {
          const st = String(t?.estado ?? t?.status ?? "").toLowerCase();
          return COMPLETED_STATES.has(st); // incluye "completed"
        });

        const unique = Object.values(
          list.reduce((acc, t) => {
            if (t && t.id != null) acc[t.id] = t;
            return acc;
          }, {})
        )
          .map(normalizeTask)
          .sort(sortTasks);

        if (!cancelled) setItems(unique);
      } catch {
        if (!cancelled) {
          setErrMsg("No fue posible cargar las tareas terminadas.");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clienteId, grupoId, perPage]);

  // ==== Búsqueda local (usa el ÚNICO 'term') ====
  const filtered = useMemo(() => {
    if (!term) return items;
    const q = term.toLowerCase();
    return items.filter(
      (it) =>
        it.titulo?.toLowerCase().includes(q) ||
        it.responsable?.toLowerCase().includes(q) ||
        estadoLabel(it.estado).toLowerCase().includes(q) ||
        it.nota?.toLowerCase().includes(q)
    );
  }, [items, term]);

  // ==== Agrupación por día de término ====
  const groups = useMemo(() => {
    const map = new Map();
    for (const t of filtered) {
      const key = dayLabel(t.fechaTermino);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // ==== Render ====
  return (
    <div className={`card ${className}`}>
      <div className="card-header py-2 d-flex justify-content-between align-items-center">
        <div className="text-primary fw-semibold">Tareas Terminadas</div>

        <div className="input-group input-group-sm" style={{ maxWidth: 260 }}>
          <span className="input-group-text">Filtrar / Buscar</span>
          <input
            className="form-control"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Título, responsable, nota…"
          />
          {!!term && (
            <button className="btn btn-outline-secondary" onClick={() => setTerm("")}>
              ×
            </button>
          )}
        </div>
      </div>

      <div className="card-body">
        {loading && (
          <div className="d-flex align-items-center text-muted small mb-2">
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            Cargando…
          </div>
        )}

        {!loading && errMsg && <div className="text-danger small">{errMsg}</div>}

        {!loading && !errMsg && groups.length === 0 && (
          <div className="text-muted small">{emptyMessage}</div>
        )}

        {!loading && !errMsg && groups.map(([label, arr]) => (
          <div key={label} className="mb-3">
            <div className="text-center small text-muted mb-2">{label}</div>

            {arr.map((t) => (
              <div key={t.id} className="card mb-3 shadow-sm border-0">
                <div className="card-body py-3">
                  <div className="d-flex justify-content-between">
                    <div className="fw-semibold">{t.titulo}</div>
                    <div className="small text-muted text-end">
                      <div><strong>Creada:</strong> {formatDate(t.fechaCreacion)}</div>
                      <div><strong>Terminada:</strong> {formatDate(t.fechaTermino)}</div>
                    </div>
                  </div>

                  <div className="small mt-2">
                    <div><strong>Responsable:</strong> {t.responsable ?? "—"}</div>
                    <div><strong>Estado:</strong> {estadoLabel(t.estado)}</div>
                  </div>

                  {t.nota && (
                    <div className="mt-2 small">
                      <strong>Nota:</strong>{" "}
                      <span className="text-muted">{t.nota}</span>
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
        ))}
      </div>
    </div>
  );
}
