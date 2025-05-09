import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";
import apiRequest from "../../services/api";

const BitacoraModal = ({ show, onHide, data, onSuccess }) => {

  const [nota, setNota] = useState("");
  const [concepto, setConcepto] = useState("");
  const [asignadoA, setAsignadoA] = useState("");
  const [conceptos, setConceptos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [success, setSuccess] = useState(false);

  const userIdFromSession = 1; // ⚠️ Ajusta este valor con la lógica de sesión real

  // Cargar conceptos y usuarios al mostrar el modal
  useEffect(() => {
    if (show) {
      fetchConceptos();
      fetchUsuarios();
    }
  }, [show]);

  const fetchConceptos = async () => {
    try {
      const response = await apiRequest("operational_concepts", "GET");
      setConceptos(response || []);
    } catch (err) {
      console.error("Error cargando conceptos:", err);
      setError("Error al cargar conceptos.");
    }
  };

  const fetchUsuarios = async () => {
    try {
      const response = await apiRequest("users", "GET");
      setUsuarios(response || []);
    } catch (err) {
      console.error("Error cargando usuarios:", err);
      setError("Error al cargar usuarios.");
    }
  };

  const handleGuardar = async () => {
    if (!nota.trim() || !concepto.trim()) {
      setError("Por favor completa todos los campos.");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      const payload = {
        ...data,
        note: nota,
        concept_id: concepto,
        assign_to_user_id: asignadoA,
        action_type: data?.accion || null,
        entity_type: data?.entity_type || null,
        creado_por: userIdFromSession,
      };

      await apiRequest("bitacora_operativa/create", "POST", payload);
      setSuccess(true);
      
      setTimeout(() => {
        setNota("");
        setConcepto("");
        setAsignadoA("");
        setSuccess(false);
        setGuardando(false);
      
        if (onSuccess) onSuccess(); // ⬅️ Aquí llamamos a actualizar el cliente
      }, 1000);
      
    } catch (err) {
      console.error("Error al guardar en bitácora:", err);
      setError("Ocurrió un error al guardar en la bitácora.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Registro en Bitácora</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">Registro exitoso</Alert>}

        <Form.Group className="mb-3">
          <Form.Label>Concepto</Form.Label>
          <Form.Select
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
          >
            <option value="">Seleccione un concepto</option>
            {conceptos.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Nota</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Describe el motivo del cambio"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Asignar a</Form.Label>
          <Form.Select
            value={asignadoA}
            onChange={(e) => setAsignadoA(e.target.value)}
          >
            <option value="">Seleccione un usuario</option>
            {usuarios.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.name}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleGuardar} disabled={guardando}>
          {guardando ? (
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
  );
};

export default BitacoraModal;
