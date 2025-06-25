import React, { useEffect, useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import apiRequest from '../services/api';

export default function ObservacionesModal({ show, onHide, documentoId }) {
  const [observaciones, setObservaciones] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState('');

  useEffect(() => {
    if (show && documentoId) {
      fetchObservaciones();
    }
  }, [show, documentoId]); // Escucha también cuando se abre el modal

  const fetchObservaciones = async () => {

    try {
      console.log('Documento ID:', documentoId);
      const data = await apiRequest(`Observaciones/documentos/${documentoId}`, 'get');
      console.log('Observaciones:', data);
      setObservaciones(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error al cargar las observaciones:', err.message);
      setObservaciones([]);
    }
  };

  const agregarComentario = async () => {
    try {
      await apiRequest(`Observaciones/documentos/${documentoId}`, 'POST', {
       
        comentario: nuevoComentario,
      });
      setNuevoComentario('');
      fetchObservaciones(); // Refresca la lista
    } catch (err) {
      alert('Error al agregar comentario');
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Observaciones</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div>
          <h6>Historial de Comentarios</h6>
          <ul className="list-group">
            {observaciones.length > 0 ? (
              observaciones.map((obs) => (
                <li key={obs.id} className="list-group-item">
                  <strong>{obs.usuario?.name}</strong>{' '}
                  <small>{new Date(obs.created_at).toLocaleString()}</small>
                  <p>{obs.comentario}</p>
                </li>
              ))
            ) : (
              <li className="list-group-item">No hay observaciones aún.</li>
            )}
          </ul>
          <Form.Group className="mt-3">
            <Form.Control
              as="textarea"
              rows={3}
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
              placeholder="Agregar un nuevo comentario..."
            />
          </Form.Group>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cerrar</Button>
        <Button variant="primary" onClick={agregarComentario} disabled={!nuevoComentario.trim()}>
          Agregar Comentario
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
         