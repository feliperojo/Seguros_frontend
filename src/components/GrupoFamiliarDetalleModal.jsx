import React, { useState, useCallback } from "react";
import { Modal, Button, Table, Form, Badge } from "react-bootstrap";
import { FaFileExport, FaFilePdf, FaChevronDown, FaChevronRight } from "react-icons/fa";
import Swal from "sweetalert2";
import { generarPDFConfirmacion } from "../services/generarPDFConfirmacion";
import DriveUrlModal from "../components/GrupoFamiliar/DriveUrlModal"; // Ajusta la ruta
import DocumentoGeneradoModal from "./DocumentoGeneradoModal";

const grupoColorMap = {
  G1: "#0d6efd",   // Azul
  G2: "#198754",   // Verde
  G3: "#ffc107"    // Amarillo
};

const GrupoFamiliarDetalleModal = ({ show, onHide, grupo, getTomadorNombre }) => {
 
  const [mostrarInactivas, setMostrarInactivas] = useState(false);
  const [filasExpandidas, setFilasExpandidas] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [confirmacionLanguage, setConfirmacionLanguage] = useState("es");
  const [driveUrl, setDriveUrl] = useState("");
  const isTomador = (parentesco) => {
    return parentesco && parentesco.toUpperCase() === "TOMADOR";
  };

  const parseDate = (isoString) => {
    const date = new Date(isoString);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date.toLocaleDateString('es-CO');
  };

  React.useEffect(() => {
    // Actualizar driveUrl cuando cambia el grupo (incluyendo cuando es null o undefined)
    setDriveUrl(grupo?.drive_url || "");
    // Resetear las filas expandidas cuando cambia el grupo
    setFilasExpandidas(new Set());
  }, [grupo]);
  
  // Resetear las filas expandidas cuando se cierra el modal
  React.useEffect(() => {
    if (!show) {
      setFilasExpandidas(new Set());
    }
  }, [show]);
  

  const toggleFila = useCallback((coberturaId) => {
    setFilasExpandidas(prev => {
      const nuevasFilasExpandidas = new Set(prev);
      if (nuevasFilasExpandidas.has(coberturaId)) {
        nuevasFilasExpandidas.delete(coberturaId);
      } else {
        nuevasFilasExpandidas.add(coberturaId);
      }
      return nuevasFilasExpandidas;
    });
  }, []);

  const renderDetalleExpandido = (cobertura, coberturaId) => {
    const isExpanded = filasExpandidas.has(coberturaId);
    
    return (
      <tr style={{ display: isExpanded ? 'table-row' : 'none' }}>
        <td colSpan="14" style={{ padding: 0, border: 'none' }}>
          <div className="bg-light p-3 border-top" style={{ margin: '0' }}>
                <div className="row">
                  <div className="col-md-12">
                    <h6 className="text-primary mb-3">
                      <strong>Información Detallada de la Cobertura</strong>
                    </h6>
                  </div>
                </div>
                
                <div className="row">
                  {/* Información del Cliente */}
                  <div className="col-md-4">
                    <div className="card border-0 bg-white shadow-sm h-100">
                      <div className="card-body">
                        <h6 className="card-title text-secondary mb-3">
                          👤 Información del Cliente
                        </h6>
                        <div className="mb-2">
                          <small className="text-muted">Nombre Completo:</small>
                          <div className="fw-semibold">{cobertura.cliente?.nombre_completo || "No especificado"}</div>
                        </div>
                        <div className="mb-2">
                          <small className="text-muted">Email:</small>
                          <div>{cobertura.cliente?.email || "No especificado"}</div>
                        </div>
                        <div className="mb-2">
                          <small className="text-muted">Teléfono:</small>
                          <div>{cobertura.cliente?.telefono || "No especificado"}</div>
                        </div>
                        <div className="mb-2">
                          <small className="text-muted">Fecha de Nacimiento:</small>
                          <div>{cobertura.cliente?.fecha_nacimiento ? parseDate(cobertura.cliente.fecha_nacimiento) : "No especificado"}</div>
                        </div>
                        <div className="mb-2">
                          <small className="text-muted">Status:</small>
                          <div>{cobertura.cliente?.status|| "No especificado"}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Información de la Póliza */}
                  <div className="col-md-4">
                    <div className="card border-0 bg-white shadow-sm h-100">
                      <div className="card-body">
                        <h6 className="card-title text-secondary mb-3">
                          📋 Mas detalles de la Póliza
                        </h6>
                        <div className="mb-2">
                          <small className="text-muted">Estado:</small>
                          <div>
                            <Badge bg={cobertura.activo ? "success" : "danger"}>
                              {cobertura.activo ? "Activa" : "Inactiva"}
                            </Badge>
                          </div>
                        </div>
                        <div className="mb-2">
                          <small className="text-muted">Tipo de pago:</small>
                          <div>{cobertura.tipo_pago || "No especificado"}</div>
                        </div>
                        <div className="mb-2">
                          <small className="text-muted">Dia de pago:</small>
                          <div>{cobertura.dia_pago || "No especificado"}</div>
                        </div>
                        <div className="mb-2">
                          <small className="text-muted">Cobertura:</small>
                          <div>{cobertura.estado_cobertura || "No especificado"}</div>
                        </div>
                        <div className="mb-2">
                          <small className="text-muted">Prima Mensual:</small>
                          <div className="fw-semibold text-success">
                            ${cobertura.prima_mensual || cobertura.precio || "0"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Información Adicional */}
                  <div className="col-md-4">
                    <div className="card border-0 bg-white shadow-sm h-100">
                      <div className="card-body">
                        <h6 className="card-title text-secondary mb-3">
                          ℹ️ Información Adicional
                        </h6>
                       
                              <div className="mb-2">
                                <small className="text-muted">Requerimientos:</small>
                                {cobertura.requerimientos && cobertura.requerimientos.length > 0 ? (
                                  <ul className="small mb-0 ps-3">
                                    {cobertura.requerimientos.map((req, index) => (
                                      <li key={index}>
                                        <strong>{req.documento_requerido}</strong> – {req.estado}
                                        <br />
                                        <em>{req.observaciones}</em>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div>No asignado</div>
                                )}
                              </div>
                        <div className="mb-2">
                          <small className="text-muted">Captado por:</small>
                          <div className="small">{grupo.captado_por || "Sin observaciones"}</div>
                        </div>
                        <div className="mb-2">
                          <small className="text-muted">Fecha de Creación:</small>
                          <div>{cobertura.create_at ? parseDate(cobertura.create_at) : "No especificado"}</div>
                        </div>
                        <div className="mb-2">
                          <small className="text-muted">Última Modificación:</small>
                          <div>{cobertura.fecha_modificacion ? parseDate(cobertura.fecha_modificacion) : "No especificado"}</div>
                        </div>
                        <div className="mb-2">
                          <small className="text-muted">Beneficiarios:</small>
                          <div>{cobertura.beneficiarios || "No especificado"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sección de documentos o información relevante */}
                {(cobertura.documentos || cobertura.historial_cambios) && (
                  <div className="row mt-3">
                    <div className="col-md-12">
                      <div className="card border-0 bg-white shadow-sm">
                        <div className="card-body">
                          <h6 className="card-title text-secondary mb-3">
                            📄 Documentos y Historial
                          </h6>
                          <div className="row">
                            <div className="col-md-6">
                              <small className="text-muted">Documentos Adjuntos:</small>
                              <div>{cobertura.documentos ? `${cobertura.documentos.length} documento(s)` : "Sin documentos"}</div>
                            </div>
                            <div className="col-md-6">
                              <small className="text-muted">Último Cambio:</small>
                              <div>{cobertura.ultimo_cambio || "Sin cambios registrados"}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered dialogClassName="modal-90w">
      <Modal.Header closeButton className="bg-light">
        <Modal.Title>
          <strong>Detalles del Grupo Familiar</strong>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="px-4 py-4 bg-light">
        {grupo && (
          <div className="container-fluid">
            {/* Información General */}
            <div className="card shadow-sm mb-4">
              <div className="card-body">
                <h5 className="card-title text-primary mb-3">Información General</h5>
                <div className="row">
                  <div className="col-md-3">
                    <p className="text-muted mb-1">ID del Grupo</p>
                    <h6 className="fw-semibold">{grupo.id}</h6>
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-3">
                    <p className="text-muted mb-1">Agente Responsable</p>
                    <h6 className="fw-semibold">{grupo.responsable}</h6>
                  </div>
                  <div className="col-md-3">
                    <p className="text-muted mb-1">Carta Autorización</p>
                    <h6 className="fw-semibold">{grupo.carta_autorizacion}</h6>
                  </div>
                  <div className="col-md-3">
                    <p className="text-muted mb-1">Llamada Cliente</p>
                    <h6 className="fw-semibold">{grupo.llamada_cliente}</h6>
                  </div>
                  <div className="col-md-3">
                    <p className="text-muted mb-1">Elegibilidad</p>
                    <h6 className="fw-semibold">{grupo.elegibilidad_carta}</h6>
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-3">
                    <p className="text-muted mb-1">Tomador</p>
                    <h6 className="fw-semibold">{getTomadorNombre(grupo)}</h6>
                  </div>
                  <div className="col-md-3">
                    <p className="text-muted mb-1">Personas en Cobertura</p>
                    <Badge bg="info" pill>{grupo.personas_cobertura || grupo.coberturas?.length || "0"}</Badge>
                  </div>
                  <div className="col-md-3">
                    <p className="text-muted mb-1">Personas en taxes</p>
                    <Badge bg="info" pill>{grupo.personas_taxes || grupo.personas_taxes?.length || "0"}</Badge>
                  </div>
                  <div className="col-md-3">
                    <p className="text-muted mb-1">Ingreso Familiar Anual</p>
                    <Badge bg="secondary" pill>{grupo.ingreso_familiar_anual || grupo.ingreso_familiar_anual?.length || "0"}</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Información de Contacto */}
            {grupo.telefonos && (
              <div className="card shadow-sm mb-4">
                <div className="card-body">
                  <h5 className="card-title text-primary mb-3">Información de Contacto</h5>
                  <div className="row">
                    <div className="col-md-3">
                      <p className="text-muted mb-1">👤 Persona de Contacto</p>
                      <h6>{grupo.persona_contacto || "Sin especificar"}</h6>
                    </div>
                    <div className="col-md-3">
                      <p className="text-muted mb-1">Pertenece al grupo familiar?</p>
                      <Badge bg={grupo.pertenece_grupo_familiar ? "success" : "secondary"} pill>
                        {grupo.pertenece_grupo_familiar ? "Si" : "No"}
                      </Badge>
                    </div>
                    <div className="col-md-3">
                      <p className="text-muted mb-1">📞 Teléfono 1</p>
                      <h6>{grupo.telefonos.telefono_1 || "No especificado"}</h6>
                    </div>
                    <div className="col-md-3">
                      <p className="text-muted mb-1">📞 Teléfono 2</p>
                      <h6>{grupo.telefonos.telefono_2 || "No especificado"}</h6>
                    </div>
                  </div>   
                  <div className="row">
                    <div className="col-md-1 mt-3">
                      <p className="text-muted mb-1">💬 WhatsApp</p>
                      <Badge bg={grupo.telefonos.whatsapp ? "success" : "secondary"} pill>
                        {grupo.telefonos.whatsapp ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <div className="col-md-1 mt-3">
                      <p className="text-muted mb-1">📨 Telegram</p>
                      <Badge bg={grupo.telefonos.telegram ? "success" : "secondary"} pill>
                        {grupo.telefonos.telegram ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <div className="col-md-2 mt-3">
                      <p className="text-muted mb-1">📱 Mensaje SMS</p>
                      <Badge bg={grupo.telefonos.mensaje_sms ? "success" : "secondary"} pill>
                        {grupo.telefonos.mensaje_sms ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-12 mt-3">
                      <p className="text-muted mb-1">📝 Nota</p>
                      <h6>{grupo.nota || "-"}</h6>
                    </div>
                  </div>    
                </div>
              </div>
            )}

            {/* Coberturas con filas expandibles */}
            {grupo?.coberturas?.length > 0 && (
              <div className="card shadow-sm mb-4">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="card-title text-primary mb-0">Coberturas</h5>
                    <Form.Check
                      type="switch"
                      id="mostrarInactivas"
                      label="Mostrar inactivas"
                      checked={mostrarInactivas}
                      onChange={() => setMostrarInactivas(!mostrarInactivas)}
                    />
                  </div>
                  <div className="table-responsive">
                    <Table bordered hover size="sm" className="mb-0">
                      <thead className="table-light">
                        <tr>
                          <th width="40"></th>
                          <th>Numero ID</th>
                          <th>Cliente</th>
                          <th>Parentesco</th>
                          <th>Elegibilidad</th>
                          <th>Compañía</th>
                          <th>Plan</th>
                          <th>Metal</th>
                          <th>Red</th>
                          <th>Pagador</th>
                          <th>Año</th>
                          <th>Precio</th>
                          <th>Activación</th>
                          <th>Cancelación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.coberturas
                          .filter(c => mostrarInactivas || c.activo === true || c.activo === "true" || c.activo === 1)
                          .map((c, index) => {
                            const coberturaId = c.id || c.codigo_poliza || `cobertura-${index}`;
                            const isExpanded = filasExpandidas.has(coberturaId);
                            
                            return (
                              <React.Fragment key={coberturaId}>
                                <tr 
                                  style={c.parentesco?.toUpperCase() === "TOMADOR" ? { backgroundColor: '#fff9db' } : {}}
                                  className="cursor-pointer"
                                >
                                  <td 
                                    onClick={() => toggleFila(coberturaId)}
                                    style={{ cursor: 'pointer', textAlign: 'center' }}
                                    title="Click para expandir/contraer detalles"
                                  >
                                    {isExpanded ? 
                                      <FaChevronDown className="text-primary" /> : 
                                      <FaChevronRight className="text-muted" />
                                    }
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        backgroundColor: grupoColorMap[c.grupo] || '#6c757d',
                                        marginRight: '6px',
                                        verticalAlign: 'middle'
                                      }}
                                      title={`Grupo ${c.grupo || 'N/A'}`}
                                    ></span>
                                    {c.codigo_poliza || "-"}
                                  </td>
                                  <td>
                                    <strong>{c.cliente?.nombre_completo || "-"}</strong>
                                    {c.parentesco?.toUpperCase() === "TOMADOR" && (
                                      <Badge bg="warning" text="dark" className="ms-2">TOMADOR</Badge>
                                    )}
                                  </td>
                                  <td>{c.parentesco || "-"}</td>
                                  <td>{c.elegibilidad || "-"}</td>
                                  <td>{c.compania?.nombre || "-"}</td>
                                  <td>{c.plan || "-"}</td>
                                  <td>{c.metal || "-"}</td>
                                  <td>{c.red || "-"}</td>
                                  <td>{c.nombre_pagador || "-"}</td>
                                  <td>{c.ano_cobertura || "-"}</td>
                                  <td>{c.precio || "-"}</td>
                                  <td>{c.fecha_activacion ? parseDate(c.fecha_activacion) : "-"}</td>
                                  <td>{c.fecha_cancelacion ? parseDate(c.fecha_cancelacion) : "-"}</td>
                                </tr>
                                {renderDetalleExpandido(c, coberturaId)}
                              </React.Fragment>
                            );
                          })}
                      </tbody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {/* Acción final */}
            <div className="text-end">

            <Button 
            variant="outline-primary" 
            className="me-2"
            onClick={() => setShowModal(true)}>
                {driveUrl ? "Editar URL de Drive" : "Agregar URL de Drive"}
              </Button>


              <Button
                variant="outline-primary"
                className="me-2"
                onClick={() => {
                  onHide();
                  window.open(`/grupo-familiar/${grupo.id}/reporte`, '_blank');
                }}
              >
                <FaFileExport className="me-2" />
                Ver Detalles Completos
              </Button>

              <Button
                variant="outline-success"
                className="me-2" 
                onClick={() => {
                  onHide();
                  window.open(`/grupo-familiar/${grupo.id}/historial`, '_blank');
                }}
              >
                <FaFileExport className="me-2" />
                Ver Historial
              </Button>
              <Button
                variant="outline-danger"
                className="me-2" 
                onClick={async () => {
                  let language = "es";
                  try {
                    const { value: lang } = await Swal.fire({
                      title: "Idioma del documento",
                      text: "¿En qué idioma deseas generar la confirmación de datos?",
                      icon: "question",
                      input: "select",
                      inputOptions: { es: "Español", en: "Inglés" },
                      inputPlaceholder: "Selecciona un idioma",
                      showCancelButton: true,
                      confirmButtonText: "Aceptar",
                      cancelButtonText: "Cancelar",
                    });
                    if (!lang) return;
                    language = lang;

                    setConfirmacionLanguage(language);
                    const result = await generarPDFConfirmacion(grupo, false, language);
                    if (result) {
                      setPdfData(result);
                      setShowPDFModal(true);
                    }
                  } catch (error) {
                    console.error("Error al generar PDF:", error);
                    await generarPDFConfirmacion(grupo, true, language);
                  }
                }}
              >
                <FaFilePdf className="me-2" />
                Confirmación de Datos
              </Button>
            </div>
          </div>
        )}
      </Modal.Body>
      {/* Renderiza el modal solo si grupo existe */}
{grupo && (
  <>
    <DriveUrlModal
      show={showModal}
      onHide={() => setShowModal(false)}
      grupoId={grupo.id}
      initialUrl={driveUrl}
      onSave={(newUrl) => setDriveUrl(newUrl)}
    />
    {/* Confirmación: mismo flujo que Autorización - enviar al back y ruta de firma signatures/submissions */}
    {pdfData && (() => {
      const tomador = grupo.coberturas?.find(c => c.parentesco?.toUpperCase() === "TOMADOR");
      return (
        <DocumentoGeneradoModal
          show={showPDFModal}
          onHide={() => {
            setShowPDFModal(false);
            setPdfData(null);
          }}
          pdfBlob={pdfData.blob}
          filename={pdfData.filename}
          documentType="CONFIRMACION"
          documentLanguage={confirmacionLanguage}
          defaultSigner={{
            email: tomador?.cliente?.email || "",
            name: tomador?.cliente?.nombre_completo || "",
          }}
          metadata={{
            cliente_id: tomador?.cliente?.id || tomador?.cliente_id || null,
            grupo_familiar_id: grupo.id || null,
          }}
        />
      );
    })()}
  </>
)}


    </Modal>
  );
};

export default GrupoFamiliarDetalleModal;