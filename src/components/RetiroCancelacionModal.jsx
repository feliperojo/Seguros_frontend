import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Row, Col, Badge } from "react-bootstrap";
import { FaCog } from "react-icons/fa";
import apiRequest from "../services/api";

const RetiroCancelacionModal = ({ show, onHide, grupoFamiliar, onSave }) => {
  const [coberturas, setCoberturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [personasTaxes, setPersonasTaxes] = useState(grupoFamiliar?.personas_taxes || 0);
  const [personasCobertura, setPersonasCobertura] = useState(grupoFamiliar?.personas_cobertura || 0);
  
  useEffect(() => {
    if (grupoFamiliar?.coberturas) {
      const coberturasIniciales = grupoFamiliar.coberturas.map(c => ({
        ...c,
        fecha_cancelacion: c.fecha_cancelacion || "",
        fecha_retiro: c.fecha_retiro || "",
        nota_cancel: c.nota_cancel || "",
      }));
      setCoberturas(coberturasIniciales);
      setPersonasTaxes(grupoFamiliar.personas_taxes || 0);
      setPersonasCobertura(grupoFamiliar.personas_cobertura || 0);
    }
  }, [grupoFamiliar]);
  

  const handleChange = (index, field, value) => {
    const nuevasCoberturas = [...coberturas];
    nuevasCoberturas[index][field] = value;
    setCoberturas(nuevasCoberturas);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Actualizar coberturas
      for (const cobertura of coberturas) {
        const response = await apiRequest(`cobertura/${cobertura.id}`, "PUT", {
            fecha_cancelacion: cobertura.fecha_cancelacion || null,
            fecha_retiro: cobertura.fecha_retiro || null,
            nota_cancel: cobertura.nota_cancel || null, // usa el nombre correcto del campo aquí
          });
        console.log(`✅ Cobertura actualizada (ID ${cobertura.id}):`, response);
      }
  
      // Actualizar grupo (solo una vez)

  
      onSave(grupoFamiliar);
      setLoading(false);
      onHide();
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar los retiros");
      setLoading(false);
    }
  };
  

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <FaCog className="me-2" />
          Retiros y Cancelaciones de Coberturas
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div className="mb-3">
          <Row>
            <Col md={4}><strong>ID Grupo Familiar:</strong> #{grupoFamiliar?.id}</Col>
            <Col md={4}>
                <Form.Group>
                    <Form.Label className="fw-semibold">Personas en Taxes</Form.Label>
                    <Form.Control
                    type="number"
                    min={0}
                    value={personasTaxes}
                    onChange={(e) => setPersonasTaxes(parseInt(e.target.value) || 0)}
                    />
                </Form.Group>
                </Col>
                <Col md={4}>
                <Form.Group>
                    <Form.Label className="fw-semibold">Personas en Cobertura</Form.Label>
                    <Form.Control
                    type="number"
                    min={0}
                    value={personasCobertura}
                    onChange={(e) => setPersonasCobertura(parseInt(e.target.value) || 0)}
                    />
                </Form.Group>
                </Col>


          </Row>
        </div>

        <hr />

        {coberturas.map((cobertura, index) => (
  <div key={index} className="p-3 mb-4 border rounded bg-white shadow-sm">
    <div className="d-flex justify-content-between align-items-center mb-2">
      <h6 className="mb-0">
        <Badge bg="primary" className="me-2">#{index + 1}</Badge>
        {cobertura.cliente?.nombre_completo || "Cliente sin nombre"} <small className="text-muted">({cobertura.parentesco || "-"})</small>
      </h6>
    </div>

    <Row className="mb-3">
      <Col md={4}>
        <div className="text-muted small">ID Póliza</div>
        <div className="fw-semibold">{cobertura.codigo_poliza || "-"}</div>
      </Col>
      <Col md={4}>
        <div className="text-muted small">Compañía</div>
        <div className="fw-semibold">{cobertura.compania?.nombre || "-"}</div>
      </Col>
      <Col md={4}>
        <div className="text-muted small">Año de Cobertura</div>
        <div className="fw-semibold">{cobertura.ano_cobertura || "-"}</div>
      </Col>
    </Row>

    <Row>
      <Col md={6}>
        <Form.Group>
          <Form.Label className="fw-semibold">Fecha de Retiro</Form.Label>
          <Form.Control
            type="date"
            value={cobertura.fecha_retiro}
            onChange={(e) => handleChange(index, "fecha_retiro", e.target.value)}
          />
        </Form.Group>
      </Col>

      <Col md={6}>
        <Form.Group>
          <Form.Label className="fw-semibold">Fecha de Cancelación</Form.Label>
          <Form.Control
            type="date"
            value={cobertura.fecha_cancelacion}
            onChange={(e) => handleChange(index, "fecha_cancelacion", e.target.value)}
          />
        </Form.Group>
      </Col>

      <Col md={12} className="mt-3">
        <Form.Group>
          <Form.Label className="fw-semibold">Nota del Retiro</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={cobertura.nota_cancel}
            onChange={(e) => handleChange(index, "nota_cancel", e.target.value)}
            placeholder="Motivo o contexto del retiro..."
          />
        </Form.Group>
      </Col>
    </Row>
  </div>
))}

      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cerrar</Button>
        <Button variant="primary" onClick={handleSave} disabled={loading}>
          {loading ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RetiroCancelacionModal;
