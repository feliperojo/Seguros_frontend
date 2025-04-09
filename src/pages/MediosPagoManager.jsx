import React, { useState, useEffect } from "react";
import { 
  Card, Button, Form, Row, Col, Spinner, Alert, 
  Modal, Table, Badge, Dropdown
} from "react-bootstrap";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import apiRequest from "../services/api";

const MediosPagoManager = () => {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const actionParam = queryParams.get("action");
  const idParam = queryParams.get("id");
  
  // Estado del cliente
  const [cliente, setCliente] = useState(null);
  const [loadingCliente, setLoadingCliente] = useState(true);
  
  // Estados para la gestión de medios de pago
  const [mediosPago, setMediosPago] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentMedioPago, setCurrentMedioPago] = useState(null);
  const [formData, setFormData] = useState({
    tipo: "tarjeta_credito",
    numero: "",
    titular: "",
    fecha_vencimiento: "",
    cvv: "",
    banco: "",
    referencia: "",
    notas: "",
    activo: true
  });
  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [procesando, setProcesando] = useState(false);
  
  // Cargar datos del cliente y medios de pago al montar el componente
  useEffect(() => {
    fetchClienteData();
    fetchMediosPago();
    
    // Si hay parámetros para abrir en un modo específico
    if (actionParam === "new") {
      handleAddNew();
    } else if (idParam) {
      fetchMedioPagoById(idParam);
    }
  }, [clienteId, actionParam, idParam]);
  
  // Función para cargar datos del cliente
  const fetchClienteData = async () => {
    if (!clienteId) return;
    
    setLoadingCliente(true);
    
    try {
      const response = await apiRequest(`cliente/${clienteId}`, "GET");
      setCliente(response);
    } catch (error) {
      console.error("Error al cargar cliente:", error);
      setError("No se pudo cargar la información del cliente.");
    } finally {
      setLoadingCliente(false);
    }
  };
  
  // Función para cargar un medio de pago específico por ID
  const fetchMedioPagoById = async (id) => {
    try {
      const response = await apiRequest(`mediopago/${id}`, "GET");
      setCurrentMedioPago(response);
      setFormData({
        tipo: response.tipo_tarjeta || "tarjeta_credito",
        numero: response.cuenta_numero || "",
        titular: response.titular || "",
        fecha_vencimiento: response.fecha_vencimiento || "",
        cvv: response.cvv || "",
        banco: response.banco || "",
        referencia: response.referencia || "",
        notas: response.notas || "",
        activo: response.activo !== undefined ? response.activo : true
      });
      setShowEditModal(true);
    } catch (error) {
      console.error("Error al cargar medio de pago:", error);
      setError("No se pudo cargar el medio de pago solicitado.");
    }
  };
  
  // Función para cargar medios de pago
  const fetchMediosPago = async () => {
    if (!clienteId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest(`mediopago/cliente/${clienteId}`, "GET");
      
      if (Array.isArray(response)) {
        setMediosPago(response);
      } else {
        console.error("Respuesta inesperada:", response);
        setMediosPago([]);
      }
    } catch (error) {
      console.error("Error al cargar medios de pago:", error);
      setError("No se pudieron cargar los medios de pago del cliente.");
    } finally {
      setLoading(false);
    }
  };
  
  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Limpiar error del campo cuando el usuario modifica su valor
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  // Validar formulario
  const validateForm = () => {
    const errors = {};
    const { tipo, numero, titular, fecha_vencimiento, referencia } = formData;
    
    if (tipo === 'tarjeta_credito' || tipo === 'tarjeta_debito') {
      if (!numero) errors.numero = "El número es obligatorio";
      else if (!/^\d{13,19}$/.test(numero.replace(/\s/g, ''))) 
        errors.numero = "Número de tarjeta inválido";
      
      if (!titular) errors.titular = "El titular es obligatorio";
      if (!fecha_vencimiento) errors.fecha_vencimiento = "La fecha de vencimiento es obligatoria";
    }
    
    if (tipo === 'transferencia' || tipo === 'cheque') {
      if (!referencia) errors.referencia = "La referencia es obligatoria";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Abrir modal para añadir nuevo medio de pago
  const handleAddNew = () => {
    setFormData({
      tipo: "tarjeta_credito",
      numero: "",
      titular: "",
      fecha_vencimiento: "",
      cvv: "",
      banco: "",
      referencia: "",
      notas: "",
      activo: true
    });
    setFormErrors({});
    setShowAddModal(true);
  };
  
  // Abrir modal para editar medio de pago
  const handleEdit = (medioPago) => {
    setCurrentMedioPago(medioPago);
    setFormData({
      tipo: medioPago.tipo || "tarjeta_credito",
      numero: medioPago.numero || "",
      titular: medioPago.titular || "",
      fecha_vencimiento: medioPago.fecha_vencimiento || "",
      cvv: medioPago.cvv || "",
      banco: medioPago.banco || "",
      referencia: medioPago.referencia || "",
      notas: medioPago.notas || "",
      activo: medioPago.activo !== undefined ? medioPago.activo : true
    });
    setFormErrors({});
    setShowEditModal(true);
  };
  
  // Guardar nuevo medio de pago
  const handleSaveNew = async () => {
    if (!validateForm()) return;
    
    setProcesando(true);
    
    try {
      // Preparar datos para API
      const dataToSend = {
        ...formData,
        cliente_id: clienteId
      };
      
      // Enviar a API
      const response = await apiRequest("mediopago", "POST", dataToSend);
      
      // Actualizar lista local
      setMediosPago(prev => [...prev, response]);
      
      // Mostrar mensaje de éxito
      setSuccessMessage("Medio de pago añadido correctamente");
      setTimeout(() => setSuccessMessage(""), 3000);
      
      // Cerrar modal
      setShowAddModal(false);
      
      // Limpiar parámetros de URL si los había
      if (actionParam === "new") {
        navigate(`/clientes/mediopago/${clienteId}`, { replace: true });
      }
    } catch (error) {
      console.error("Error al añadir medio de pago:", error);
      setError("No se pudo añadir el medio de pago. " + (error.message || ""));
      setTimeout(() => setError(null), 5000);
    } finally {
      setProcesando(false);
    }
  };
  
  // Actualizar medio de pago existente
  const handleUpdate = async () => {
    if (!validateForm() || !currentMedioPago) return;
    
    setProcesando(true);
    
    try {
      // Enviar a API
      const response = await apiRequest(`medios-pago/${currentMedioPago.id}`, "PUT", formData);
      
      // Actualizar lista local
      setMediosPago(prev => 
        prev.map(medio => 
          medio.id === currentMedioPago.id ? response : medio
        )
      );
      
      // Mostrar mensaje de éxito
      setSuccessMessage("Medio de pago actualizado correctamente");
      setTimeout(() => setSuccessMessage(""), 3000);
      
      // Cerrar modal
      setShowEditModal(false);
      
      // Limpiar parámetros de URL si los había
      if (idParam) {
        navigate(`/clientes/medios-pago/${clienteId}`, { replace: true });
      }
    } catch (error) {
      console.error("Error al actualizar medio de pago:", error);
      setError("No se pudo actualizar el medio de pago. " + (error.message || ""));
      setTimeout(() => setError(null), 5000);
    } finally {
      setProcesando(false);
    }
  };
  
  // Eliminar medio de pago
  const handleDelete = async (medioId) => {
    if (!window.confirm("¿Está seguro que desea eliminar este medio de pago?")) return;
    
    try {
      // Eliminar en API
      await apiRequest(`medios-pago/${medioId}`, "DELETE");
      
      // Actualizar lista local
      setMediosPago(prev => prev.filter(medio => medio.id !== medioId));
      
      // Mostrar mensaje de éxito
      setSuccessMessage("Medio de pago eliminado correctamente");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error al eliminar medio de pago:", error);
      setError("No se pudo eliminar el medio de pago. " + (error.message || ""));
      setTimeout(() => setError(null), 5000);
    }
  };
  
  // Cambiar estado de medio de pago (activar/desactivar)
  const handleToggleEstado = async (medioId, nuevoEstado) => {
    try {
      // Optimistic update
      setMediosPago(prev => 
        prev.map(medio => 
          medio.id === medioId ? {...medio, activo: nuevoEstado} : medio
        )
      );
      
      // Actualizar en API
      await apiRequest(`medios-pago/${medioId}`, "PATCH", {
        activo: nuevoEstado
      });
      
      // Mostrar mensaje de éxito
      setSuccessMessage(`Medio de pago ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error al cambiar estado del medio de pago:", error);
      
      // Revertir cambio optimista
      setMediosPago(prev => 
        prev.map(medio => 
          medio.id === medioId ? {...medio, activo: !nuevoEstado} : medio
        )
      );
      
      setError(`No se pudo ${nuevoEstado ? 'activar' : 'desactivar'} el medio de pago.`);
      setTimeout(() => setError(null), 3000);
    }
  };
  
  // Función auxiliar para obtener etiqueta según tipo
  const getTipoMedioPagoLabel = (tipo) => {
    switch (tipo) {
      case 'tarjeta_credito': return 'Tarjeta de Crédito';
      case 'tarjeta_debito': return 'Tarjeta de Débito';
      case 'efectivo': return 'Efectivo';
      case 'transferencia': return 'Transferencia';
      case 'cheque': return 'Cheque';
      default: return tipo;
    }
  };
  
  // Función para formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  // Renderizar el formulario de tarjeta
  const renderTarjetaForm = () => (
    <>
      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Número de Tarjeta</Form.Label>
            <Form.Control
              type="text"
              name="numero"
              value={formData.numero}
              onChange={handleInputChange}
              isInvalid={!!formErrors.numero}
              placeholder="XXXX XXXX XXXX XXXX"
            />
            <Form.Control.Feedback type="invalid">
              {formErrors.numero}
            </Form.Control.Feedback>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Titular</Form.Label>
            <Form.Control
              type="text"
              name="titular"
              value={formData.titular}
              onChange={handleInputChange}
              isInvalid={!!formErrors.titular}
              placeholder="Nombre como aparece en la tarjeta"
            />
            <Form.Control.Feedback type="invalid">
              {formErrors.titular}
            </Form.Control.Feedback>
          </Form.Group>
        </Col>
      </Row>
      
      <Row className="mb-3">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Fecha de Vencimiento</Form.Label>
            <Form.Control
              type="month"
              name="fecha_vencimiento"
              value={formData.fecha_vencimiento}
              onChange={handleInputChange}
              isInvalid={!!formErrors.fecha_vencimiento}
            />
            <Form.Control.Feedback type="invalid">
              {formErrors.fecha_vencimiento}
            </Form.Control.Feedback>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>CVV</Form.Label>
            <Form.Control
              type="text"
              name="cvv"
              value={formData.cvv}
              onChange={handleInputChange}
              maxLength={4}
              placeholder="123"
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Banco</Form.Label>
            <Form.Control
              type="text"
              name="banco"
              value={formData.banco}
              onChange={handleInputChange}
              placeholder="Opcional"
            />
          </Form.Group>
        </Col>
      </Row>
    </>
  );
  
  // Renderizar el formulario de transferencia o cheque
  const renderTransferenciaChequeForm = () => (
    <Row className="mb-3">
      <Col md={6}>
        <Form.Group>
          <Form.Label>Referencia</Form.Label>
          <Form.Control
            type="text"
            name="referencia"
            value={formData.referencia}
            onChange={handleInputChange}
            isInvalid={!!formErrors.referencia}
            placeholder="Número de referencia o identificador"
          />
          <Form.Control.Feedback type="invalid">
            {formErrors.referencia}
          </Form.Control.Feedback>
        </Form.Group>
      </Col>
      <Col md={6}>
        <Form.Group>
          <Form.Label>Banco</Form.Label>
          <Form.Control
            type="text"
            name="banco"
            value={formData.banco}
            onChange={handleInputChange}
            placeholder="Opcional"
          />
        </Form.Group>
      </Col>
    </Row>
  );
  
  // Renderizar el formulario de efectivo
  const renderEfectivoForm = () => (
    <Row className="mb-3">
      <Col md={12}>
        <Form.Group>
          <Form.Label>Referencia</Form.Label>
          <Form.Control
            type="text"
            name="referencia"
            value={formData.referencia}
            onChange={handleInputChange}
            placeholder="Opcional - Identificador para este método de pago"
          />
        </Form.Group>
      </Col>
    </Row>
  );
  
  return (
    <div className="container-fluid py-4">
      {/* Breadcrumb y encabezado */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Inicio</a>
              </li>
              <li className="breadcrumb-item">
                <a href="/clientes" onClick={(e) => { e.preventDefault(); navigate('/clientes'); }}>Clientes</a>
              </li>
              {cliente && (
                <li className="breadcrumb-item">
                  <a href={`/clientes/${clienteId}`} onClick={(e) => { e.preventDefault(); navigate(`/clientes/${clienteId}`); }}>
                    {cliente.nombre_completo}
                  </a>
                </li>
              )}
              <li className="breadcrumb-item active" aria-current="page">Medios de Pago</li>
            </ol>
          </nav>
          <h4 className="mb-0">
            <i className="bi bi-credit-card me-2"></i>
            Gestión de Medios de Pago
          </h4>
        </div>
        <Button 
          variant="outline-secondary" 
          onClick={() => navigate(-1)}
        >
          <i className="bi bi-arrow-left me-2"></i>
          Volver
        </Button>
      </div>
      
      <Card className="shadow-sm mb-4">
        <Card.Header className="bg-white d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-0">Medios de Pago</h5>
            {cliente && (
              <p className="text-muted mb-0 small">
                Cliente: <strong>{cliente.nombre_completo}</strong>
              </p>
            )}
          </div>
          <Button variant="primary" onClick={handleAddNew}>
            <i className="bi bi-plus-circle me-2"></i>
            Nuevo Medio de Pago
          </Button>
        </Card.Header>
        <Card.Body>
          {successMessage && (
            <Alert variant="success" className="d-flex align-items-center">
              <i className="bi bi-check-circle me-2"></i>
              {successMessage}
            </Alert>
          )}
          
          {error && (
            <Alert variant="danger" className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </Alert>
          )}
          
          {loading || loadingCliente ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted">Cargando información...</p>
            </div>
          ) : mediosPago.length === 0 ? (
            <div className="text-center border rounded py-5 bg-light">
              <i className="bi bi-credit-card display-4 text-muted"></i>
              <h5 className="mt-3">No hay medios de pago registrados</h5>
              <p className="text-muted mb-3">Añada un nuevo medio de pago para este cliente.</p>
              <Button 
                variant="outline-primary" 
                onClick={handleAddNew}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Agregar Medio de Pago
              </Button>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Tipo</th>
                    <th>Número/Referencia</th>
                    <th>Titular</th>
                    <th>Banco</th>
                    <th>Vencimiento</th>
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {mediosPago.map(medio => (
                    <tr key={medio.id}>
                      <td>
                        <div className="d-flex align-items-center">
                          {medio.tipo === 'tarjeta_credito' && <i className="bi bi-credit-card me-2 text-primary"></i>}
                          {medio.tipo === 'tarjeta_debito' && <i className="bi bi-credit-card-2-front me-2 text-success"></i>}
                          {medio.tipo === 'efectivo' && <i className="bi bi-cash me-2 text-warning"></i>}
                          {medio.tipo === 'transferencia' && <i className="bi bi-bank me-2 text-info"></i>}
                          {medio.tipo === 'cheque' && <i className="bi bi-file-earmark-text me-2 text-secondary"></i>}
                          {getTipoMedioPagoLabel(medio.tipo)}
                        </div>
                      </td>
                      <td>
                        {medio.numero ? (
                          <span>
                            •••• {medio.numero.slice(-4)}
                          </span>
                        ) : medio.referencia || '-'}
                      </td>
                      <td>{medio.titular || '-'}</td>
                      <td>{medio.banco || '-'}</td>
                      <td>{medio.fecha_vencimiento ? formatDate(medio.fecha_vencimiento) : '-'}</td>
                      <td>
                        <Badge bg={medio.activo ? 'success' : 'danger'} className="rounded-pill">
                          {medio.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="text-end">
                        <Dropdown align="end">
                          <Dropdown.Toggle variant="outline-secondary" size="sm" id={`dropdown-${medio.id}`}>
                            <i className="bi bi-three-dots-vertical"></i>
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                            <Dropdown.Item onClick={() => handleEdit(medio)}>
                              <i className="bi bi-pencil me-2"></i> Editar
                            </Dropdown.Item>
                            <Dropdown.Item 
                              onClick={() => handleToggleEstado(medio.id, !medio.activo)}
                            >
                              {medio.activo ? (
                                <>
                                  <i className="bi bi-x-circle me-2 text-danger"></i> Desactivar
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-check-circle me-2 text-success"></i> Activar
                                </>
                              )}
                            </Dropdown.Item>
                            <Dropdown.Divider />
                            <Dropdown.Item 
                              onClick={() => handleDelete(medio.id)}
                              className="text-danger"
                            >
                              <i className="bi bi-trash me-2"></i> Eliminar
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
      
      {/* Modal para añadir medio de pago */}
      <Modal 
        show={showAddModal} 
        onHide={() => setShowAddModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-plus-circle me-2"></i>
            Nuevo Medio de Pago
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Tipo de Medio de Pago</Form.Label>
              <Form.Select
                name="tipo"
                value={formData.tipo}
                onChange={handleInputChange}
              >
                <option value="tarjeta_credito">Tarjeta de Crédito</option>
                <option value="tarjeta_debito">Tarjeta de Débito</option>
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="cheque">Cheque</option>
                <option value="efectivo">Efectivo</option>
              </Form.Select>
            </Form.Group>
            
            {/* Renderizar formulario según tipo */}
            {(formData.tipo === 'tarjeta_credito' || formData.tipo === 'tarjeta_debito') && renderTarjetaForm()}
            {(formData.tipo === 'transferencia' || formData.tipo === 'cheque') && renderTransferenciaChequeForm()}
            {formData.tipo === 'efectivo' && renderEfectivoForm()}
            
            <Form.Group className="mb-3">
              <Form.Label>Notas</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="notas"
                value={formData.notas}
                onChange={handleInputChange}
                placeholder="Información adicional sobre este medio de pago"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="activo-check"
                label="Activo"
                name="activo"
                checked={formData.activo}
                onChange={handleInputChange}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveNew}
            disabled={procesando}
          >
            {procesando ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Guardando...
              </>
            ) : (
              <>
                <i className="bi bi-save me-2"></i>
                Guardar
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Modal para editar medio de pago */}
      <Modal 
        show={showEditModal} 
        onHide={() => setShowEditModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-pencil-square me-2"></i>
            Editar Medio de Pago
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Tipo de Medio de Pago</Form.Label>
              <Form.Select
                name="tipo"
                value={formData.tipo}
                onChange={handleInputChange}
              >
                <option value="tarjeta_credito">Tarjeta de Crédito</option>
                <option value="tarjeta_debito">Tarjeta de Débito</option>
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="cheque">Cheque</option>
                <option value="efectivo">Efectivo</option>
              </Form.Select>
            </Form.Group>
            
            {/* Renderizar formulario según tipo */}
            {(formData.tipo === 'tarjeta_credito' || formData.tipo === 'tarjeta_debito') && renderTarjetaForm()}
            {(formData.tipo === 'transferencia' || formData.tipo === 'cheque') && renderTransferenciaChequeForm()}
            {formData.tipo === 'efectivo' && renderEfectivoForm()}
            
            <Form.Group className="mb-3">
              <Form.Label>Notas</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="notas"
                value={formData.notas}
                onChange={handleInputChange}
                placeholder="Información adicional sobre este medio de pago"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="activo-edit-check"
                label="Activo"
                name="activo"
                checked={formData.activo}
                onChange={handleInputChange}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleUpdate}
            disabled={procesando}
          >
            {procesando ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Actualizando...
              </>
            ) : (
              <>
                <i className="bi bi-save me-2"></i>
                Guardar Cambios
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MediosPagoManager;