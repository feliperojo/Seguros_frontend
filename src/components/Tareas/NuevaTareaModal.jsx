import React, { useEffect, useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import apiRequest from "../../services/api";

const NuevaTareaModal = ({ show, onHide, onCreated, categoria = "tarea_manual" }) => {
  const hoy = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    concept_id: "",
    note: "",
    cliente_id: "",
    grupo_familiar_id: "",
    assign_to_user_id: "",
    scheduled_date: hoy,
    due_date: hoy,
  });

  const [conceptos, setConceptos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [conceptosPadres, setConceptosPadres] = useState([]);
  const [subconceptos, setSubconceptos] = useState([]);
  const [conceptoPadreId, setConceptoPadreId] = useState("");

  useEffect(() => {
    if (show) {
      Promise.all([
        apiRequest(`operational_concepts?only_parents=true`, "GET"),
        apiRequest("cliente", "GET"),
        apiRequest("grupo_familiar", "GET"),
        apiRequest("users", "GET"),
      ]).then(([conceptos, clientes, grupos, usuarios]) => {
        setConceptosPadres(conceptos);
        setConceptos([]);
        setClientes(clientes);
        setGrupos(grupos);
        setUsuarios(usuarios);
      });

      // Reset campos al abrir
      setFormData({
        concept_id: "",
        note: "",
        cliente_id: "",
        grupo_familiar_id: "",
        assign_to_user_id: "",
        scheduled_date: hoy,
        due_date: hoy,
      });
    }
  }, [show, categoria]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePadreChange = async (e) => {
    const selectedId = e.target.value;
    setConceptoPadreId(selectedId);
    setFormData((prev) => ({ ...prev, concept_id: "" }));

    if (selectedId) {
      const hijos = await apiRequest(`operational_concepts/${selectedId}/subconcepts`, "GET");
      setSubconceptos(hijos);
      setConceptos(hijos);
    } else {
      setConceptos([]);
    }
  };

  const validarCampos = () => {
    const nuevosErrores = {};
    if (!formData.concept_id) nuevosErrores.concept_id = "El concepto es obligatorio";
    if (!formData.note.trim()) nuevosErrores.note = "La nota es obligatoria";
    if (!formData.cliente_id) nuevosErrores.cliente_id = "El cliente es obligatorio";
    if (!formData.assign_to_user_id) nuevosErrores.assign_to_user_id = "Debes asignar la tarea a un usuario";
    setErrors(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async () => {
    if (!validarCampos()) return;
    setLoading(true);
    try {
      const response = await apiRequest("bitacora_operativa/create", "POST", {
        ...formData,
        action_type: "manual",
      });
  
      const conceptoSeleccionado = conceptos.find(c => c.id === parseInt(formData.concept_id));
  
      const nuevaTarea = {
        id: response?.task?.id || Date.now(), // usar el ID real si lo devuelve el backend
        scheduled_date: formData.scheduled_date,
        due_date: formData.due_date,
        status: "pending",
        log: {
          concept: { name: conceptoSeleccionado?.name || "Concepto" },
          note: formData.note,
          cliente: {
            nombre_completo:
              clientes.find(c => c.id == formData.cliente_id)?.nombre_completo || "Cliente"
          }
        }
      };
  
      if (onCreated) onCreated(nuevaTarea);
      onHide();
    } catch (error) {
      alert("❌ Error al guardar la tarea");
    } finally {
      setLoading(false);
    }
  };
  
  const getCategoriaSeleccionada = () => {
    const concepto = conceptos.find(c => c.id === parseInt(formData.concept_id));
    return concepto?.category || null;
  };

  const getCategoriaColor = (categoria) => {
    switch (categoria?.toLowerCase()) {
      case "alta":
        return "danger";
      case "media":
        return "warning";
      case "baja":
        return "success";
      default:
        return "secondary";
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-3">
          📌 Nueva Tarea Operativa
          {getCategoriaSeleccionada() && (
            <span
              className={`badge bg-${getCategoriaColor(getCategoriaSeleccionada())}`}
              style={{ fontSize: "0.85rem" }}
            >
              Prioridad: {getCategoriaSeleccionada()}
            </span>
          )}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label>Concepto Principal</Form.Label>
            <Form.Select value={conceptoPadreId} onChange={handlePadreChange}>
              <option value="">Seleccionar</option>
              {conceptosPadres.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {conceptos.length > 0 && (
            <Form.Group className="mt-3">
              <Form.Label>Subconcepto</Form.Label>
              <Form.Select
                name="concept_id"
                value={formData.concept_id}
                onChange={handleChange}
                isInvalid={!!errors.concept_id}
              >
                <option value="">Seleccionar</option>
                {conceptos.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">{errors.concept_id}</Form.Control.Feedback>
            </Form.Group>
          )}

          <Form.Group className="mt-3">
            <Form.Label>Nota</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="note"
              value={formData.note}
              onChange={handleChange}
              placeholder="Escribe una justificación o detalle de la tarea..."
              isInvalid={!!errors.note}
            />
            <Form.Control.Feedback type="invalid">{errors.note}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mt-3">
            <Form.Label>Cliente</Form.Label>
            <Form.Select
              name="cliente_id"
              value={formData.cliente_id}
              onChange={handleChange}
              isInvalid={!!errors.cliente_id}
            >
              <option value="">Seleccionar cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre_completo}</option>
              ))}
            </Form.Select>
            <Form.Control.Feedback type="invalid">{errors.cliente_id}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mt-3">
            <Form.Label>Asignar a</Form.Label>
            <Form.Select
              name="assign_to_user_id"
              value={formData.assign_to_user_id}
              onChange={handleChange}
              isInvalid={!!errors.assign_to_user_id}
            >
              <option value="">Seleccionar usuario</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Form.Select>
            <Form.Control.Feedback type="invalid">{errors.assign_to_user_id}</Form.Control.Feedback>
          </Form.Group>

          {/* ✅ Fechas si hay usuario asignado */}
          {formData.assign_to_user_id && (
            <>
              <Form.Group className="mt-3">
                <Form.Label>📅 Fecha programada</Form.Label>
                <Form.Control
                  type="date"
                  name="scheduled_date"
                  value={formData.scheduled_date}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mt-3">
                <Form.Label>⏳ Fecha de vencimiento</Form.Label>
                <Form.Control
                  type="date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleChange}
                />
              </Form.Group>
            </>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cancelar</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <Spinner size="sm" animation="border" /> : "Guardar"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default NuevaTareaModal;
