// components/RequerimientosCoberturaModal.jsx
import React, { useEffect, useState } from "react";
import { Modal, Button, Table, Badge, Alert, Spinner, Form } from "react-bootstrap";
import { getRequerimientosByCobertura } from "../services/requerimientosService";
import apiRequest from "../services/api";
import useToast from "../hooks/useToast";

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

// Opciones de estados disponibles
const estadosOptions = [
  { value: "Pendiente", label: "Pendiente" },
  { value: "Enviado", label: "Enviado" },
  { value: "Aprobado", label: "Aprobado" },
  { value: "Rechazado", label: "Rechazado" },
  { value: "Insuficiente", label: "Insuficiente" },
  { value: "Procesando", label: "Procesando" },
  { value: "Completado", label: "Completado" },
  { value: "Cancelado", label: "Cancelado" },
];

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
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [updating, setUpdating] = useState(false);
  const toast = useToast();

  const fetchRequerimientos = async (abortController = null) => {
    if (!cobertura?.cobertura_id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getRequerimientosByCobertura(
        cobertura.cobertura_id,
        {},
        abortController?.signal || null
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

  useEffect(() => {
    let abortController = null;

    if (isOpen && cobertura?.cobertura_id) {
      abortController = new AbortController();
      fetchRequerimientos(abortController);
    } else {
      // Limpiar estado al cerrar
      setRequerimientos([]);
      setError(null);
      setEditingId(null);
      setEditingData({});
    }

    // Cleanup: abortar si el componente se desmonta o cambian las dependencias
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cobertura?.cobertura_id]);

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

  const formatDateInput = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch {
      return "";
    }
  };

  const handleEdit = (req) => {
    setEditingId(req.id);
    setEditingData({
      estado: req.estado || "Pendiente",
      fecha_vencimiento: req.fecha_vencimiento || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData({});
  };

  const handleChange = (field, value) => {
    setEditingData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleUpdate = async (req) => {
    if (!editingData.estado) {
      toast.showWarning("El estado es obligatorio");
      return;
    }

    setUpdating(true);
    try {
      const updatePayload = {
        estado: editingData.estado,
      };

      // Solo incluir fecha_vencimiento si tiene valor
      if (editingData.fecha_vencimiento) {
        updatePayload.fecha_vencimiento = editingData.fecha_vencimiento;
      }

      await apiRequest(
        `coberturas/${req.cobertura_id || cobertura?.cobertura_id}/documentos/${req.id}`,
        "PUT",
        updatePayload
      );

      toast.showSuccess("Requerimiento actualizado correctamente");
      setEditingId(null);
      setEditingData({});

      // Recargar los requerimientos sin mostrar loading (ya está en updating)
      const abortController = new AbortController();
      try {
        const response = await getRequerimientosByCobertura(
          req.cobertura_id || cobertura?.cobertura_id,
          {},
          abortController.signal
        );
        const data = Array.isArray(response) ? response : response?.data || [];
        setRequerimientos(data);
      } catch (err) {
        if (err.message !== "Petición cancelada") {
          console.error("Error al recargar requerimientos:", err);
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Error al actualizar el requerimiento";
      toast.showError(errorMessage);
      console.error("Error al actualizar requerimiento:", err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <style>{`
        .modal-requerimientos-large .modal-dialog {
          max-width: 95vw;
          width: 95vw;
          margin: 1rem auto;
        }
        @media (min-width: 1200px) {
          .modal-requerimientos-large .modal-dialog {
            max-width: 90vw;
            width: 90vw;
          }
        }
        .modal-requerimientos-large .modal-content {
          height: auto;
          max-height: 95vh;
        }
        .modal-requerimientos-large .modal-body {
          max-height: calc(95vh - 120px);
          overflow-y: auto;
          padding: 1rem;
        }
        .modal-requerimientos-large .table {
          font-size: 0.85rem;
          width: 100%;
          table-layout: fixed;
        }
        .modal-requerimientos-large .table th {
          padding: 0.5rem 0.4rem;
          vertical-align: middle;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 600;
          background-color: #f8f9fa;
        }
        .modal-requerimientos-large .table td {
          padding: 0.5rem 0.4rem;
          vertical-align: middle;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
      `}</style>
      <Modal 
        show={isOpen} 
        onHide={onClose} 
        size="xl" 
        backdrop="static"
        dialogClassName="modal-requerimientos-large"
      >
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
          <div className="table-responsive" style={{ overflowX: "visible", width: "100%" }}>
            <Table striped bordered hover style={{ marginBottom: 0, width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: "14%", minWidth: "100px" }}>Documento</th>
                  <th style={{ width: "11%", minWidth: "90px" }}>Estado</th>
                  <th style={{ width: "13%", minWidth: "110px" }}>Fecha Venc.</th>
                  <th style={{ width: "12%", minWidth: "100px" }}>Fecha Creación</th>
                  <th style={{ width: "13%", minWidth: "110px" }}>Últ. Actualización</th>
                  <th style={{ width: "22%", minWidth: "150px" }}>Observación</th>
                  <th style={{ width: "15%", minWidth: "120px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {requerimientos.map((req) => (
                  <tr key={req.id}>
                    <td style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>
                      <span title={req.documento_nombre || req.documento_requerido || `#${req.id}`}>
                        {req.documento_nombre || req.documento_requerido || `#${req.id}`}
                      </span>
                    </td>
                    <td>
                      {editingId === req.id ? (
                        <Form.Select
                          size="sm"
                          value={editingData.estado || ""}
                          onChange={(e) => handleChange("estado", e.target.value)}
                          disabled={updating}
                        >
                          {estadosOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Form.Select>
                      ) : (
                        <Badge bg={estadosBadge[req.estado] || "secondary"}>
                          {req.estado || "Sin estado"}
                        </Badge>
                      )}
                    </td>
                    <td>
                      {editingId === req.id ? (
                        <Form.Control
                          type="date"
                          size="sm"
                          value={formatDateInput(editingData.fecha_vencimiento)}
                          onChange={(e) => handleChange("fecha_vencimiento", e.target.value)}
                          disabled={updating}
                        />
                      ) : (
                        formatDate(req.fecha_vencimiento)
                      )}
                    </td>
                    <td>{formatDate(req.created_at)}</td>
                    <td>{formatDate(req.updated_at)}</td>
                    <td style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>
                      <span 
                        title={req.observacion || req.observaciones || "-"}
                        style={{ 
                          display: "block",
                          maxHeight: "3em",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {req.observacion || req.observaciones || "-"}
                      </span>
                    </td>
                    <td>
                      {editingId === req.id ? (
                        <div className="d-flex gap-1">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleUpdate(req)}
                            disabled={updating}
                          >
                            {updating ? (
                              <Spinner animation="border" size="sm" />
                            ) : (
                              "Guardar"
                            )}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={updating}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleEdit(req)}
                        >
                          Editar
                        </Button>
                      )}
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
    </>
  );
};

export default RequerimientosCoberturaModal;

