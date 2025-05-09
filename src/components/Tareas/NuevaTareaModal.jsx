import React, { useEffect, useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import apiRequest from "../../services/api"; // Tu helper para llamadas API

const NuevaTareaModal = ({ show, onHide, categoria = "tarea_manual" }) => {

  const [formData, setFormData] = useState({
    concept_id: "",
    note: "",
    cliente_id: "",
    grupo_familiar_id: "",
    assign_to_user_id: "",
  });

  const [conceptos, setConceptos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    if (show) {
      Promise.all([
        apiRequest(`operational_concepts`, "GET"),
        apiRequest("cliente", "GET"),
        apiRequest("grupo_familiar", "GET"),
        apiRequest("users", "GET"),
      ]).then(([conceptos, clientes, grupos, usuarios]) => {
        setConceptos(conceptos);
        setClientes(clientes);
        setGrupos(grupos);
        setUsuarios(usuarios);
      });
    }
  }, [show, categoria]);
  

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await apiRequest("bitacora_operativa/create", "POST", {
        ...formData,
        action_type: "manual",
      });
      onHide(); // cerrar modal
    } catch (error) {
      alert("❌ Error al guardar la tarea");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>📌 Nueva Tarea Operativa</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label>Concepto</Form.Label>
            <Form.Select name="concept_id" value={formData.concept_id} onChange={handleChange}>
              <option value="">-- Seleccionar --</option>
              {conceptos.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mt-3">
            <Form.Label>Nota</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="note"
              value={formData.note}
              onChange={handleChange}
              placeholder="Escribe una justificación o detalle de la tarea..."
            />
          </Form.Group>

          <Form.Group className="mt-3">
            <Form.Label>Cliente (opcional)</Form.Label>
            <Form.Select name="cliente_id" value={formData.cliente_id} onChange={handleChange}>
              <option value="">-- Seleccionar cliente --</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre_completo}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mt-3">
            <Form.Label>Grupo Familiar (opcional)</Form.Label>
            <Form.Select name="grupo_familiar_id" value={formData.grupo_familiar_id} onChange={handleChange}>
              <option value="">-- Seleccionar grupo --</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>Grupo #{g.id} - {g.descripcion || "Sin descripción"}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mt-3">
            <Form.Label>Asignar a</Form.Label>
            <Form.Select name="assign_to_user_id" value={formData.assign_to_user_id} onChange={handleChange}>
              <option value="">-- Seleccionar usuario --</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Form.Select>
          </Form.Group>
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
