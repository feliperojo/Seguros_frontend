// src/components/Tareas/HistorialTareasAuditoriaModal.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Modal, Button, Spinner, Alert, Badge, Nav } from "react-bootstrap";
import { getItemTasks, listTasks, getTaskComments } from "../../services/auditoriasTasksService";
import { getRunReporte } from "../../services/auditoriasService";
import { formatDateTimeForDisplay, formatDateForDisplay } from "../../utils/formatters";
import { highlightMentions } from "../../utils/mentions";

const resolveItemId = (c) =>
  c?.item_id || c?.auditoria_item_id || c?.audit_item_id || c?.id || null;

/** Misma lógica que GET /auditorias/tasks en CalendarioTareas (Laravel paginado u objetos anidados). */
const extractTasksListFromResponse = (res) => {
  if (res == null) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.tasks)) return res.data.tasks;
  if (Array.isArray(res?.tasks)) return res.tasks;
  return [];
};

const getTasksLastPage = (res) =>
  res?.meta?.last_page ??
  res?.last_page ??
  (typeof res?.data === "object" && !Array.isArray(res?.data) ? res.data.last_page : null) ??
  1;

/** Aplana id/status cuando la tarea viene envuelta en `task`. */
const normalizeAuditoriaTaskRow = (raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const nested = raw.task && typeof raw.task === "object" ? raw.task : {};
  const t = { ...nested, ...raw };
  t.id = t.id ?? t.task_id ?? t.tarea_id ?? t.task?.id ?? nested?.id ?? null;
  t.status = t.status ?? t.estado ?? t.state ?? t.task?.status ?? t.task?.estado ?? "pending";
  t.created_at = t.created_at ?? t.createdAt ?? t.task?.created_at ?? t.task?.createdAt ?? null;
  t.scheduled_date =
    t.scheduled_date ??
    t.scheduled_at ??
    t.fecha_programada ??
    t.task?.scheduled_date ??
    t.task?.scheduled_at ??
    null;
  t.cliente_id = t.cliente_id ?? t.cliente?.id ?? t.item?.cliente_id ?? t.item?.cliente?.id ?? null;
  t.cobertura_id =
    t.cobertura_id ?? t.cobertura?.id ?? t.item?.cobertura_id ?? t.item?.cobertura?.id ?? null;
  t.response_note =
    t.response_note ?? t.responseNote ?? t.nota_respuesta ?? t.task?.response_note ?? null;
  t.title =
    t.title ?? t.titulo ?? t.asunto ?? t.subject ?? t.task?.title ?? t.task?.titulo ?? null;
  t.description =
    t.description ??
    t.descripcion ??
    t.message ??
    t.mensaje ??
    t.notas ??
    t.note ??
    t.task?.description ??
    t.task?.descripcion ??
    null;
  return t;
};

const nonEmptyRichText = (v) => {
  if (v == null) return false;
  const plain = String(v)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return plain.length > 0;
};

const commentSortMs = (c) => {
  const t = new Date(c?.created_at || c?.fecha || c?.createdAt || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const taskMatchesCobertura = (t, cobertura) => {
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
    const tcl = t?.cliente_id ?? t?.cliente?.id ?? t?.item?.cliente_id ?? t?.item?.cliente?.id;
    if (tcl != null && Number(tcl) === Number(clid)) return true;
  }
  return false;
};

const pickFirstNonEmptyComment = (...values) => {
  for (const v of values) {
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
};

/** Comentario / nota del estado de auditoría (API puede usar varios nombres). */
const resolveAuditStateComment = (c) => {
  if (!c || typeof c !== "object") return null;
  const auditItem =
    c.audit_item && typeof c.audit_item === "object" ? c.audit_item : null;
  const item = c.item && typeof c.item === "object" ? c.item : null;
  return pickFirstNonEmptyComment(
    c.audit_comment,
    c.auditComment,
    c.comment,
    auditItem?.comment,
    auditItem?.audit_comment,
    auditItem?.comentario_auditoria,
    item?.comment,
    item?.audit_comment,
    item?.comentario_auditoria,
    c.comentario_auditoria,
    c.comentario_estado,
    c.prev_audit_comment,
    c.prev_comment,
    c.prev_audit_note,
    c.previous_audit_comment,
    c.notas,
    c.notes
  );
};

/** Comentario del ítem de auditoría anidado en filas de tareas (p. ej. GET /auditorias/tasks). */
const resolveAuditStateCommentFromTasks = (tasks) => {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  for (const raw of tasks) {
    const t = normalizeAuditoriaTaskRow(raw);
    const found = pickFirstNonEmptyComment(
      t?.audit_item?.comment,
      t?.audit_item?.audit_comment,
      t?.audit_item?.comentario_auditoria,
      t?.item?.comment,
      t?.item?.audit_comment,
      t?.item?.comentario_auditoria
    );
    if (found) return found;
  }
  return null;
};

const extractAuditItemFromTasksResponse = (res) => {
  if (!res || typeof res !== "object") return null;
  const nested =
    res.audit_item ??
    res.auditItem ??
    (typeof res.data === "object" && !Array.isArray(res.data)
      ? res.data.audit_item ?? res.data.auditItem
      : null);
  return nested && typeof nested === "object" ? nested : null;
};

/**
 * Lista todas las páginas de tareas para run + entidad (evita cortar en 100 ítems).
 */
const listTasksAllPagesForRun = async (runId, cobertura) => {
  const aggregated = [];
  let auditItem = null;
  let page = 1;
  let lastPage = 1;
  const maxPages = 40;

  do {
    const params = { run_id: runId, per_page: 100, page };
    if (cobertura?.cobertura_id != null) params.cobertura_id = cobertura.cobertura_id;
    else if (cobertura?.cliente_id != null) params.cliente_id = cobertura.cliente_id;

    const response = await listTasks(params);
    if (!auditItem) auditItem = extractAuditItemFromTasksResponse(response);
    const chunk = extractTasksListFromResponse(response).map(normalizeAuditoriaTaskRow);
    lastPage = Math.max(1, Number(getTasksLastPage(response)) || 1);
    aggregated.push(...chunk);
    page += 1;
  } while (page <= lastPage && page <= maxPages);

  return { tasks: aggregated, auditItem };
};

/** Busca fila del ítem de auditoría en el reporte de un run (p. ej. mes anterior). */
const findAuditContextFromRunReport = async (reportRunId, cobertura) => {
  if (!reportRunId || !cobertura) return null;
  const search =
    cobertura.codigo_poliza != null && String(cobertura.codigo_poliza).trim()
      ? String(cobertura.codigo_poliza).trim()
      : "";

  let page = 1;
  let lastPage = 1;
  const maxPages = 40;

  do {
    const params = { page, per_page: 100 };
    if (search) params.search = search;

    const rep = await getRunReporte(reportRunId, params);
    const rows = Array.isArray(rep) ? rep : rep?.data ?? [];
    if (!Array.isArray(rows)) break;

    for (const row of rows) {
      if (taskMatchesCobertura(row, cobertura)) {
        const iid = resolveItemId(row);
        if (iid) return { itemId: iid, row };
      }
    }

    lastPage = Math.max(1, Number(rep?.meta?.last_page) || 1);
    page += 1;
  } while (page <= lastPage && page <= maxPages);

  return null;
};

const getAuditoriaTaskNumericId = (t) => {
  const raw = t?.id ?? t?.task_id ?? t?.tarea_id ?? t?.task?.id ?? null;
  const n = typeof raw === "string" ? Number(raw) : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const taskStatusLabel = (status) => {
  if (status === "completed") return "Completada";
  if (status === "in_progress") return "En progreso";
  if (status === "pending") return "Pendiente";
  return status || "—";
};

const taskStatusVariant = (status) => {
  if (status === "completed") return "success";
  if (status === "in_progress") return "warning";
  if (status === "pending") return "secondary";
  return "light";
};

/** Misma regla que en `AuditoriaRunDetallePage`: pendiente heredado del run anterior. */
const filaPendienteAuditoriaAnterior = (row) => {
  const periodo = row?.prev_periodo;
  const tienePeriodo = periodo != null && String(periodo).trim() !== "";
  return row?.prev_no_ok === true && tienePeriodo;
};

const buildCoberturaVistaAnterior = (row) => {
  if (!row || typeof row !== "object") return row;
  const prevAuditItem =
    row.prev_audit_item && typeof row.prev_audit_item === "object"
      ? row.prev_audit_item
      : null;
  return {
    ...row,
    audit_status: row.prev_audit_status ?? row.audit_status,
    audit_comment:
      row.prev_audit_comment ??
      row.prev_comment ??
      row.prev_audit_notes ??
      row.prev_comentario ??
      row.comentario_auditoria_anterior ??
      prevAuditItem?.comment ??
      prevAuditItem?.audit_comment ??
      null,
    audit_item: prevAuditItem ?? row.audit_item ?? null,
    reviewed_at: row.prev_reviewed_at ?? null,
  };
};

/**
 * Modal de solo lectura: tareas del ítem de auditoría y comentarios de cada tarea,
 * más el comentario asociado al estado de auditoría del registro (si existe).
 *
 * `runId` = run de la auditoría actual (URL). Si la fila trae `prev_run_id` y marca pendiente
 * de periodo anterior, se ofrece una segunda pestaña con el mismo historial sobre ese run.
 */
const HistorialTareasAuditoriaModal = ({ show, onHide, runId, cobertura }) => {
  const [vista, setVista] = useState("actual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [commentsByTaskId, setCommentsByTaskId] = useState({});
  /** Comentario de estado resuelto desde API de tareas o reporte del run (fallback). */
  const [loadedAuditComment, setLoadedAuditComment] = useState(null);

  const prevRunId = useMemo(() => {
    const r = cobertura?.prev_run_id;
    if (r == null || r === "") return null;
    return r;
  }, [cobertura]);

  const mostrarPestanaAnterior = useMemo(
    () => Boolean(cobertura && filaPendienteAuditoriaAnterior(cobertura) && prevRunId != null),
    [cobertura, prevRunId]
  );

  useEffect(() => {
    if (show) setVista("actual");
  }, [show, cobertura?.cobertura_id, cobertura?.cliente_id, cobertura?.codigo_poliza]);

  useEffect(() => {
    if (!mostrarPestanaAnterior && vista === "anterior") {
      setVista("actual");
    }
  }, [mostrarPestanaAnterior, vista]);

  const { effectiveRunId, effectiveCobertura, skipItemTasksLookup } = useMemo(() => {
    if (!cobertura || !runId) {
      return { effectiveRunId: null, effectiveCobertura: null, skipItemTasksLookup: false };
    }
    if (vista === "anterior" && mostrarPestanaAnterior && prevRunId != null) {
      return {
        effectiveRunId: prevRunId,
        effectiveCobertura: buildCoberturaVistaAnterior(cobertura),
        skipItemTasksLookup: true,
      };
    }
    return { effectiveRunId: runId, effectiveCobertura: cobertura, skipItemTasksLookup: false };
  }, [vista, cobertura, runId, mostrarPestanaAnterior, prevRunId]);

  const loadHistorial = useCallback(async () => {
    if (!effectiveCobertura || !effectiveRunId) return;

    setLoading(true);
    setError(null);
    setTasks([]);
    setCommentsByTaskId({});
    setLoadedAuditComment(null);

    const prevDedicatedItemId =
      effectiveCobertura?.prev_item_id ??
      effectiveCobertura?.prev_auditoria_item_id ??
      effectiveCobertura?.prev_audit_item_id ??
      null;

    let primaryItemId = null;
    if (!skipItemTasksLookup) {
      primaryItemId = resolveItemId(effectiveCobertura);
    } else if (prevDedicatedItemId) {
      primaryItemId = prevDedicatedItemId;
    }

    let taskList = [];
    let extraAuditComment = null;

    try {
      if (primaryItemId) {
        try {
          taskList = await getItemTasks(primaryItemId);
        } catch (e) {
          console.warn("Historial: getItemTasks falló, se intentará listado:", e);
          taskList = [];
        }
      }

      if (!Array.isArray(taskList) || taskList.length === 0) {
        if (effectiveCobertura.cobertura_id != null || effectiveCobertura.cliente_id != null) {
          const { tasks: all, auditItem } = await listTasksAllPagesForRun(
            effectiveRunId,
            effectiveCobertura
          );
          if (!extraAuditComment && auditItem) {
            extraAuditComment = resolveAuditStateComment(auditItem);
          }
          const filtered = all.filter((t) => taskMatchesCobertura(t, effectiveCobertura));
          taskList = filtered.length > 0 ? filtered : all;
        }
      }

      if ((!Array.isArray(taskList) || taskList.length === 0) && effectiveRunId) {
        const reportCtx = await findAuditContextFromRunReport(effectiveRunId, effectiveCobertura);
        if (reportCtx?.row && !extraAuditComment) {
          extraAuditComment = resolveAuditStateComment(reportCtx.row);
        }
        if (reportCtx?.itemId) {
          try {
            const fromReport = await getItemTasks(reportCtx.itemId);
            if (Array.isArray(fromReport) && fromReport.length > 0) {
              taskList = fromReport;
            }
          } catch (e) {
            console.warn("Historial: getItemTasks(reporte run) falló:", e);
          }
        }
      }

      taskList = (Array.isArray(taskList) ? taskList : []).map(normalizeAuditoriaTaskRow);

      if (
        !extraAuditComment &&
        !resolveAuditStateComment(effectiveCobertura) &&
        (effectiveCobertura.cobertura_id != null || effectiveCobertura.cliente_id != null)
      ) {
        const params = { run_id: effectiveRunId, per_page: 100, page: 1 };
        if (effectiveCobertura.cobertura_id != null) {
          params.cobertura_id = effectiveCobertura.cobertura_id;
        } else {
          params.cliente_id = effectiveCobertura.cliente_id;
        }
        try {
          const tasksMetaResponse = await listTasks(params);
          const auditItemMeta = extractAuditItemFromTasksResponse(tasksMetaResponse);
          if (auditItemMeta) {
            extraAuditComment = resolveAuditStateComment(auditItemMeta);
          }
          if (!extraAuditComment) {
            const listed = extractTasksListFromResponse(tasksMetaResponse).map(normalizeAuditoriaTaskRow);
            extraAuditComment = resolveAuditStateCommentFromTasks(listed);
          }
        } catch (e) {
          console.warn("Historial: listTasks (comentario de estado) falló:", e);
        }
      }

      if (!extraAuditComment) {
        extraAuditComment = resolveAuditStateCommentFromTasks(taskList);
      }
      if (extraAuditComment) {
        setLoadedAuditComment(extraAuditComment);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Error al cargar el historial";
      setError(msg);
      setLoading(false);
      return;
    }

    const sorted = [...taskList].sort((a, b) => {
      const da = new Date(a.created_at || a.createdAt || 0).getTime();
      const db = new Date(b.created_at || b.createdAt || 0).getTime();
      return db - da;
    });
    setTasks(sorted);

    const byId = {};
    await Promise.all(
      sorted.map(async (t) => {
        const tid = getAuditoriaTaskNumericId(t);
        if (!tid) return;
        try {
          const data = await getTaskComments(tid);
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
              ? data.data
              : extractTasksListFromResponse(data);
          byId[tid] = list;
        } catch (e) {
          console.warn(`Historial: sin comentarios para tarea ${tid}`, e);
          byId[tid] = [];
        }
      })
    );
    setCommentsByTaskId(byId);
    setLoading(false);
  }, [effectiveCobertura, effectiveRunId, skipItemTasksLookup]);

  useEffect(() => {
    if (show && effectiveCobertura && effectiveRunId) {
      void loadHistorial();
    }
  }, [show, effectiveCobertura, effectiveRunId, loadHistorial]);

  const auditStatus = effectiveCobertura?.audit_status
    ? String(effectiveCobertura.audit_status).toUpperCase()
    : "PENDIENTE";
  const auditComment = useMemo(
    () =>
      resolveAuditStateComment(effectiveCobertura) ||
      loadedAuditComment ||
      resolveAuditStateCommentFromTasks(tasks) ||
      null,
    [effectiveCobertura, loadedAuditComment, tasks]
  );
  const reviewedAt = effectiveCobertura?.reviewed_at;

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      scrollable
      centered
      dialogClassName="historial-auditoria-modal-dialog"
      contentClassName="historial-auditoria-modal-content"
    >
      <style>{`
        .historial-auditoria-modal-dialog {
          max-width: min(1140px, 96vw);
        }
        .historial-auditoria-modal-content .tarea-msg-body {
          line-height: 1.55;
          font-size: 0.95rem;
        }
        .historial-auditoria-modal-content .tarea-msg-body p:last-child {
          margin-bottom: 0;
        }
      `}</style>
      <Modal.Header closeButton>
        <Modal.Title>Historial — tareas y comentarios</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {cobertura && (
          <p className="text-muted small mb-2">
            <strong>Cliente:</strong> {cobertura.cliente || "—"} · <strong>Numero ID:</strong>{" "}
            {cobertura.codigo_poliza || "—"}
          </p>
        )}

        {mostrarPestanaAnterior && (
          <Nav
            variant="tabs"
            className="mb-3 flex-nowrap"
            activeKey={vista}
            onSelect={(k) => {
              if (k === "actual" || k === "anterior") setVista(k);
            }}
          >
            <Nav.Item>
              <Nav.Link eventKey="actual" className="text-nowrap">
                Este periodo
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="anterior" className="text-nowrap">
                Auditoría anterior
                {cobertura?.prev_periodo ? (
                  <span className="text-muted"> ({String(cobertura.prev_periodo)})</span>
                ) : null}
              </Nav.Link>
            </Nav.Item>
          </Nav>
        )}

        <h6 className="text-uppercase text-muted small mb-2 fw-semibold">Estado de auditoría</h6>
        <div className="border rounded-3 p-3 mb-4 bg-light">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <Badge bg="secondary">{auditStatus}</Badge>
            {reviewedAt && (
              <span className="text-muted small">
                Revisado: {formatDateTimeForDisplay(reviewedAt)}
              </span>
            )}
          </div>
          {auditComment ? (
            <div
              className="tarea-msg-body text-body"
              style={{ wordBreak: "break-word" }}
              dangerouslySetInnerHTML={{ __html: highlightMentions(auditComment) }}
            />
          ) : (
            <span className="text-muted small">Sin comentario asociado al estado.</span>
          )}
        </div>

        <h6 className="text-uppercase text-muted small mb-3 fw-semibold">Tareas de auditoría</h6>

        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            <span className="text-muted">Cargando historial…</span>
          </div>
        )}

        {!loading && error && <Alert variant="danger">{error}</Alert>}

        {!loading && !error && tasks.length === 0 && (
          <Alert variant="info" className="mb-0">
            No hay tareas registradas para este ítem de auditoría.
          </Alert>
        )}

        {!loading &&
          !error &&
          tasks.map((tarea, tIndex) => {
            const tid = getAuditoriaTaskNumericId(tarea);
            const comentarios = tid ? commentsByTaskId[tid] || [] : [];
            const comentariosOrdenados = [...comentarios].sort(
              (a, b) => commentSortMs(a) - commentSortMs(b)
            );
            const asignado =
              tarea.assigned_user?.name ||
              tarea.assign_to_user?.name ||
              tarea.asignado_a ||
              "—";
            const tituloTarea =
              tarea.title && String(tarea.title).trim() ? String(tarea.title).trim() : null;
            const descripcionTarea =
              tarea.description && nonEmptyRichText(tarea.description) ? tarea.description : null;
            const notaCierre =
              tarea.response_note && nonEmptyRichText(tarea.response_note) ? tarea.response_note : null;

            return (
              <div
                key={tid ?? `tarea-${tIndex}`}
                className="border rounded-3 mb-4 overflow-hidden shadow-sm"
              >
                <div className="px-3 py-3 bg-body-secondary border-bottom d-flex flex-wrap justify-content-between align-items-start gap-2">
                  <div className="min-w-0">
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                      <Badge bg={taskStatusVariant(tarea.status)} className="px-2 py-2">
                        {taskStatusLabel(tarea.status)}
                      </Badge>
                      <span className="text-muted small">Tarea #{tid}</span>
                    </div>
                    {tituloTarea && (
                      <div className="fw-semibold text-body text-break fs-6 mt-1">{tituloTarea}</div>
                    )}
                  </div>
                  <span className="text-muted small text-nowrap">
                    {tarea.created_at || tarea.createdAt
                      ? formatDateTimeForDisplay(tarea.created_at || tarea.createdAt)
                      : ""}
                  </span>
                </div>

                <div className="px-3 py-3 bg-white border-bottom">
                  <div className="row g-2 small text-body mb-3">
                    <div className="col-12 col-sm-6">
                      <span className="text-uppercase text-muted fw-semibold d-block" style={{ fontSize: "0.68rem" }}>
                        Asignada a
                      </span>
                      <span className="fs-6">{asignado}</span>
                    </div>
                    {tarea.due_date && (
                      <div className="col-12 col-sm-6">
                        <span className="text-uppercase text-muted fw-semibold d-block" style={{ fontSize: "0.68rem" }}>
                          Vence
                        </span>
                        <span className="fs-6">{formatDateForDisplay(tarea.due_date)}</span>
                      </div>
                    )}
                    {(tarea.scheduled_date || tarea.scheduled_at) && (
                      <div className="col-12 col-sm-6">
                        <span className="text-uppercase text-muted fw-semibold d-block" style={{ fontSize: "0.68rem" }}>
                          Programada
                        </span>
                        <span className="fs-6">
                          {formatDateForDisplay(tarea.scheduled_date || tarea.scheduled_at)}
                        </span>
                      </div>
                    )}
                  </div>

                  {descripcionTarea && (
                    <div className="rounded-3 border border-light-subtle bg-light p-3 mb-0">
                      <div className="text-uppercase text-muted fw-semibold mb-2" style={{ fontSize: "0.68rem" }}>
                        Descripción / nota de la tarea
                      </div>
                      <div
                        className="tarea-msg-body text-body"
                        style={{ wordBreak: "break-word" }}
                        dangerouslySetInnerHTML={{
                          __html: highlightMentions(descripcionTarea),
                        }}
                      />
                    </div>
                  )}

                  {notaCierre && (
                    <div
                      className={`rounded-3 border p-3 bg-primary-subtle border-primary-subtle ${
                        descripcionTarea ? "mt-3" : ""
                      }`}
                    >
                      <div className="text-uppercase text-primary fw-semibold mb-2" style={{ fontSize: "0.68rem" }}>
                        Nota de cierre o respuesta
                      </div>
                      <div
                        className="tarea-msg-body text-body"
                        style={{ wordBreak: "break-word" }}
                        dangerouslySetInnerHTML={{
                          __html: highlightMentions(notaCierre),
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="px-3 py-3 bg-light">
                  <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-3">
                    <span className="text-uppercase text-muted fw-semibold" style={{ fontSize: "0.72rem" }}>
                      Mensajes y comentarios
                    </span>
                    <Badge bg="secondary" pill className="fw-normal">
                      {comentariosOrdenados.length}
                    </Badge>
                  </div>
                  {comentariosOrdenados.length === 0 ? (
                    <span className="text-muted">Sin mensajes en el hilo de esta tarea.</span>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {comentariosOrdenados.map((c) => (
                        <div
                          key={c.id ?? `${tid}-${commentSortMs(c)}`}
                          className="rounded-3 border bg-white p-3 shadow-sm"
                        >
                          <div className="d-flex flex-wrap justify-content-between gap-2 mb-2 pb-2 border-bottom border-light">
                            <span className="fw-semibold text-body">
                              {c.user?.name || c.user?.nombre || c.created_by?.name || "Usuario"}
                            </span>
                            <span className="text-muted small text-nowrap">
                              {formatDateTimeForDisplay(c.created_at || c.fecha || c.createdAt)}
                            </span>
                          </div>
                          <div
                            className="tarea-msg-body text-body"
                            style={{ wordBreak: "break-word" }}
                            dangerouslySetInnerHTML={{
                              __html: highlightMentions(
                                c.comment ||
                                  c.response_note ||
                                  c.note ||
                                  "<span class='text-muted'>(sin texto)</span>"
                              ),
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default HistorialTareasAuditoriaModal;
