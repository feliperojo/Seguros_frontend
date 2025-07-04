import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";
import apiRequest from "../../services/api";

const BitacoraModal = ({ show, onHide, onSaved, onSuccess, data, logId }) => {
  const [nota, setNota] = useState("");
  const [concepto, setConcepto] = useState("");
  const [asignadoA, setAsignadoA] = useState("");
  const [conceptos, setConceptos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [bitacoraGuardada, setBitacoraGuardada] = useState(false);
  const [conceptosPadres, setConceptosPadres] = useState([]);
const [subconceptos, setSubconceptos] = useState([]);
const [conceptoPadreId, setConceptoPadreId] = useState("");


  const userIdFromSession = 1; // ⚠️ Reemplaza esto con ID real del usuario
console.log("data",data);
  useEffect(() => {
    if (show) {
      fetchConceptos();
      fetchUsuarios();
    }
  }, [show]);

  const fetchConceptos = async () => {
    try {
      const response = await apiRequest("operational_concepts?only_parents=true", "GET");
      setConceptosPadres(response || []);
      setConceptos([]); // limpia subconceptos al abrir
      setConcepto("");  // limpia concepto seleccionado
      setConceptoPadreId(""); // limpia padre seleccionado
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

  const handlePadreChange = async (e) => {
    const selectedId = e.target.value;
    setConceptoPadreId(selectedId);
    setConcepto(""); // limpia subconcepto seleccionado
  
    if (selectedId) {
      const hijos = await apiRequest(`operational_concepts/${selectedId}/subconcepts`, "GET");
      setSubconceptos(hijos || []);
      setConceptos(hijos || []);
    } else {
      setSubconceptos([]);
      setConceptos([]);
    }
  };
  

  const handleGuardar = async () => {
    if (!nota.trim() || !concepto.trim()) {
      setError("Por favor completa todos los campos obligatorios.");
      return;
    }
  
    setGuardando(true);
    setError(null);
    

    try {
      const payload = {
        note: nota,
        concept_id: concepto,
        action_type: data?.accion || "create",
        entity_type: data?.entity_type || "cliente",
        ...(data?.cliente_id ? { cliente_id: data.cliente_id } : {}),
        ...(data?.grupo_familiar_id ? { grupo_familiar_id: data.grupo_familiar_id } : {}),
        ...(asignadoA ? { assign_to_user_id: asignadoA } : {}),
        ...(data?.historial_id ? { historial_id: data.historial_id } : {})

        
      };
      
     

      const method = logId ? "PUT" : "POST";
      const endpoint = logId
        ? `bitacora_operativa/${logId}/update`
        : `bitacora_operativa/create`;
      
      await apiRequest(endpoint, method, payload);
      setBitacoraGuardada(true);
  
      // Llama a onSaved si está definido, para que el padre pueda reaccionar al guardado
      if (typeof onSaved === "function") {
        onSaved();
      }
  
      // Luego cerrar el modal
      if (typeof onHide === "function") {
        onHide(true);
      }
    } catch (err) {
      console.error("Error al guardar en bitácora:", err);
      setError("Ocurrió un error al guardar en la bitácora.");
    } finally {
      setGuardando(false);
    }
  };
  
  

  const handleClose = async () => {
    if (!bitacoraGuardada && logId) {
      try {
        await apiRequest("bitacora_operativa/delete-ultima", "DELETE");

        console.log("Bitácora eliminada correctamente al cancelar.");
      } catch (err) {
        console.warn("No se pudo eliminar la bitácora temporal:", err);
      }
    }
    if (typeof onHide === "function") {
      onHide(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Registro en Bitácora</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form.Group className="mb-3">
  <Form.Label>Concepto Principal</Form.Label>
  <Form.Select value={conceptoPadreId} onChange={handlePadreChange}>
    <option value="">Seleccione un concepto principal</option>
    {conceptosPadres.map((item) => (
      <option key={item.id} value={item.id}>{item.name}</option>
    ))}
  </Form.Select>
</Form.Group>

{conceptos.length > 0 && (
  <Form.Group className="mb-3">
    <Form.Label>Subconcepto</Form.Label>
    <Form.Select
      value={concepto}
      onChange={(e) => setConcepto(e.target.value)}
    >
      <option value="">Seleccione un subconcepto</option>
      {conceptos.map((item) => (
        <option key={item.id} value={item.id}>{item.name}</option>
      ))}
    </Form.Select>
  </Form.Group>
)}


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
        <Button variant="secondary" onClick={handleClose} disabled={guardando}>
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
