import React, { useState, useEffect } from "react";
import { 
  Modal, Button, Row, Col, Card, Badge, Table, 
  ListGroup
} from "react-bootstrap";
import apiRequest from "../services/api";
import {
  FaUser, FaAddressCard, FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, 
  FaBriefcase, FaCreditCard, FaPassport, FaCalendarAlt
} from "react-icons/fa";

const DetalleClienteModal = ({ show, onHide, clienteData }) => {
  // Si no hay datos de cliente, no mostrar nada
  if (!clienteData) return null;
  
  // Estado para controlar la pestaña activa
  const [activeTab, setActiveTab] = useState("general");
  const [mediosPago, setMediosPago] = useState([]);
  const [loadingMediosPago, setLoadingMediosPago] = useState(false);

  const [grupofamilia, setGrupoFamilia] = useState([]);
  const [loadingGrupoFamilia, setLoadingGrupoFamilia] = useState(false);


  const fetchMediosPago = async (clienteId) => {
    try {
      setLoadingMediosPago(true);
      const response = await apiRequest(`mediopago/cliente/${clienteId}`, "GET");
     
      setMediosPago(response);
    } catch (error) {
      console.error("Error obteniendo medios de pago", error);
    } finally {
      setLoadingMediosPago(false);
    }
  };

  const fetchPolizas = async (grupoFamiliarId) => {
    try {
      setLoadingGrupoFamilia(true);
      const response = await apiRequest(`grupo_familiar/grupos-familiares-full/${grupoFamiliarId}`, "GET");
  
      // Extraemos las personas
      const personas = response.data?.coberturas?.map((item) => ({
        ...item.cliente,
        parentesco: item.parentesco, // para mostrar parentesco
        tipo: item.parentesco === "TOMADOR" ? "TOMADOR" : "INTEGRANTE",
        compania: item.compania?.nombre || "No registrado"
      })) || [];
  
      setGrupoFamilia(personas);
  
    } catch (error) {
      console.error("Error obteniendo grupo familiar", error);
      setGrupoFamilia([]);
    } finally {
      setLoadingGrupoFamilia(false);
    }
  };
  
  
  
  // Formatear fecha para mostrarla más legible
  const formatDate = (dateString) => {
    if (!dateString) return "No disponible";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  useEffect(() => {
    if (show && clienteData?.id) {
      fetchMediosPago(clienteData.id);
    }
  }, [show, clienteData]);

  useEffect(() => {
    if (show && clienteData?.grupo_familiar_id) {
      fetchPolizas(clienteData.grupo_familiar_id);
    }
  }, [show, clienteData]);
  

  // Componente para mostrar información no disponible
  const NotAvailable = () => <span className="text-muted fst-italic">No disponible</span>;

  return (
    <Modal 
      show={show} 
      onHide={onHide}
      size="xl"
      centered
      className="detalle-cliente-modal"
    >
      <Modal.Header closeButton className="bg-light border-0">
        <Modal.Title className="d-flex align-items-center">
          <FaUser className="me-2 text-primary" />
          <div>
            <h5 className="mb-0">{clienteData.nombre_completo}</h5>
            <div className="d-flex align-items-center mt-1">
              {clienteData.status && (
                <Badge 
                  bg={clienteData.status.toLowerCase() === "activo" ? "success" : 
                      clienteData.status.toLowerCase() === "inactivo" ? "danger" : "warning"}
                  className="me-2"
                >
                  {clienteData.status}
                </Badge>
              )}
              {clienteData.categoria && (
                <Badge bg="info" className="me-2">
                  {clienteData.categoria}
                </Badge>
              )}
              <small className="text-muted">ID: {clienteData.id}</small>
            </div>
          </div>
        </Modal.Title>
      </Modal.Header>
      
  {/* Pestañas en fila tipo barra de navegación */}
<div className="border-bottom px-3">
  <ul className="nav nav-tabs w-100 d-flex flex-row justify-content-start">
    <li className="nav-item">
      <button 
        className={`nav-link ${activeTab === "general" ? "active" : ""}`}
        onClick={() => setActiveTab("general")}
      >
        Información General
      </button>
    </li>
    <li className="nav-item">
      <button 
        className={`nav-link ${activeTab === "empleo" ? "active" : ""}`}
        onClick={() => setActiveTab("empleo")}
      >
        Empleo e Ingresos
      </button>
    </li>
    <li className="nav-item">
      <button 
        className={`nav-link ${activeTab === "polizas" ? "active" : ""}`}
        onClick={() => setActiveTab("polizas")}
      >
        Pólizas y Coberturas
      </button>
    </li>
    <li className="nav-item">
      <button 
        className={`nav-link ${activeTab === "medios" ? "active" : ""}`}
        onClick={() => setActiveTab("medios")}
      >
        Mdios de Pago
      </button>
    </li>

    <li className="nav-item">
      <button 
        className={`nav-link ${activeTab === "info" ? "active" : ""}`}
        onClick={() => setActiveTab("info")}
      >
        Información Adicional
      </button>
    </li>
  </ul>
</div>

      
      <Modal.Body className="p-3">
        {/* Contenido de la pestaña Información General */}
        {activeTab === "general" && (
          <>
            <Row>
              <Col md={4} className="mb-3">
                <Card className="h-100 border-0 shadow-sm">
                  <Card.Header className="bg-light">
                    <h6 className="mb-0 d-flex align-items-center">
                      <FaUser className="me-2 text-primary" /> Información Personal
                    </h6>
                  </Card.Header>
                  <ListGroup variant="flush">
                    <ListGroup.Item>
                      <small className="text-muted d-block">Primer Nombre</small>
                      <strong>{clienteData.primer_nombre || <NotAvailable />}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <small className="text-muted d-block">Segundo Nombre</small>
                      <strong>{clienteData.segundo_nombre || <NotAvailable />}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <small className="text-muted d-block">Apellidos</small>
                      <strong>{clienteData.apellidos || <NotAvailable />}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <small className="text-muted d-block">Fecha de Nacimiento</small>
                      <strong>{formatDate(clienteData.fecha_nacimiento)}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <small className="text-muted d-block">Género</small>
                      <strong>{clienteData.genero || <NotAvailable />}</strong>
                    </ListGroup.Item>
                  </ListGroup>
                </Card>
              </Col>
              
              <Col md={4} className="mb-3">
                <Card className="h-100 border-0 shadow-sm">
                  <Card.Header className="bg-light">
                    <h6 className="mb-0 d-flex align-items-center">
                      <FaPhoneAlt className="me-2 text-primary" /> Información de Contacto
                    </h6>
                  </Card.Header>
                  <ListGroup variant="flush">
                    <ListGroup.Item>
                      <small className="text-muted d-block">Teléfono Principal</small>
                      <strong className="d-flex align-items-center">
                        {clienteData.telefono || <NotAvailable />}
                        {clienteData.whatsapp && 
                          <Badge bg="success" pill className="ms-2">WhatsApp</Badge>
                        }
                      </strong>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <small className="text-muted d-block">Teléfono Secundario</small>
                      <strong>{clienteData.tel_secundario || <NotAvailable />}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <small className="text-muted d-block">Email</small>
                      <strong>{clienteData.email ? (
                        <a href={`mailto:${clienteData.email}`} className="text-decoration-none">
                          <FaEnvelope className="me-1" size={14} />
                          {clienteData.email}
                        </a>
                      ) : (
                        <NotAvailable />
                      )}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <small className="text-muted d-block">Preferencias de Contacto</small>
                      <div className="mt-1">
                        {clienteData.servicios_mensajeria?.whatsapp && 
                          <Badge bg="success" className="me-1">WhatsApp</Badge>
                        }
                        {clienteData.servicios_mensajeria?.telegram && 
                          <Badge bg="info" className="me-1">Telegram</Badge>
                        }
                        {clienteData.servicios_mensajeria?.texto_sms && 
                          <Badge bg="secondary" className="me-1">SMS</Badge>
                        }
                        {(!clienteData.servicios_mensajeria?.whatsapp && 
                          !clienteData.servicios_mensajeria?.telegram && 
                          !clienteData.servicios_mensajeria?.texto_sms) && 
                          <NotAvailable />
                        }
                      </div>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <small className="text-muted d-block">Notas</small>
                      <p className="mb-0 small">{clienteData.nota_telefonos || <NotAvailable />}</p>
                    </ListGroup.Item>
                  </ListGroup>
                </Card>
              </Col>
              
              <Col md={4} className="mb-3">
                <Card className="h-100 border-0 shadow-sm">
                  <Card.Header className="bg-light">
                    <h6 className="mb-0 d-flex align-items-center">
                      <FaPassport className="me-2 text-primary" /> Status Migratorio
                    </h6>
                  </Card.Header>
                  <ListGroup variant="flush">
                    <ListGroup.Item>
                      <small className="text-muted d-block">Status</small>
                      <strong>{clienteData.status || <NotAvailable />}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <small className="text-muted d-block">Social</small>
                      <strong>{clienteData.social || <NotAvailable />}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <small className="text-muted d-block">A/USCIS</small>
                      <strong>{clienteData.a_uscis || <NotAvailable />}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <small className="text-muted d-block">Tarjeta #</small>
                      <strong>{clienteData.tarjeta_numero || <NotAvailable />}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <div className="d-flex justify-content-between">
                        <div>
                          <small className="text-muted d-block">Fecha Emisión</small>
                          <strong>{formatDate(clienteData.fecha_emision)}</strong>
                        </div>
                        <div>
                          <small className="text-muted d-block">Fecha Expedición</small>
                          <strong>{formatDate(clienteData.fecha_expedicion)}</strong>
                        </div>
                      </div>
                    </ListGroup.Item>
                  </ListGroup>
                </Card>
              </Col>
            </Row>
            
            <Row>
              <Col md={12} className="mb-3">
                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-light">
                    <h6 className="mb-0 d-flex align-items-center">
                      <FaMapMarkerAlt className="me-2 text-primary" /> Dirección
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6}>
                        <dl className="row mb-0">
                          <dt className="col-sm-4 text-muted">Calle y Número</dt>
                          <dd className="col-sm-8">
                            {clienteData.direccion?.calle 
                              ? `${clienteData.direccion.calle} ${clienteData.direccion.numero || ''}` 
                              : <NotAvailable />}
                          </dd>
                          
                          <dt className="col-sm-4 text-muted">Ciudad</dt>
                          <dd className="col-sm-8">{clienteData.direccion?.ciudad || <NotAvailable />}</dd>
                          
                          <dt className="col-sm-4 text-muted">Estado/Provincia</dt>
                          <dd className="col-sm-8">{clienteData.direccion?.estado || <NotAvailable />}</dd>
                        </dl>
                      </Col>
                      <Col md={6}>
                        <dl className="row mb-0">
                          <dt className="col-sm-4 text-muted">Código Postal</dt>
                          <dd className="col-sm-8">{clienteData.direccion?.codigo_postal || <NotAvailable />}</dd>
                          
                          <dt className="col-sm-4 text-muted">País</dt>
                          <dd className="col-sm-8">{clienteData.direccion?.pais || <NotAvailable />}</dd>
                          
                          <dt className="col-sm-4 text-muted">Referencias</dt>
                          <dd className="col-sm-8">{clienteData.direccion?.referencias || <NotAvailable />}</dd>
                        </dl>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        )}
        
        {/* Contenido de la pestaña Empleo e Ingresos */}
        {activeTab === "empleo" && (
          <Row>
            <Col md={12} className="mb-3">
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-light">
                  <h6 className="mb-0 d-flex align-items-center">
                    <FaBriefcase className="me-2 text-primary" /> Información Laboral
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <dl className="row mb-0">
                        <dt className="col-sm-4 text-muted">Tipo de Ingreso</dt>
                        <dd className="col-sm-8">{clienteData.tipo_ingreso || <NotAvailable />}</dd>
                        
                        <dt className="col-sm-4 text-muted">Actividad Económica</dt>
                        <dd className="col-sm-8">{clienteData.actividad_economica || <NotAvailable />}</dd>
                        
                        <dt className="col-sm-4 text-muted">Empleador</dt>
                        <dd className="col-sm-8">{clienteData.empleador || <NotAvailable />}</dd>
                        
                        <dt className="col-sm-4 text-muted">Teléfono Empleador</dt>
                        <dd className="col-sm-8">{clienteData.telefono_empleador || <NotAvailable />}</dd>
                      </dl>
                    </Col>
                    <Col md={6}>
                      <dl className="row mb-0">
                        <dt className="col-sm-4 text-muted">Período de Ingreso</dt>
                        <dd className="col-sm-8">
                          {clienteData.periodo_ingreso ? (
                            <Badge bg="secondary">
                              {clienteData.periodo_ingreso === "HOUR" ? "Por Hora" :
                               clienteData.periodo_ingreso === "DAY" ? "Diario" :
                               clienteData.periodo_ingreso === "WEEK" ? "Semanal" :
                               clienteData.periodo_ingreso === "BIWEEK" ? "Quincenal" :
                               clienteData.periodo_ingreso === "MONTH" ? "Mensual" :
                               clienteData.periodo_ingreso === "YEAR" ? "Anual" :
                               clienteData.periodo_ingreso}
                            </Badge>
                          ) : <NotAvailable />}
                        </dd>
                        
                        <dt className="col-sm-4 text-muted">Ingreso por Período</dt>
                        <dd className="col-sm-8">
                          {clienteData.ingreso_por_periodo 
                            ? `$${Number(clienteData.ingreso_por_periodo).toLocaleString()}` 
                            : <NotAvailable />}
                        </dd>
                        
                        <dt className="col-sm-4 text-muted fw-bold">Ingreso Anual</dt>
                        <dd className="col-sm-8 fw-bold">
                          {clienteData.ingreso_anual 
                            ? `$${Number(clienteData.ingreso_anual).toLocaleString()}` 
                            : <NotAvailable />}
                        </dd>
                      </dl>
                    </Col>
                  </Row>
                  
                  {clienteData.ingreso_ocasional && (
                    <div className="mt-4">
                      <h6 className="border-bottom pb-2">Ingreso Ocasional</h6>
                      <Row>
                        <Col md={12}>
                          <dl className="row mb-0">
                            <dt className="col-sm-2 text-muted">Período</dt>
                            <dd className="col-sm-4">
                              {clienteData.ingreso_ocasional.periodo ? (
                                <Badge bg="secondary">
                                  {clienteData.ingreso_ocasional.periodo === "HOUR" ? "Por Hora" :
                                   clienteData.ingreso_ocasional.periodo === "DAY" ? "Diario" :
                                   clienteData.ingreso_ocasional.periodo === "WEEK" ? "Semanal" :
                                   clienteData.ingreso_ocasional.periodo === "BIWEEK" ? "Quincenal" :
                                   clienteData.ingreso_ocasional.periodo === "MONTH" ? "Mensual" :
                                   clienteData.ingreso_ocasional.periodo === "YEAR" ? "Anual" :
                                   clienteData.ingreso_ocasional.periodo}
                                </Badge>
                              ) : <NotAvailable />}
                            </dd>
                            
                            <dt className="col-sm-2 text-muted">Monto</dt>
                            <dd className="col-sm-4">
                              {clienteData.ingreso_ocasional.monto 
                                ? `$${Number(clienteData.ingreso_ocasional.monto).toLocaleString()}` 
                                : <NotAvailable />}
                            </dd>
                          </dl>
                          
                          {clienteData.ingreso_ocasional.nota && (
                            <div className="mt-3">
                              <small className="text-muted">Nota:</small>
                              <p className="mb-0 small mt-1">{clienteData.ingreso_ocasional.nota}</p>
                            </div>
                          )}
                        </Col>
                      </Row>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
        
        {/* Contenido de la pestaña Pólizas y Coberturas */}
              {activeTab === "polizas" && (
          <>
            <div className="mt-4">
              <h5 className="border-bottom pb-2 mb-3 text-primary fw-bold">
               Grupo Familiar 
              </h5>

              {loadingGrupoFamilia ? (
                <div className="text-center py-4">
                  <span className="spinner-border text-primary"></span>
                </div>
              ) : grupofamilia.length > 0 ? (
                <Table responsive bordered hover>
                  <thead className="bg-light">
                    <tr>
                      <th>#</th>
                      <th>Nombre Completo</th>
                      <th>Parentesco</th>
                      <th>Compañia</th>
                    </tr>
                  </thead>
                  <tbody>
                      {grupofamilia.map((integrante, index) => (
                        <tr key={integrante.id || index}>
                          <td>{index + 1}</td>
                          <td className="d-flex align-items-center gap-2">
                            {integrante.nombre_completo}
                            {integrante.tipo === "TOMADOR" && (
                              <Badge bg="primary" pill>TOMADOR</Badge>
                            )}
                          </td>
                          <td>{integrante.parentesco || "No registrado"}</td>
                          <td>{integrante.compania || "No registrado"}</td>
                        </tr>
                      ))}
                    </tbody>

                </Table>
              ) : (
                <div className="text-center py-5 bg-light rounded">
                  <FaUser size={40} className="text-muted mb-3" />
                  <h6 className="text-muted">No hay personas asociadas.</h6>
                </div>
              )}
            </div>
          </>
        )}

            {activeTab === "medios" && (
              <>
              {loadingMediosPago ? (
                <div className="text-center py-4">
                  <span className="spinner-border text-primary"></span>
                </div>
              ) : mediosPago.length > 0 ? (
                <Table responsive bordered hover>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Titular</th>
                      <th>N° Tarjeta</th>
                      <th>Banco</th>
                      <th>N° Cuenta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mediosPago.map((medio, index) => (
                      <tr key={index}>
                        <td>{medio.forma_pago}</td>
                        <td>{medio.titular}</td>
                        <td>{medio.numero_tarjeta}</td>
                        <td>{medio.banco}</td>
                        <td>{medio.cuenta_numero}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="text-center py-4">
                  <h6>No hay medios de pago registrados</h6>
                </div>
              )}
            </>
                )}

        
        {/* Contenido de la pestaña Información Adicional */}
        {activeTab === "info" && (
          <Row>
            <Col md={6} className="mb-3">
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-light">
                  <h6 className="mb-0 d-flex align-items-center">
                    <FaAddressCard className="me-2 text-primary" /> Información de Registro
                  </h6>
                </Card.Header>
                <ListGroup variant="flush">
                  <ListGroup.Item>
                    <small className="text-muted d-block">Fecha de Registro</small>
                    <strong>{formatDate(clienteData.created_at)}</strong>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <small className="text-muted d-block">Última Actualización</small>
                    <strong>{formatDate(clienteData.updated_at)}</strong>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <small className="text-muted d-block">Categoría</small>
                    <strong>{clienteData.categoria || <NotAvailable />}</strong>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <small className="text-muted d-block">Tipo de Documento</small>
                    <strong>{clienteData.tipo_documento || <NotAvailable />}</strong>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <small className="text-muted d-block">Número de Documento</small>
                    <strong>{clienteData.numero_documento || <NotAvailable />}</strong>
                  </ListGroup.Item>
                </ListGroup>
              </Card>
            </Col>
            
            <Col md={6} className="mb-3">
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-light">
                  <h6 className="mb-0 d-flex align-items-center">
                    <FaCalendarAlt className="me-2 text-primary" /> Historial y Eventos
                  </h6>
                </Card.Header>
                <Card.Body>
                  {clienteData.historial && clienteData.historial.length > 0 ? (
                    <div className="timeline">
                      {clienteData.historial.map((evento, index) => (
                        <div key={index} className="timeline-item">
                          <div className="timeline-badge bg-primary">
                            <small>{formatDate(evento.fecha)}</small>
                          </div>
                          <div className="timeline-content">
                            <h6>{evento.tipo}</h6>
                            <p>{evento.descripcion}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <FaCalendarAlt size={30} className="text-muted mb-3" />
                      <p className="mb-0">No hay eventos registrados para este cliente.</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </Modal.Body>
      
      <Modal.Footer className="bg-light">
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Agrega estos estilos CSS directamente al componente para las pestañas horizontales
const styles = `
.nav-tabs {
    border-bottom: 1px solid #dee2e6;
}

.nav-tabs .nav-item {
    margin-right: 1rem;
}

.nav-tabs .nav-link {
    color: #6c757d;
    font-weight: 500;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    transition: 0.3s ease;
}

.nav-tabs .nav-link.active {
    color: #0d6efd;
    border-bottom: 2px solid #0d6efd;
    background: none;
}


`;

// Inyectar estilos CSS
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.innerHTML = styles;
  document.head.appendChild(styleEl);
}

export default DetalleClienteModal;