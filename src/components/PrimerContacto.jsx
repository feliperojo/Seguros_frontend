import React, { useEffect, useState } from "react";
import { Row, Col, Form } from "react-bootstrap";

const parsePrimerContactoInfo = (texto) => {
  if (!texto) {
    return {
      referido: "",
      cobertura_prospecto: "",
      taxes: "",
      zipcode: "",
      edad: "",
      ingresos: "",
      telefono: "",
      nota: ""
    };
  }

  return {
    referido: (texto.match(/REF\s+([^|]*)/i)?.[1] || "").trim(),
    cobertura_prospecto: (texto.match(/COB\.?\s+([^|]*)/i)?.[1] || "").trim(),
    taxes: (texto.match(/TAXES\s+([^|]*)/i)?.[1] || "").trim(),
    zipcode: (texto.match(/ZIPCODE\s+([^|]*)/i)?.[1] || "").trim(),
    edad: (texto.match(/EDAD\s+([^|]*)/i)?.[1] || "").replace("AÑOS", "").trim(),
    ingresos: (texto.match(/INGRESOS\s+([^|]*)/i)?.[1] || "").trim(),
    telefono: (texto.match(/TLF\s+([^|]*)/i)?.[1] || "").trim(),
    nota: (texto.match(/NOTA\s+([^|]*)/i)?.[1] || "").trim(),
  };
};



const buildPrimerContactoInfo = (fields) => {
  return `REF ${fields.referido || ""} | COB. ${fields.cobertura_prospecto || ""} | TAXES ${
    fields.taxes || ""
  } | ZIPCODE ${fields.zipcode || ""} | EDAD ${fields.edad ? `${fields.edad} AÑOS` : ""} | INGRESOS ${
    fields.ingresos || ""
  } | TLF ${fields.telefono || ""} | NOTA ${fields.nota || ""}`;
};

const PrimerContacto = ({ value = "", onChange }) => {
  const [fields, setFields] = useState(parsePrimerContactoInfo(value));

  useEffect(() => {
    setFields(parsePrimerContactoInfo(value));
  }, [value]);

  const handleChange = (field, newValue) => {
    const updated = { ...fields, [field]: newValue };
    setFields(updated);
    onChange(buildPrimerContactoInfo(updated));
  };

  // ✅ Permitir números y punto decimal en ingresos
  const handleIngresosChange = (val) => {
    const cleaned = val.replace(/[^0-9.]/g, ""); // Solo números y punto
    // Evitar más de un punto decimal
    const parts = cleaned.split(".");
    const valid = parts.length > 2 ? parts[0] + "." + parts[1] : cleaned;
    handleChange("ingresos", valid);
  };

  // ✅ Formatear ingresos al perder el foco
  const handleIngresosBlur = () => {
    const num = parseFloat(fields.ingresos);
    const formatted = !isNaN(num)
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2
        }).format(num)
      : "";
    handleChange("ingresos", formatted);
  };

  // ✅ Formatear teléfono
  const formatTelefono = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  return (
    <div className="p-3 bg-light rounded border">
      <h6 className="mb-3">Información del Prospecto</h6>
      <Row className="mb-2">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Referido</Form.Label>
            <Form.Control
              type="text"
              value={fields.referido}
              onChange={(e) => setFields({ ...fields, referido: e.target.value })}
              onBlur={() => onChange(buildPrimerContactoInfo(fields))}
            />

          </Form.Group>
        </Col>
        <Col md={2}>
          <Form.Group>
            <Form.Label>Cobertura</Form.Label>
            <Form.Control
              type="text"
              value={fields.cobertura_prospecto}
              onChange={(e) => handleChange("cobertura_prospecto", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={2}>
          <Form.Group>
            <Form.Label>Taxes</Form.Label>
            <Form.Control
              type="text"
              value={fields.taxes}
              onChange={(e) => handleChange("taxes", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={2}>
          <Form.Group>
            <Form.Label>ZIP Code</Form.Label>
            <Form.Control
              type="text"
              value={fields.zipcode}
              onChange={(e) => handleChange("zipcode", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={2}>
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
        <Col md={3}>
          <Form.Group>
            <Form.Label>Ingresos</Form.Label>
            <Form.Control
              type="text"
              value={fields.ingresos}
              onChange={(e) => handleIngresosChange(e.target.value)}
              onBlur={handleIngresosBlur} // Formato final al salir
            />
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group>
            <Form.Label>Teléfono</Form.Label>
            <Form.Control
              type="text"
              value={fields.telefono}
              onChange={(e) => {
                const formatted = formatTelefono(e.target.value);
                handleChange("telefono", formatted);
              }}
            />
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group>
            <Form.Label>Nota</Form.Label>
            <Form.Control
              type="text"
              value={fields.nota}
              onChange={(e) => setFields({ ...fields, nota: e.target.value })}
              onBlur={() => onChange(buildPrimerContactoInfo(fields))}
            />
          </Form.Group>
        </Col>
      </Row>
    </div>
  );
};

export default PrimerContacto;
