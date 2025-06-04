import React, { useEffect, useState } from 'react';
import { Card, Table, Row, Col } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import apiRequest from '../../services/api';

const formatDate = (datetime) => {
  return new Date(datetime).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
};

const formatActionLabel = (action) => {
  const labels = {
    update: 'Actualización del grupo',
    miembro_agregado: 'Nuevo miembro agregado',
    ingreso_actualizado: 'Cambio de ingreso familiar',
    retiro_cobertura: 'Retiro de cobertura',
    retiro_tax: 'Retiro de taxes',
    cancelacion: 'Cancelación de grupo',
    direccion_actualizada: 'Actualización de dirección',
    estado_actualizado: 'Cambio de estado',
    documentos_plazo_extendido: 'Extensión de plazo de documentos'
  };
  return labels[action] || action;
};

const GrupoFamiliarHistorial = () => {
  const { id } = useParams();
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    const fetchHistorial = async () => {
      try {
        const response = await apiRequest(`historial/GrupoFamiliar/${id}`, 'GET');
        if (response.data) {
          setHistorial(response.data);
        }
      } catch (error) {
        console.error('Error al obtener el historial:', error);
      }
    };

    fetchHistorial();
  }, [id]);

  return (
    <div className="container mt-4">
      <h3 className="mb-4 text-primary fw-bold">Historial del Grupo Familiar #{id}</h3>

      {historial.length === 0 ? (
        <p>No hay registros disponibles.</p>
      ) : (
        historial.map((entry) => {
          const estado = entry.estado_nuevo || {};
          const coberturas = (estado.coberturas || []).filter(c => c.activo);

          return (
            <Card className="mb-4 shadow-sm" key={entry.id}>
              <Card.Header className="bg-light d-flex justify-content-between">
                <strong>{formatActionLabel(entry.accion)}</strong>
                <span className="text-muted">
                  {formatDate(entry.created_at)} | {entry.usuario}
                </span>
              </Card.Header>

              <Card.Body>
                <h5 className="mb-3">Versión del Grupo Familiar</h5>
                <Row>
                  <Col md={6}>
                    <p><strong>ID:</strong> {estado.id}</p>
                    <p><strong>Ingreso Familiar Anual:</strong> ${estado.ingreso_familiar_anual}</p>
                    <p><strong>Personas en Taxes:</strong> {estado.personas_taxes}</p>
                    <p><strong>Personas en Cobertura:</strong> {estado.personas_cobertura}</p>
                    <p><strong>Nota:</strong> {estado.nota || '-'}</p>
                  </Col>
                  <Col md={6}>
                    <p><strong>Persona Contacto:</strong> {estado.persona_contacto}</p>
                    <p><strong>Relación:</strong> {estado.relacion}</p>
                    <p><strong>Captado Por:</strong> {estado.captado_por}</p>
                    <p><strong>Responsable:</strong> {estado.responsable}</p>
                    <p><strong>Teléfonos:</strong> {estado.telefono_1} / {estado.telefono_2}</p>
                  </Col>
                </Row>

                <h5 className="mt-4">Coberturas Activas en ese momento</h5>
                {coberturas.length > 0 ? (
                  <Table striped bordered hover responsive size="sm" className="mt-2">
                    <thead>
                      <tr className="text-center">
                        <th>Cliente</th>
                        <th>Parentesco</th>
                        <th>Plan</th>
                        <th>Red</th>
                        <th>Metal</th>
                        <th>Precio</th>
                        <th>Compañía</th>
                        <th>Fecha Activación</th>
                        <th>Fecha Cancelacion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coberturas.map((cob, idx) => (
                        <tr key={idx}>
                          <td>{cob.cliente?.nombre_completo || cob.cliente_id}</td>
                          <td>{cob.parentesco}</td>
                          <td>{cob.plan}</td>
                          <td>{cob.red}</td>
                          <td>{cob.metal}</td>
                          <td>${cob.precio}</td>
                          <td>{cob.compania?.nombre || cob.compania_id}</td>
                          <td>{cob.fecha_activacion}</td>
                          <td>{cob.fecha_cancelacion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <p className="text-muted">No había coberturas activas en ese momento.</p>
                )}
              </Card.Body>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default GrupoFamiliarHistorial;
