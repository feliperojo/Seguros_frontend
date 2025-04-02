// EditarCliente.js
import React, { useState, useEffect } from "react";
import { 
  Card, Form, Button, Row, Col, Alert, Tabs, Tab, 
  Badge, Spinner, InputGroup, Modal
} from "react-bootstrap";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FaSave, FaTimes, FaHistory, FaUndo, FaExclamationTriangle,
  FaUserEdit, FaMapMarkerAlt, FaIdCard, FaMobileAlt, FaEnvelope
} from "react-icons/fa";

import axios from "axios";

const EditarCliente = () => {
  // Tu código aquí...
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Estados para el manejo de datos
  const [cliente, setCliente] = useState(null);
  const [datosOriginales, setDatosOriginales] = useState(null);
  const [formData, setFormData] = useState({});
  const [cambios, setCambios] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("datos-personales");
  const [showModal, setShowModal] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    const fetchCliente = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`/api/clientes/${id}`);
        setCliente(response.data);
        // Guardamos los datos originales para compararlos después
        setDatosOriginales(JSON.parse(JSON.stringify(response.data)));
        setFormData(JSON.parse(JSON.stringify(response.data)));
        setLoading(false);
      } catch (err) {
        console.error("Error al cargar cliente:", err);
        setError("No se pudo cargar la información del cliente. Intente nuevamente.");
        setLoading(false);
      }
    };
    
    if (id) {
      fetchCliente();
    }
  }, [id]);
  
  // Manejar cambios en los campos
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Actualizar el estado del formulario
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
    
    // Verificar si es diferente al valor original
    if (datosOriginales[name] !== value) {
      setCambios(prevState => ({
        ...prevState,
        [name]: {
          valor_anterior: datosOriginales[name],
          valor_nuevo: value
        }
      }));
    } else {
      // Si volvió al valor original, eliminar del objeto de cambios
      setCambios(prevState => {
        const newState = { ...prevState };
        delete newState[name];
        return newState;
      });
    }
  };
  
  // Manejar cambios en checkboxes
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    
    // Actualizar el estado del formulario
    setFormData(prevState => ({
      ...prevState,
      [name]: checked
    }));
    
    // Verificar si es diferente al valor original
    if (datosOriginales[name] !== checked) {
      setCambios(prevState => ({
        ...prevState,
        [name]: {
          valor_anterior: datosOriginales[name],
          valor_nuevo: checked
        }
      }));
    } else {
      // Si volvió al valor original, eliminar del objeto de cambios
      setCambios(prevState => {
        const newState = { ...prevState };
        delete newState[name];
        return newState;
      });
    }
  };

  // Descartar todos los cambios
  const handleDescartar = () => {
    setFormData(JSON.parse(JSON.stringify(datosOriginales)));
    setCambios({});
  };
  
  // Guardar cambios
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Verificar si hay cambios
    if (Object.keys(cambios).length === 0) {
      setShowModal(true);
      return;
    }
    
    setSaving(true);
    
    try {
      // Preparar datos para enviar (solo los campos modificados)
      const datosModificados = {};
      Object.keys(cambios).forEach(key => {
        datosModificados[key] = formData[key];
      });
      
      // Enviar la solicitud al servidor
      const response = await axios.put(`/api/clientes/${id}`, datosModificados);
      
      // Si la actualización fue exitosa
      if (response.status === 200) {
        // Actualizar los estados
        setCliente({ ...cliente, ...datosModificados });
        setDatosOriginales({ ...datosOriginales, ...datosModificados });
        setCambios({});
        
        // Mostrar mensaje de éxito
        alert("Cliente actualizado correctamente");
      }
    } catch (err) {
      console.error("Error al actualizar cliente:", err);
      setError("Ocurrió un error al actualizar el cliente. Intente nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  // Renderizar indicadores de carga
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <Spinner animation="border" variant="primary" />
        <span className="ms-3">Cargando información del cliente...</span>
      </div>
    );
  }
  
  // Renderizar mensaje de error
  if (error) {
    return (
      <Alert variant="danger" className="m-4">
        <FaExclamationTriangle className="me-2" />
        {error}
        <div className="mt-3">
          <Button variant="outline-primary" onClick={() => navigate("/cliente/lista")}>
            Volver a la lista
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="editar-cliente-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title">
            <FaUserEdit className="me-2" />
            Editar Cliente
          </h1>
          <p className="text-muted">
            ID: {id} | Registrado: {new Date(cliente?.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button 
            variant="outline-secondary"
            onClick={() => navigate(`/cliente/ver/${id}`)}
          >
            Ver Detalles
          </Button>
          <Button 
            variant="primary"
            onClick={handleSubmit}
            disabled={Object.keys(cambios).length === 0 || saving}
            className="d-flex align-items-center"
          >
            {saving ? (
              <>
                <Spinner size="sm" className="me-2" />
                Guardando...
              </>
            ) : (
              <>
                <FaSave className="me-2" />
                Guardar Cambios
                {Object.keys(cambios).length > 0 && (
                  <Badge bg="light" text="dark" pill className="ms-2">
                    {Object.keys(cambios).length}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </div>
      </div>
      
      {Object.keys(cambios).length > 0 && (
        <Alert variant="info" className="mb-4 d-flex justify-content-between align-items-center">
          <div>
            <strong>Has realizado {Object.keys(cambios).length} cambios</strong> que aún no se han guardado.
          </div>
          <Button 
            variant="outline-secondary" 
            size="sm" 
            onClick={handleDescartar}
            className="d-flex align-items-center"
          >
            <FaUndo className="me-1" /> Descartar Cambios
          </Button>
        </Alert>
      )}

<Card className="edit-card">
        <Card.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-4 nav-tabs-custom"
            id="cliente-tabs"
          >
            <Tab eventKey="datos-personales" title="Datos Personales">
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col lg={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Nombre Completo</Form.Label>
                      <Form.Control
                        type="text"
                        name="nombre_completo"
                        value={formData.nombre_completo || ""}
                        onChange={handleChange}
                        className={cambios.nombre_completo ? "campo-modificado" : ""}
                      />
                      {cambios.nombre_completo && (
                        <small className="text-info">
                          Valor original: {cambios.nombre_completo.valor_anterior || "No definido"}
                        </small>
                      )}
                    </Form.Group>
                  </Col>
                  <Col lg={6}>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Primer Nombre</Form.Label>
                          <Form.Control
                            type="text"
                            name="primer_nombre"
                            value={formData.primer_nombre || ""}
                            onChange={handleChange}
                            className={cambios.primer_nombre ? "campo-modificado" : ""}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Segundo Nombre</Form.Label>
                          <Form.Control
                            type="text"
                            name="segundo_nombre"
                            value={formData.segundo_nombre || ""}
                            onChange={handleChange}
                            className={cambios.segundo_nombre ? "campo-modificado" : ""}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </Col>
                </Row>
                
                {/* Continúa con más campos para datos personales */}
                
              </Form>
            </Tab>

            <Tab eventKey="contacto" title="Contacto">
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaMobileAlt className="me-2" />
                        Teléfono
                      </Form.Label>
                      <Form.Control
                        type="tel"
                        name="telefono"
                        value={formData.telefono || ""}
                        onChange={handleChange}
                        className={cambios.telefono ? "campo-modificado" : ""}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaEnvelope className="me-2" />
                        Correo Electrónico
                      </Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        value={formData.email || ""}
                        onChange={handleChange}
                        className={cambios.email ? "campo-modificado" : ""}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                
                {/* Más campos de contacto */}
                
              </Form>
            </Tab>

            <Tab eventKey="direccion" title="Dirección">
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaMapMarkerAlt className="me-2" />
                        Dirección Completa
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="direccion"
                        value={formData.direccion || ""}
                        onChange={handleChange}
                        className={cambios.direccion ? "campo-modificado" : ""}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                
                {/* Más campos de dirección */}
                
              </Form>
            </Tab>

            <Tab eventKey="ingresos" title="Información Económica">
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Tipo de Ingreso</Form.Label>
                      <Form.Select
                        name="tipo_ingreso"
                        value={formData.tipo_ingreso || ""}
                        onChange={handleChange}
                        className={cambios.tipo_ingreso ? "campo-modificado" : ""}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Salario">Salario</option>
                        <option value="Negocio Propio">Negocio Propio</option>
                        <option value="Pensión">Pensión</option>
                        <option value="Independiente">Trabajador Independiente</option>
                        <option value="Ocasional">Trabajo Ocasional</option>
                        <option value="Otro">Otro</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  
                  {/* Más campos de información económica */}
                  
                </Row>
              </Form>
            </Tab>
          </Tabs>
        </Card.Body>
        <Card.Footer className="d-flex justify-content-between">
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate("/cliente/lista")}
          >
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSubmit}
            disabled={Object.keys(cambios).length === 0 || saving}
          >
            {saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />}
            Guardar Cambios
          </Button>
        </Card.Footer>
      </Card>
      
      {/* Modal para cuando no hay cambios */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Sin cambios</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          No has realizado ningún cambio en los datos del cliente.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Aceptar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EditarCliente;