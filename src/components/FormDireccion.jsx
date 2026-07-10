import React from "react";
import { Form, Row, Col, InputGroup } from "react-bootstrap";
import { FaMapMarkerAlt } from "react-icons/fa";

const FormDireccion = ({ formData, onChange, editable = true, hideCorrespondencia = false }) => {
  // Función para manejar cambios en los campos
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    
    // Campos que afectan la dirección completa
    const addressFields = ["calle", "apto", "ciudad", "estado", "codigo_postal"];
    const isAddressField = addressFields.includes(name);
    
    // Construir dirección completa para visualización
    let direccionCompleta = "";
    
    if (isAddressField) {
      direccionCompleta = [
        name === "calle" ? value : formData.calle,
        name === "apto" ? value : formData.apto,
        name === "ciudad" ? value : formData.ciudad,
        name === "estado" ? value : formData.estado,
        name === "codigo_postal" ? value : formData.codigo_postal,
      ].filter(Boolean).join(" ").trim();
    }
    
    // Notificar el cambio del campo individual
    onChange(name, newValue, direccionCompleta);
    
    // Si es un campo que afecta la dirección completa, también actualizar el campo "direccion"
    if (isAddressField) {
      onChange("direccion", direccionCompleta, "");
    }
    
    // Si el checkbox de copiar está marcado, actualizar dirección de correspondencia
    if (name === "copi_dir" && checked) {
      // Crear la dirección concatenada actual
      const currentDireccionCompleta = [
        formData.calle,
        formData.apto,
        formData.ciudad,
        formData.estado,
        formData.codigo_postal,
      ].filter(Boolean).join(" ").trim();
      
      // Notificar el cambio de dirección de correspondencia
      onChange("dir_correspondencia", currentDireccionCompleta, "");
    }
  };

  const openMap = () => {
    window.open("https://www.unitedstateszipcodes.org/", "_blank");
  };

  // Construir la representación visual de la dirección completa
  const direccionVisual = [
    formData.calle,
    formData.apto,
    formData.ciudad,
    formData.estado,
    formData.codigo_postal,
  ].filter(Boolean).join(" ");

  return (
    <>
      <Row className="mb-3">
        <Col md={10}>
          <Form.Label>Dirección de Residencia</Form.Label>
          <InputGroup>
            <Form.Control
              type="text"
              value={direccionVisual}
              readOnly
              disabled={!editable}
            />
            <InputGroup.Text className="bg-white">
              <FaMapMarkerAlt
                className="text-primary fs-5 cursor-pointer"
                style={{ cursor: "pointer" }}
                onClick={openMap}
              />
            </InputGroup.Text>
          </InputGroup>
        </Col>
      </Row>

      <Row className="mb-3">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Calle</Form.Label>
            <Form.Control
              type="text"
              name="calle"
              value={formData.calle || ""}
              onChange={handleChange}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              disabled={!editable}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>APT</Form.Label>
            <Form.Control
              type="text"
              name="apto"
              value={formData.apto || ""}
              onChange={handleChange}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              disabled={!editable}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Ciudad</Form.Label>
            <Form.Control
              type="text"
              name="ciudad"
              value={formData.ciudad || ""}
              onChange={handleChange}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              disabled={!editable}
            />
          </Form.Group>
        </Col>
      </Row>

      <Row className="mb-3">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Estado</Form.Label>
            <Form.Control
              type="text"
              name="estado"
              value={formData.estado || ""}
              onChange={handleChange}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              disabled={!editable}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Código Postal</Form.Label>
            <Form.Control
              type="text"
              name="codigo_postal"
              value={formData.codigo_postal || ""}
              onChange={handleChange}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              disabled={!editable}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Condado</Form.Label>
            <Form.Control
              type="text"
              name="condado"
              value={formData.condado || ""}
              onChange={handleChange}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              disabled={!editable}
            />
          </Form.Group>
        </Col>
      </Row>

      {/* Ocultar dirección de correspondencia si hideCorrespondencia es true */}
      {!hideCorrespondencia && (
        <Row className="mb-3">
          <Col md={10}>
            <Form.Group>
              <Form.Label>Dirección de Correspondencia</Form.Label>
              <Form.Control
                type="text"
                name="dir_correspondencia"
                value={formData.dir_correspondencia || ""}
                onChange={handleChange}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                disabled={!editable}
              />
            </Form.Group>
          </Col>
          <Col md={2} className="d-flex align-items-end">
            <Form.Check
              type="checkbox"
              label="Copiar Dirección"
              name="copi_dir"
              checked={formData.copi_dir || false}
              onChange={handleChange}
              disabled={!editable}
            />
          </Col>
        </Row>
      )}
    </>
  );
};

export default FormDireccion;