// src/components/Tareas/HistorialTareasAuditoriaModal.jsx
import React, { useEffect, useState, useCallback } from "react";
import { Modal, Button, Spinner, Alert, Badge, ListGroup } from "react-bootstrap";
import { getItemTasks, listTasks, getTaskComments } from "../../services/auditoriasTasksService";
import { formatDateTimeForDisplay, formatDateForDisplay } from "../../utils/formatters";
import { highlightMentions } from "../../utils/mentions";

const resolveItemId = (c) =>
  c?.item_id || c?.auditoria_item_id || c?.audit_item_id || c?.id || null;

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

/**
 * Modal de solo lectura: tareas del ítem de auditoría y comentarios de cada tarea,
 * más el comentario asociado al estado de auditoría del registro (si existe).
 */
const HistorialTareasAuditoriaModal = ({
  show,
  onHide,
  runId,
  cobertura,
  skipItemTasksLookup = false,
  titleSuffix = "",
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [commentsByTaskId, setCommentsByTaskId] = useState({});

  const loadHistorial = useCallback(async () => {
    if (!cobertura || !runId) return;

    setLoading(true);
    setError(null);
    setTasks([]);
    setCommentsByTaskId({});

    const itemId = skipItemTasksLookup ? null : resolveItemId(cobertura);
    let taskList = [];

    try {
      if (itemId) {
        try {
          taskList = await getItemTasks(itemId);
        } catch (e) {
          console.warn("Historial: getItemTasks falló, se intentará listTasks:", e);
          taskList = [];
        }
      }

      if (!Array.isArray(taskList) || taskList.length === 0) {
        const params = { run_id: runId, per_page: 100 };
        if (cobertura.cobertura_id) params.cobertura_id = cobertura.cobertura_id;
        else if (cobertura.cliente_id) params.cliente_id = cobertura.cliente_id;

        if (params.cobertura_id || params.cliente_id) {
          const response = await listTasks(params);
          const raw = response?.data ?? response ?? [];
          const arr = Array.isArray(raw) ? raw : [];
          const cid = cobertura.cobertura_id;
          const clid = cobertura.cliente_id;
          const filtered = arr.filter((t) => {
            if (cid) {
              const tc =
                t?.cobertura_id ??
                t?.cobertura?.id ??
                t?.item?.cobertura_id ??
                t?.item?.cobertura?.id;
              if (tc != null && Number(tc) === Number(cid)) return true;
            }
            if (clid) {
              const tcl =
                t?.cliente_id ??
                t?.cliente?.id ??
                t?.item?.cliente_id ??
                t?.item?.cliente?.id;
              if (tcl != null && Number(tcl) === Number(clid)) return true;
            }
            return false;
          });
          taskList = filtered.length > 0 ? filtered : arr;
        }
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
        if (!t?.id) return;
        try {
          const data = await getTaskComments(t.id);
          const list = Array.isArray(data) ? data : data?.data || [];
          byId[t.id] = list;
        } catch (e) {
          console.warn(`Historial: sin comentarios para tarea ${t.id}`, e);
          byId[t.id] = [];
        }
      })
    );
    setCommentsByTaskId(byId);
    setLoading(false);
  }, [cobertura, runId, skipItemTasksLookup]);

  useEffect(() => {
    if (show && cobertura && runId) {
      void loadHistorial();
    }
  }, [show, cobertura, runId, loadHistorial]);

  const auditStatus = cobertura?.audit_status ? String(cobertura.audit_status).toUpperCase() : "PENDIENTE";
  const auditComment = cobertura?.audit_comment?.trim?.() ? cobertura.audit_comment : null;
  const reviewedAt = cobertura?.reviewed_at;

  return (
    <Modal show={show} onHide={onHide} size="lg" scrollable centered>
      <Modal.Header closeButton>
        <Modal.Title>
          Historial — tareas y comentarios
          {titleSuffix}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {cobertura && (
          <p className="text-muted small mb-3">
            <strong>Cliente:</strong> {cobertura.cliente || "—"} · <strong>Numero ID:</strong>{" "}
            {cobertura.codigo_poliza || "—"}
          </p>
        )}

        <h6 className="text-uppercase text-muted small mb-2">Estado de auditoría</h6>
        <div className="border rounded p-3 mb-4 bg-light">
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
              className="small"
              style={{ wordBreak: "break-word" }}
              dangerouslySetInnerHTML={{ __html: highlightMentions(auditComment) }}
            />
          ) : (
            <span className="text-muted small">Sin comentario asociado al estado.</span>
          )}
        </div>

        <h6 className="text-uppercase text-muted small mb-2">Tareas de auditoría</h6>

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
            const tid = tarea.id;
            const comentarios = tid ? commentsByTaskId[tid] || [] : [];
            const asignado =
              tarea.assigned_user?.name ||
              tarea.assign_to_user?.name ||
              tarea.asignado_a ||
              "—";

            return (
              <div key={tid ?? `tarea-${tIndex}`} className="border rounded mb-3 overflow-hidden">
                <div className="px-3 py-2 bg-white border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div>
                    <Badge bg={taskStatusVariant(tarea.status)} className="me-2">
                      {taskStatusLabel(tarea.status)}
                    </Badge>
                    <span className="small text-muted">Tarea #{tid}</span>
                  </div>
                  <span className="small text-muted">
                    {tarea.created_at || tarea.createdAt
                      ? formatDateTimeForDisplay(tarea.created_at || tarea.createdAt)
                      : ""}
                  </span>
                </div>
                <div className="px-3 py-2 small bg-white">
                  <div className="mb-1">
                    <strong>Asignada a:</strong> {asignado}
                  </div>
                  {tarea.due_date && (
                    <div className="mb-1 text-muted">
                      <strong>Vence:</strong> {formatDateForDisplay(tarea.due_date)}
                    </div>
                  )}
                  {tarea.response_note && (
                    <div className="mt-2 p-2 bg-light rounded small">
                      <strong className="d-block mb-1">Nota de cierre / respuesta</strong>
                      <div
                        style={{ wordBreak: "break-word" }}
                        dangerouslySetInnerHTML={{
                          __html: highlightMentions(tarea.response_note),
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="px-3 py-2 bg-light border-top">
                  <div className="small fw-semibold text-muted mb-2">
                    Comentarios ({comentarios.length})
                  </div>
                  {comentarios.length === 0 ? (
                    <span className="small text-muted">Sin comentarios en esta tarea.</span>
                  ) : (
                    <ListGroup variant="flush" className="rounded border">
                      {comentarios.map((c) => (
                        <ListGroup.Item key={c.id} className="small">
                          <div className="d-flex justify-content-between gap-2 mb-1">
                            <span className="fw-medium">
                              {c.user?.name || c.user?.nombre || c.created_by?.name || "Usuario"}
                            </span>
                            <span className="text-muted text-nowrap">
                              {formatDateTimeForDisplay(c.created_at || c.fecha || c.createdAt)}
                            </span>
                          </div>
                          <div
                            style={{ wordBreak: "break-word" }}
                            dangerouslySetInnerHTML={{
                              __html: highlightMentions(
                                c.comment || c.response_note || c.note || "<span class='text-muted'>(vacío)</span>"
                              ),
                            }}
                          />
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
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
