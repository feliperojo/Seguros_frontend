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
const [defaultSet, setDefaultSet] = useState(false);
const [fechaProgramacion, setFechaProgramacion] = useState(() => {
  const hoy = new Date().toISOString().split("T")[0];
  return hoy;
});
const [fechaVencimiento, setFechaVencimiento] = useState(() => {
  const hoy = new Date().toISOString().split("T")[0];
  return hoy;
});


  const userIdFromSession = 1; 
console.log("data",data);
  useEffect(() => {
    if (show) {
      fetchConceptos();
      fetchUsuarios();
    }
  }, [show]);

  useEffect(() => {
    if (
      show &&
      data?.entity_type === "cliente" && 
      data?.accion === "create" && 
      conceptosPadres.length > 0 && 
      !defaultSet
    ) {
      const conceptoPadre = conceptosPadres.find(item => item.name === "Clientes Nuevos");
      
      if (conceptoPadre) {
        setConceptoPadreId(conceptoPadre.id);
        
        apiRequest(`operational_concepts/${conceptoPadre.id}/subconcepts`, "GET")
          .then((hijos) => {
            setSubconceptos(hijos || []);
            setConceptos(hijos || []);
            const subconcepto = hijos.find(item => item.name === "Creación Nuevo Cliente");
            if (subconcepto) {
              setConcepto(subconcepto.id);
            }
          });
      }
      
      setNota("Nuevo cliente");
      setDefaultSet(true); // Evita reejecución
    }
  }, [show, data, conceptosPadres, defaultSet]);
  
  const fetchConceptos = async () => {
    try {
      const response = await apiRequest("operational_concepts?only_parents=true", "GET");
      setConceptosPadres(response || []);
  
      // ✅ Si viene de Clientes y es create, asignamos valores por defecto
      if (
        data?.entity_type === "cliente" &&
        data?.accion === "create" &&
        response?.length > 0
      ) {
        const conceptoPadre = response.find(item => item.name === "Clientes Nuevos");
        if (conceptoPadre) {
          setConceptoPadreId(conceptoPadre.id);
  
          // Cargar subconceptos
          const hijos = await apiRequest(`operational_concepts/${conceptoPadre.id}/subconcepts`, "GET");
          setSubconceptos(hijos || []);
          setConceptos(hijos || []);
  
          const subconcepto = hijos.find(item => item.name === "Creación Nuevo Cliente");
          if (subconcepto) {
            setConcepto(subconcepto.id);
          }
  
          setNota("Nuevo cliente");
        }
      } else {
        // ✅ Reset para otros flujos
        setConceptos([]);
        setConcepto("");
        setConceptoPadreId("");
      }
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
    if (!nota.trim() || !String(concepto).trim()) {
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
        ...(asignadoA ? {
          assign_to_user_id: asignadoA,
          scheduled_date: fechaProgramacion,
          due_date: fechaVencimiento
        } : {}),
        ...(data?.historial_id ? { historial_id: data.historial_id } : {})

      };
  
      const method = logId ? "PUT" : "POST";
      const endpoint = logId
        ? `bitacora_operativa/${logId}/update`
        : `bitacora_operativa/create`;
  
      await apiRequest(endpoint, method, payload);
      setBitacoraGuardada(true);
  
      if (typeof onSaved === "function") {
        onSaved();
      }
  
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
    setAsignadoA("");
    const hoy = new Date().toISOString().split("T")[0];
    setFechaProgramacion(hoy);
    setFechaVencimiento(hoy);
    
    // ✅ Reset interno primero
    setDefaultSet(false);
    setNota("");
    setConcepto("");
    setConceptoPadreId("");
  
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
        {asignadoA && (
  <>
    <Form.Group className="mb-3">
      <Form.Label>Fecha de Programación</Form.Label>
      <Form.Control
        type="date"
        value={fechaProgramacion}
        onChange={(e) => setFechaProgramacion(e.target.value)}
      />
    </Form.Group>

    <Form.Group className="mb-3">
      <Form.Label>Fecha de Vencimiento</Form.Label>
      <Form.Control
        type="date"
        value={fechaVencimiento}
        min={fechaProgramacion} // Evita que sea antes de la programación
        onChange={(e) => setFechaVencimiento(e.target.value)}
      />
    </Form.Group>
  </>
)}

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
