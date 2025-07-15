import React, { useEffect, useState } from "react";
import { Row, Col, Form } from "react-bootstrap";

const PrimerContacto = ({ initialValue, initialData = {}, onChange }) => {
  const [fields, setFields] = useState({
    referido: "",
    cobertura_prospecto: "",
    taxes: "",
    zipcode: "",
    edad: "",
    ingresos: "",
    telefono: ""
  });

  useEffect(() => {
    setFields(initialData);
  }, [initialData]);

  const handleChange = (field, value) => {
    const updated = { ...fields, [field]: value };
    setFields(updated);
    onChange(updated); // 🔥 enviamos el objeto al padre para reconstruir el texto
  };

  return (
    <div className="p-3 bg-light rounded border">
      <h6 className="mb-3">Información del Prospecto</h6>
      <Row className="mb-2">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Referido</Form.Label>
            <Form.Control
              type="text"
              value={fields.referido}
              onChange={(e) => handleChange("referido", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>cobertura</Form.Label>
            <Form.Control
              type="text"
              value={fields.cobertura_prospecto}
              onChange={(e) => handleChange("cobertura_prospecto", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>

      <Row className="mb-2">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Taxes</Form.Label>
            <Form.Control
              type="text"
              value={fields.taxes}
              onChange={(e) => handleChange("taxes", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>ZIP Code</Form.Label>
            <Form.Control
              type="text"
              value={fields.zipcode}
              onChange={(e) => handleChange("zipcode", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Edad</Form.Label>
            <Form.Control
              type="number"
              value={fields.edad}
              onChange={(e) => handleChange("edad", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>

      <Row>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Ingresos</Form.Label>
            <Form.Control
              type="text"
              value={fields.ingresos}
              onChange={(e) => handleChange("ingresos", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Teléfono</Form.Label>
            <Form.Control
              type="text"
              value={fields.telefono}
              onChange={(e) => handleChange("telefono", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>
    </div>
  );
};

export default PrimerContacto;
