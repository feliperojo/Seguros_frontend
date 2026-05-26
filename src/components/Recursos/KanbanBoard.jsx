import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { FaPen, FaPlus, FaTrash } from "react-icons/fa";
import { TABLERO_COLUMNAS } from "../../services/tableroPersonalService";
import "../../styles/Recursos.css";

const emptyByColumn = () =>
  TABLERO_COLUMNAS.reduce((acc, col) => {
    acc[col.id] = [];
    return acc;
  }, {});

const KanbanBoard = forwardRef(({
  items = [],
  loading = false,
  onMove,
  onCreate,
  onUpdate,
  onDelete,
  readOnly = false,
  hideToolbar = false,
}, ref) => {
  const [dragItemId, setDragItemId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ titulo: "", descripcion: "", estado: "pendiente" });
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const map = emptyByColumn();
    (items || []).forEach((item) => {
      const col = item.estado || "pendiente";
      if (map[col]) map[col].push(item);
      else map.pendiente.push(item);
    });
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    });
    return map;
  }, [items]);

  const openNew = (estado = "pendiente") => {
    setEditing(null);
    setForm({ titulo: "", descripcion: "", estado });
    setShowModal(true);
  };

  useImperativeHandle(ref, () => ({
    openNew: () => openNew("pendiente"),
  }));

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      titulo: item.titulo || "",
      descripcion: item.descripcion || "",
      estado: item.estado || "pendiente",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.titulo?.trim()) return;
    setSaving(true);
    try {
      if (editing?.id) {
        await onUpdate?.(editing.id, {
          titulo: form.titulo.trim(),
          descripcion: form.descripcion?.trim() || null,
          estado: form.estado,
        });
      } else {
        await onCreate?.({
          titulo: form.titulo.trim(),
          descripcion: form.descripcion?.trim() || null,
          estado: form.estado,
        });
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (e, item) => {
    if (readOnly) return;
    setDragItemId(item.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e, columnId) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (readOnly || !dragItemId) return;
    const item = items.find((i) => i.id === dragItemId);
    setDragItemId(null);
    if (!item || item.estado === columnId) return;
    const orden = grouped[columnId]?.length ?? 0;
    try {
      await onMove?.(item.id, columnId, orden);
    } catch (err) {
      console.error("Error al mover tarjeta:", err);
      alert(
        err?.message ||
          "No se pudo cambiar el estado. Revisa que el backend acepte en_progreso en PATCH recursos/tablero/{id}/mover."
      );
    }
  };

  return (
    <>
      {!readOnly && !hideToolbar && (
        <div className="tablero-toolbar-actions mb-3">
          <Button variant="primary" size="sm" onClick={() => openNew("pendiente")}>
            <FaPlus className="me-1" /> Nueva actividad
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="secondary" />
          <p className="text-muted small mt-2 mb-0">Cargando tablero…</p>
        </div>
      ) : (
        <div className="kanban-board">
          {TABLERO_COLUMNAS.map((col) => (
            <div key={col.id} className="kanban-column" style={{ "--kanban-accent": col.color }}>
              <div className="kanban-column-header">
                <div>
                  <span>{col.label}</span>
                  {col.hint && <span className="column-hint d-block">{col.hint}</span>}
                </div>
                <span className="badge">{grouped[col.id]?.length ?? 0}</span>
              </div>
              <div
                className={`kanban-column-body${dragOverColumn === col.id ? " drag-over" : ""}`}
                onDragOver={(e) => {
                  if (readOnly) return;
                  e.preventDefault();
                  setDragOverColumn(col.id);
                }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {(grouped[col.id] || []).map((item) => (
                  <div
                    key={item.id}
                    className="kanban-card"
                    style={{ "--kanban-accent": col.color }}
                    draggable={!readOnly}
                    onDragStart={(e) => handleDragStart(e, item)}
                  >
                    <div className="kanban-card-title">{item.titulo}</div>
                    {item.descripcion && (
                      <div className="kanban-card-meta">{item.descripcion}</div>
                    )}
                    <div className="kanban-card-footer">
                      {item.acta_id ? (
                        <span className="kanban-card-acta-badge">Acta #{item.acta_id}</span>
                      ) : (
                        <span />
                      )}
                      {!readOnly && (
                        <div className="kanban-card-actions">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            title="Editar"
                            aria-label="Editar"
                            onClick={() => openEdit(item)}
                          >
                            <FaPen size={12} />
                          </Button>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            title="Eliminar"
                            aria-label="Eliminar"
                            onClick={() => onDelete?.(item.id)}
                          >
                            <FaTrash size={12} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {!readOnly && (
                  <button
                    type="button"
                    className="kanban-add-link btn btn-link"
                    onClick={() => openNew(col.id)}
                  >
                    + Agregar actividad
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title className="fs-6 fw-semibold">
            {editing ? "Editar actividad" : "Nueva actividad"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label className="small text-muted">Título</Form.Label>
            <Form.Control
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              placeholder="Compromiso o tema de seguimiento"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="small text-muted">Detalle (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Contexto, responsable o próximo paso"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small text-muted">Estado</Form.Label>
            <Form.Select
              value={form.estado}
              onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
            >
              {TABLERO_COLUMNAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-top">
          <Button variant="outline-secondary" size="sm" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" disabled={saving || !form.titulo?.trim()} onClick={handleSave}>
            {saving ? <Spinner size="sm" animation="border" /> : "Guardar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
});

KanbanBoard.displayName = "KanbanBoard";

export default KanbanBoard;
