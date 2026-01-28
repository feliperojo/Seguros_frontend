// components/RequerimientosCoberturaModal.jsx
import React, { useEffect, useState } from "react";
import { Modal, Button, Table, Badge, Alert, Spinner } from "react-bootstrap";
import { getRequerimientosByCobertura } from "../services/requerimientosService";

// Mapeo de estados a colores de Bootstrap
const estadosBadge = {
  Pendiente: "warning",
  Enviado: "info",
  Aprobado: "success",
  Rechazado: "danger",
  Insuficiente: "danger",
  Procesando: "primary",
  Completado: "success",
  Cancelado: "danger",
};

/**
 * Modal para mostrar los requerimientos de una cobertura específica
 * @param {Object} props
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {Function} props.onClose - Callback para cerrar el modal
 * @param {Object} props.cobertura - Objeto con información de la cobertura (debe tener cobertura_id)
 */
const RequerimientosCoberturaModal = ({ isOpen, onClose, cobertura }) => {
  const [requerimientos, setRequerimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let abortController = null;

    if (isOpen && cobertura?.cobertura_id) {
      abortController = new AbortController();
      fetchRequerimientos(abortController);
    } else {
      // Limpiar estado al cerrar
      setRequerimientos([]);
      setError(null);
    }

    // Cleanup: abortar si el componente se desmonta o cambian las dependencias
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [isOpen, cobertura?.cobertura_id]);

  const fetchRequerimientos = async (abortController) => {
    setLoading(true);
    setError(null);

    try {
      const response = await getRequerimientosByCobertura(
        cobertura.cobertura_id,
        {},
        abortController.signal
      );

      // Verificar si la respuesta tiene estructura { data: [...] } o es directamente un array
      const data = Array.isArray(response) ? response : response?.data || [];
      setRequerimientos(data);
    } catch (err) {
      if (err.message !== "Petición cancelada") {
        setError(err.message || "Error al cargar requerimientos");
        console.error("Error al cargar requerimientos:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Modal show={isOpen} onHide={onClose} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          Requerimientos - {cobertura?.codigo_poliza || cobertura?.cobertura_id}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Cargando...</span>
            </Spinner>
            <p className="mt-2 text-muted">Cargando requerimientos...</p>
          </div>
        ) : error ? (
          <Alert variant="danger">
            <Alert.Heading>Error</Alert.Heading>
            <p>{error}</p>
          </Alert>
        ) : requerimientos.length === 0 ? (
          <Alert variant="info">
            No se encontraron requerimientos para esta cobertura.
          </Alert>
        ) : (
          <div className="table-responsive">
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Estado</th>
                  <th>Fecha Creación</th>
                  <th>Última Actualización</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {requerimientos.map((req) => (
                  <tr key={req.id}>
                    <td>
                      {req.documento_nombre || req.documento_requerido || `#${req.id}`}
                    </td>
                    <td>
                      <Badge bg={estadosBadge[req.estado] || "secondary"}>
                        {req.estado || "Sin estado"}
                      </Badge>
                    </td>
                    <td>{formatDate(req.created_at)}</td>
                    <td>{formatDate(req.updated_at)}</td>
                    <td>
                      {req.observacion || req.observaciones || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RequerimientosCoberturaModal;

