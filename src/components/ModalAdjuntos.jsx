import React, { useEffect, useState } from 'react';
import { Modal, Button, Table, Spinner } from 'react-bootstrap';
import { FaDownload, FaUpload, FaEye, FaTrash } from 'react-icons/fa';
import apiRequest from '../services/api';
import Swal from 'sweetalert2';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const getAuthToken = () => {
  return localStorage.getItem("auth_token");
};

export default function ModalAdjuntos({ show, onHide, documentoId }) {
  const [adjuntos, setAdjuntos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [archivo, setArchivo] = useState(null);

  useEffect(() => {
    if (show && documentoId) {
      fetchAdjuntos();
    }
  }, [show, documentoId]);

  const fetchAdjuntos = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`adjuntos/documentos/${documentoId}`);
      setAdjuntos(data);
    } catch (error) {
      console.error('Error al obtener adjuntos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivo(file);
      uploadFile(file);
    }
  };

  const uploadFile = async (file) => {
    setSubiendo(true);
    const token = getAuthToken();

    if (!token) {
      alert("Token no encontrado. Por favor inicia sesión.");
      setSubiendo(false);
      return;
    }

    const formData = new FormData();
    formData.append('archivo', file);

    try {
      const response = await fetch(`${API_BASE_URL}/adjuntos/documentos/${documentoId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al subir archivo');
      }

      await fetchAdjuntos();
      setArchivo(null);
    } catch (err) {
      console.error("Error al subir archivo:", err);
      alert(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const handleDownload = async (id) => {
    try {
      const res = await apiRequest(`adjuntos/documentos/${id}/descargar`);
      window.open(res.url, '_blank');
    } catch (error) {
      alert('Error al descargar archivo');
    }
  };

  const handleEliminar = async (id) => {
    const result = await Swal.fire({
      title: '¿Eliminar archivo?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
  
    if (result.isConfirmed) {
      try {
        await apiRequest(`adjuntos/documentos/${id}`, 'DELETE');
        await fetchAdjuntos(); // Recargar lista
        Swal.fire('¡Eliminado!', 'El archivo ha sido eliminado.', 'success');
      } catch (error) {
        Swal.fire('Error', 'No se pudo eliminar el archivo.', 'error');
      }
    }
  };
  
  
  

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Archivos Adjuntos</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <label className="btn btn-outline-primary">
            <FaUpload className="me-2" />
            Subir archivo
            <input
              type="file"
              hidden
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={subiendo}
            />
          </label>
          {subiendo && <Spinner animation="border" size="sm" className="ms-2" />}
        </div>

        {loading ? (
          <div className="text-center"><Spinner animation="border" /></div>
        ) : adjuntos.length === 0 ? (
          <p>No hay archivos adjuntos.</p>
        ) : (
          <Table striped bordered size="sm">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Tipo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {adjuntos.map((adj) => (
                <tr key={adj.id}>
                  <td>{adj.nombre_original}</td>
                  <td>{adj.tipo_mime}</td>
                  <td className="d-flex gap-2">
                        <Button variant="success" size="sm" onClick={() => handleDownload(adj.id)} title="Descargar">
                            <FaDownload />
                        </Button>

                        <a
                            href={adj.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline-secondary btn-sm"
                            title="Ver documento"
                        >
                            <FaEye />
                        </a>

                        <Button
                            variant="danger"
                            size="sm"
                            className="me-1"
                            onClick={() => handleEliminar(adj.id)}
                            >
                            <FaTrash />
                            </Button>

                        </td>

                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  );
}
