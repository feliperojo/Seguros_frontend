import React, { useState } from "react";
import { Modal, Button, Table, Form, Badge } from "react-bootstrap";
import { FaFileExport } from "react-icons/fa";

const grupoColorMap = {
  G1: "#0d6efd",   // Azul
  G2: "#198754",   // Verde
  G3: "#ffc107"    // Amarillo
};


const GrupoFamiliarDetalleModal = ({ show, onHide, grupo, getTomadorNombre }) => {
  const [mostrarInactivas, setMostrarInactivas] = useState(false);

  const isTomador = (parentesco) => {
    return parentesco && parentesco.toUpperCase() === "TOMADOR";
  };

  const renderCoberturas = () => {
    if (!grupo?.coberturas?.length) return null;

    const coberturasFiltradas = grupo.coberturas.filter(c =>
      mostrarInactivas ? true : c.activo === true || c.activo === "true" || c.activo === 1
    );

    return (
      <>
        <h5 className="border-bottom pb-2 text-primary">Coberturas</h5>
        <Form.Check
          type="checkbox"
          label="Mostrar coberturas inactivas"
          checked={mostrarInactivas}
          onChange={() => setMostrarInactivas(!mostrarInactivas)}
          className="mb-3"
        />
        <div className="table-responsive">
          <Table bordered hover className="mt-3">
            <thead className="table-light">
              <tr>
                <th>Código Póliza</th>
                <th>Cliente</th>
                <th>Parentesco</th>
                <th>Elegibilidad</th>
                <th>Compañia</th>
                <th>Plan</th>
                <th>Metal</th>
                <th>Red</th>
                <th>Pagador</th>
                <th>Año Cobertura</th>
                <th>Precio $</th>
                <th>Fecha Activación</th>
                <th>Fecha cancelación</th>
              </tr>
            </thead>
            <tbody>
              {coberturasFiltradas.map((c, index) => (
                <tr key={c.id || index} style={isTomador(c.parentesco) ? { backgroundColor: '#fff3cd' } : {}}>
                  <td>{c.codigo_poliza || "-"}</td>
                  <td>
                    <strong>{c.cliente?.nombre_completo || "-"}</strong>
                    {isTomador(c.parentesco) && (
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
                  <td>{c.fecha_activacion ? new Date(c.fecha_activacion).toLocaleDateString('es-CO') : "-"}</td>
                  <td>{c.fecha_cancelacion ? new Date(c.fecha_cancelacion).toLocaleDateString('es-CO') : "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </>
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
            <div className="col-md-3">
              <p className="text-muted mb-1">Agente Responsable</p>
              <h6 className="fw-semibold">{grupo.responsable}</h6>
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

      {/* Coberturas */}
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
                    <th>Código Póliza</th>
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
                    .map((c, index) => (
                      <tr key={c.id || index} style={c.parentesco?.toUpperCase() === "TOMADOR" ? { backgroundColor: '#fff9db' } : {}}>
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
                        <td>{c.fecha_activacion ? new Date(c.fecha_activacion).toLocaleDateString('es-CO') : "-"}</td>
                        <td>{c.fecha_cancelacion ? new Date(c.fecha_cancelacion).toLocaleDateString('es-CO') : "-"}</td>
                      </tr>
                    ))}
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
    className="me-2" // Margen derecho para separación
    onClick={() => {
      onHide();
      window.open(`/grupo-familiar/${grupo.id}/reporte`, '_blank');
    }}
  >
    <FaFileExport className="me-2" />
    Ver Detalles Completos
  </Button>

  <Button
    variant="outline-success" // Color diferente
    onClick={() => {
      onHide();
      window.open(`/grupo-familiar/${grupo.id}/historial`, '_blank');
    }}
  >
    <FaFileExport className="me-2" />
    Ver Historial
  </Button>
</div>

    </div>
  )}
</Modal.Body>


    </Modal>
  );
};

export default GrupoFamiliarDetalleModal;
