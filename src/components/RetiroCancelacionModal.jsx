import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Row, Col, Badge } from "react-bootstrap";
import { FaCog } from "react-icons/fa";
import apiRequest from "../services/api";
import BitacoraModal from "../components/Tareas/BitacoraModal";

// Función helper para normalizar fechas a formato YYYY-MM-DD sin alterar la fecha
const normalizeDate = (dateString) => {
  if (!dateString) return "";
  // Si ya está en formato YYYY-MM-DD, retornarlo tal cual
  if (typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }
  // Si viene como ISO string o Date, extraer solo la parte de fecha
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  // Usar getFullYear, getMonth, getDate para evitar problemas de zona horaria
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const RetiroCancelacionModal = ({ show, onHide, grupoFamiliar, onSave }) => {
  const [coberturas, setCoberturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [personasTaxes, setPersonasTaxes] = useState(grupoFamiliar?.personas_taxes || 0);
  const [personasCobertura, setPersonasCobertura] = useState(grupoFamiliar?.personas_cobertura || 0);
  const [fechasOriginales, setFechasOriginales] = useState([]);
  const [cambiosDetectados, setCambiosDetectados] = useState(false);
  const [showBitacora, setShowBitacora] = useState(false);
  const [bitacoraPayload, setBitacoraPayload] = useState(null);


  useEffect(() => {
    if (grupoFamiliar?.coberturas) {
      const coberturasActivas = grupoFamiliar.coberturas.filter(
        c => c.estado_cobertura === "Activa" || c.activo === true
      );

      const coberturasIniciales = coberturasActivas.map(c => ({
        ...c,
        fecha_cancelacion: normalizeDate(c.fecha_cancelacion),
        fecha_retiro: normalizeDate(c.fecha_retiro),
        nota_cancel: c.nota_cancel || "",
      }));

      setCoberturas(coberturasIniciales);
      setFechasOriginales(
        coberturasIniciales.map(c => ({
          id: c.id,
          fecha_cancelacion: normalizeDate(c.fecha_cancelacion),
          fecha_retiro: normalizeDate(c.fecha_retiro)
        }))
      );

      setPersonasTaxes(grupoFamiliar.personas_taxes || 0);
      setPersonasCobertura(grupoFamiliar.personas_cobertura || 0);
    }
  }, [grupoFamiliar]);


  useEffect(() => {
    if (fechasOriginales.length === 0 || coberturas.length === 0) return;

    let cambiosEnCancelaciones = 0;
    let cambiosEnRetiros = 0;
    let hayCambios = false;

    coberturas.forEach((actual) => {
      const original = fechasOriginales.find(f => f.id === actual.id);

      if (original) {
        const nuevaCancelacion = !original.fecha_cancelacion && actual.fecha_cancelacion;
        const nuevaRetiro = !original.fecha_retiro && actual.fecha_retiro;

        if (nuevaCancelacion) cambiosEnCancelaciones++;
        if (nuevaRetiro) cambiosEnRetiros++;

        
        if (
          original.fecha_cancelacion !== actual.fecha_cancelacion ||
          original.fecha_retiro !== actual.fecha_retiro ||
          actual.nota_cancel?.trim()
        ) {
          hayCambios = true;
        }
      }
    });

    const totalOriginalTaxes = grupoFamiliar?.personas_taxes || 0;
    const totalOriginalCobertura = grupoFamiliar?.personas_cobertura || 0;

    setPersonasTaxes(totalOriginalTaxes - cambiosEnRetiros);
    setPersonasCobertura(totalOriginalCobertura - cambiosEnCancelaciones);
    setCambiosDetectados(hayCambios); // ← ACTUALIZA BOTÓN
  }, [coberturas, fechasOriginales]);



  const handleChange = (index, field, value) => {
    const nuevasCoberturas = [...coberturas];

    nuevasCoberturas[index][field] = value;

    // Regla automática: si se establece fecha_cancelacion, estado_cobertura debe ser "No"
    if (field === "fecha_cancelacion") {
      nuevasCoberturas[index]["vigente"] = value ? false : true;
      // Si hay fecha de cancelación, estado_cobertura debe ser "No" (sin importar el valor anterior)
      if (value) {
        nuevasCoberturas[index]["estado_cobertura"] = "No";
      }
      // Si se limpia la fecha, no forzamos el estado (se mantiene el valor actual)
    }

    // Regla automática: si se establece fecha_retiro, estado_cobertura debe ser "No"
    if (field === "fecha_retiro") {
      // Si hay fecha de retiro, estado_cobertura debe ser "No" (sin importar el valor anterior)
      if (value) {
        nuevasCoberturas[index]["estado_cobertura"] = "No";
      }
      // Si se limpia la fecha, no forzamos el estado (se mantiene el valor actual)
    }

    if (field === "activo" && value === true) {
      nuevasCoberturas[index]["fecha_retiro"] = "";
    }

    setCoberturas(nuevasCoberturas);
  };





  const handleSave = async () => {
    setLoading(true);
    try {
      for (const cobertura of coberturas) {
        const payload = {
          fecha_cancelacion: cobertura.fecha_cancelacion ? normalizeDate(cobertura.fecha_cancelacion) : null,
          fecha_retiro: cobertura.fecha_retiro ? normalizeDate(cobertura.fecha_retiro) : null,
          nota_cancel: cobertura.nota_cancel?.trim() || null,
          activo: cobertura.activo ?? false,
          vigente: cobertura.vigente ?? true,
          estado_cobertura: cobertura.estado_cobertura
        };

        await apiRequest(`cobertura/${cobertura.id}`, "PUT", payload);
      }

      // Actualizar grupo familiar
      const grupoPayload = {
        personas_taxes: personasTaxes,
        personas_cobertura: personasCobertura,
      };
      await apiRequest(`grupo_familiar/${grupoFamiliar.id}`, "PUT", grupoPayload);

      const tomador = coberturas.find(c => c.parentesco === "TOMADOR");
      const clienteIdTomador = tomador?.cliente?.id || null;
      
      setBitacoraPayload({
        accion: "retiro_o_cancelacion",
        entity_type: "grupo_familiar",
        grupo_familiar_id: grupoFamiliar.id,
        cliente_id: clienteIdTomador
      });
      

      setShowBitacora(true); // 👈 Mostrar modal
    } catch (error) {
      console.error("❌ Error al guardar:", error);
      alert("Error al guardar los retiros");
    } finally {
      setLoading(false);
    }
  };





  return (
    <>
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
                    value={personasTaxes}
                    disabled
                    readOnly
                  />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold">Personas en Cobertura</Form.Label>
                  <Form.Control
                    type="number"
                    value={personasCobertura}
                    disabled
                    readOnly
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
                    <Form.Label className="fw-semibold">Fecha de Cancelación</Form.Label>
                    <Form.Control
                      type="date"
                      value={cobertura.fecha_cancelacion}
                      onChange={(e) => handleChange(index, "fecha_cancelacion", e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Fecha de Retiro</Form.Label>
                    <Form.Control
                      type="date"
                      value={cobertura.fecha_retiro}
                      disabled={cobertura.activo === true} // ← aquí se desactiva
                      onChange={(e) => handleChange(index, "fecha_retiro", e.target.value)}
                    />



                  </Form.Group>
                </Col>
                <Col md={12} className="mt-3">
                  <Form.Group>
                    <Form.Check
                      type="checkbox"
                      label="Póliza activa para Taxes"
                      checked={cobertura.activo || false}
                      onChange={(e) =>
                        handleChange(index, "activo", e.target.checked)
                      }
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
          <Button variant="primary" onClick={handleSave} disabled={loading || !cambiosDetectados}>
            {loading ? "Guardando..." : "Guardar Cambios"}
          </Button>

        </Modal.Footer>

      </Modal>

      {showBitacora && (
        <BitacoraModal
          show={showBitacora}
          onHide={() => setShowBitacora(false)}
          data={bitacoraPayload}
          onSaved={() => {
            setShowBitacora(false);
            onSave(grupoFamiliar);
            onHide();
          }}
        />
      )}
    </>
  );

};

export default RetiroCancelacionModal;
