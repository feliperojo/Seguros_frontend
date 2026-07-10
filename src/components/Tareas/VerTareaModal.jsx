import React, { useEffect, useState, useCallback } from "react";
import { Modal, Button, Spinner, Card, Row, Col, Badge } from "react-bootstrap";
import apiRequest from "../../services/api";
import { formatTaskTimeDhm } from "../../utils/formatters";

/** Quita etiquetas HTML y devuelve solo texto plano */
const limpiarHtml = (html) => {
  if (!html) return "";
  try {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = String(html);
    return (tmp.textContent || tmp.innerText || "").trim();
  } catch {
    return String(html).replace(/<[^>]*>/g, "").trim();
  }
};

const formatDate = (val) => {
  if (!val) return "N/A";
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "N/A";
  }
};

/**
 * Modal informativo: muestra solo datos de la tarea y sus comentarios.
 * No incluye historial del cliente ni formulario de respuesta.
 */
const VerTareaModal = ({ show, onHide, taskId }) => {
  const [task, setTask] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    if (!taskId || !show) return;
    setLoading(true);
    setError("");
    setTask(null);
    setComentarios([]);
    try {
      const [taskRes, commentsRes] = await Promise.all([
        apiRequest(`tareas_operativas/${taskId}`, "GET"),
        apiRequest(`tareas_operativas/${taskId}/comentarios`, "GET").catch(() => []),
      ]);
      let t = taskRes?.data || taskRes || {};
      if (!t.id && !t.task_id) {
        if (taskRes?.id) t = taskRes;
        else if (taskRes?.task) t = taskRes.task;
      }
      if (!t.log?.cliente?.id && (t.log?.cliente_id || t.log_id)) {
        try {
          const logId = t.log?.id || t.log_id || t.bitacora_operativa_id;
          if (logId) {
            const logRes = await apiRequest(`bitacora_operativa/${logId}`, "GET");
            const log = logRes?.data || logRes;
            if (log) {
              let cliente = log.cliente;
              if (!cliente?.id && log.cliente_id) {
                const cliRes = await apiRequest(`cliente/${log.cliente_id}`, "GET");
                cliente = cliRes?.data || cliRes;
              }
              t = { ...t, log: { ...(t.log || {}), ...log, cliente: cliente || t.log?.cliente } };
            }
          }
        } catch (e) {
          console.warn("No se pudo cargar log/cliente:", e);
        }
      }
      setTask(t);
      let list = [];
      if (Array.isArray(commentsRes)) list = commentsRes;
      else if (Array.isArray(commentsRes?.data)) list = commentsRes.data;
      else if (commentsRes?.data?.data && Array.isArray(commentsRes.data.data)) list = commentsRes.data.data;
      else if (commentsRes?.comments && Array.isArray(commentsRes.comments)) list = commentsRes.comments;
      setComentarios(list);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || "Error al cargar la tarea.");
    } finally {
      setLoading(false);
    }
  }, [taskId, show]);

  useEffect(() => {
    if (show && taskId) cargar();
  }, [show, taskId, cargar]);

  const onClose = () => {
    setTask(null);
    setComentarios([]);
    setError("");
    onHide?.();
  };

  const toStr = (v) => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") {
      const n = v.name ?? v.nombre;
      return n != null ? String(n) : "";
    }
    return "";
  };
  const conceptObj = task?.log?.concept ?? task?.concept ?? {};
  const conceptoPadre =
    toStr(conceptObj?.parent) ||
    conceptObj?.parent_name ||
    toStr(task?.log?.concept_parent) ||
    toStr(task?.concept_parent) ||
    task?.concepto_padre ||
    task?.log?.concepto_padre ||
    task?.parent_concept_name ||
    "";
  const conceptoHijo =
    toStr(task?.concepto) ||
    toStr(task?.log?.concepto) ||
    toStr(conceptObj) ||
    task?.log?.concept_name ||
    task?.concept_name ||
    task?.concept_hijo ||
    task?.subconcept_name ||
    "";
  const concepto = conceptoHijo || conceptoPadre || "N/A";
  const clienteNombre =
    task?.log?.cliente?.nombre_completo ??
    task?.log?.cliente?.nombre ??
    task?.cliente_nombre ??
    task?.cliente?.nombre_completo ??
    task?.cliente?.nombre ??
    "N/A";
  const usuarioAsignado =
    toStr(task?.asignado_a) ||
    toStr(task?.log?.asignado_a) ||
    (task?.assigned_user?.name ??
      task?.assigned_user?.nombre ??
      task?.assignedUser?.name ??
      task?.assign_to_user?.name ??
      task?.assign_to_user?.nombre ??
      task?.assigned_to_user?.name ??
      task?.assigned_to_user?.nombre ??
      task?.log?.assigned_user?.name ??
      task?.assign_to_user_name ??
      task?.assigned_to_name ??
      task?.assigned_user_name ??
      task?.responsable ??
      "N/A");
  const programada = task?.scheduled_date ?? task?.scheduled_at ?? task?.fechaProgramada ?? null;
  const vencimiento = task?.due_date ?? task?.due_at ?? task?.fechaLimite ?? null;
  const asignadaPor =
    toStr(task?.creado_por) ||
    toStr(task?.log?.creado_por) ||
    (task?.log?.user?.name ??
      task?.log?.user?.nombre ??
      task?.log?.created_by?.name ??
      task?.created_by?.name ??
      task?.created_by?.nombre ??
      task?.created_by_name ??
      task?.creado_por_name ??
      task?.assigned_by?.name ??
      task?.log?.created_by_name ??
      "N/A");
  const nota =
    task?.log?.nota ?? task?.log?.body ?? task?.nota ?? task?.note ?? task?.description ?? task?.descripcion ?? "";
  const notaTexto = limpiarHtml(nota) || "Sin nota";
  const estado = task?.estado ?? task?.status ?? task?.state ?? "";

  const statusBadge = (status) => {
    const s = String(status || "").toLowerCase();
    if (["done", "completed", "complete", "completada", "terminada"].includes(s)) return <Badge bg="success">Completada</Badge>;
    if (["in_progress", "processing", "en progreso"].includes(s)) return <Badge bg="info">En progreso</Badge>;
    if (["pending", "pendiente"].includes(s)) return <Badge bg="warning" text="dark">Pendiente</Badge>;
    return status ? <Badge bg="secondary">{status}</Badge> : null;
  };

  const infoRow = (label, value) => (
    <Row className="mb-2">
      <Col xs={4} className="fw-semibold text-secondary">{label}:</Col>
      <Col xs={8} style={{ whiteSpace: "pre-wrap" }}>{value ?? "N/A"}</Col>
    </Row>
  );

  return (
    <Modal show={show} onHide={onClose} centered size="lg" scrollable>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          Ver tarea
          {task?.id || task?.task_id ? (
            <Badge bg="primary">ID: {task.id ?? task.task_id}</Badge>
          ) : null}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <Spinner animation="border" />
          </div>
        ) : error ? (
          <div className="text-danger py-3">{error}</div>
        ) : !task ? null : (
          <>
            <Card className="mb-3 shadow-sm">
              <Card.Header className="bg-light">Detalles de la tarea</Card.Header>
              <Card.Body>
                {(conceptoPadre || conceptoHijo) ? (
                  <>
                    {conceptoPadre ? infoRow("Concepto padre", conceptoPadre) : null}
                    {conceptoHijo ? infoRow("Concepto (hijo/subconcepto)", conceptoHijo) : null}
                  </>
                ) : (
                  infoRow("Concepto", concepto)
                )}
                {infoRow("Cliente", clienteNombre)}
                {infoRow("Usuario asignado", usuarioAsignado)}
                {infoRow("Programada", formatDate(programada))}
                {infoRow("Vencimiento", formatDate(vencimiento))}
                {infoRow("Asignada por", asignadaPor)}
                {estado ? (
                  <Row className="mb-2">
                    <Col xs={4} className="fw-semibold text-secondary">Estado:</Col>
                    <Col xs={8}>{statusBadge(estado)}</Col>
                  </Row>
                ) : null}
                <Row className="mb-2">
                  <Col xs={4} className="fw-semibold text-secondary">Nota:</Col>
                  <Col xs={8} style={{ whiteSpace: "pre-wrap" }}>{notaTexto}</Col>
                </Row>
                {formatTaskTimeDhm(task) !== "—" && infoRow("Tiempo dedicado", formatTaskTimeDhm(task))}
              </Card.Body>
            </Card>

            <h6 className="mb-2">Comentarios de esta tarea</h6>
            {!Array.isArray(comentarios) || comentarios.length === 0 ? (
              <p className="text-muted fst-italic">No hay comentarios para esta tarea.</p>
            ) : (
              <div style={{ maxHeight: 320, overflowY: "auto" }} className="pe-2">
                {comentarios.map((c, idx) => {
                  const user = c?.user || c?.user_id || {};
                  const texto = limpiarHtml(c?.note ?? c?.comment ?? c?.texto ?? c?.body ?? "");
                  const fecha = c?.created_at ?? c?.fecha_creacion;
                  return (
                    <Card key={c?.id ?? idx} className="mb-2">
                      <Card.Body className="py-2 px-3">
                        <div className="d-flex justify-content-between align-items-start small text-muted mb-1">
                          <span>{user?.name ?? c?.user_name ?? "Usuario"}</span>
                          {fecha && <span>{new Date(fecha).toLocaleString("es-CO")}</span>}
                        </div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{texto || "—"}</div>
                      </Card.Body>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default VerTareaModal;
