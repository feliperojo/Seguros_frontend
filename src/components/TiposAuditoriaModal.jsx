// components/TiposAuditoriaModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Alert, Spinner, Table, Badge } from "react-bootstrap";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import {
  listAuditTypes,
  createAuditType,
  updateAuditType,
  deleteAuditType,
} from "../services/auditoriasService";
import useToast from "../hooks/useToast";

/**
 * Modal para gestionar tipos de auditoría (crear, editar, eliminar)
 * @param {Object} props
 * @param {boolean} props.show - Si el modal está visible
 * @param {Function} props.onClose - Callback para cerrar el modal
 * @param {string} props.targetType - Tipo de objeto a auditar ("coberturas" | "clientes")
 * @param {Function} props.onTypesUpdated - Callback cuando se actualizan los tipos (para refrescar la lista)
 */
const TiposAuditoriaModal = ({ show, onClose, targetType, onTypesUpdated }) => {
  const toast = useToast();

  // Estado de tipos
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estado del formulario
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    codigo: "",
    descripcion: "",
    target_type: targetType || "coberturas",
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState({});

  // Cargar tipos cuando se abre el modal o cambia targetType
  useEffect(() => {
    if (show && targetType) {
      // Asegurar que se muestre la lista al abrir el modal
      setShowForm(false);
      setEditingType(null);
      // Cargar tipos directamente
      loadTypes();
    } else if (!show) {
      // Limpiar datos cuando se cierra el modal
      setTypes([]);
      setError(null);
      setShowForm(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, targetType]);

  // Resetear formulario cuando se abre/cierra el modal o cambia showForm
  useEffect(() => {
    if (!showForm) {
      setFormData({
        nombre: "",
        codigo: "",
        descripcion: "",
        target_type: targetType || "coberturas",
        is_active: true,
      });
      setEditingType(null);
      setFormErrors({});
    }
  }, [showForm, targetType]);

  // Cargar tipos
  const loadTypes = async () => {
    if (!targetType) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await listAuditTypes({
        target_type: targetType,
        // No enviar is_active para obtener todos (activos e inactivos)
      });
      const typesArray = Array.isArray(data) ? data : (data?.data || []);
      setTypes(typesArray);
      console.log("Tipos cargados:", typesArray); // Debug
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || err.message || "Error al cargar tipos de auditoría";
      setError(errorMessage);
      console.error("Error al cargar tipos:", err);
      setTypes([]);
    } finally {
      setLoading(false);
    }
  };

  // Abrir formulario para crear
  const handleCreate = () => {
    setFormData({
      nombre: "",
      codigo: "",
      descripcion: "",
      target_type: targetType || "coberturas",
      is_active: true,
    });
    setEditingType(null);
    setFormErrors({});
    setShowForm(true);
  };

  // Abrir formulario para editar
  const handleEdit = (type) => {
    setFormData({
      nombre: type.nombre || "",
      codigo: type.codigo || "",
      descripcion: type.descripcion || "",
      target_type: type.target_type || targetType,
      is_active: type.is_active !== undefined ? type.is_active : true,
    });
    setEditingType(type);
    setFormErrors({});
    setShowForm(true);
  };

  // Validar formulario
  const validateForm = () => {
    const errors = {};

    if (!formData.nombre?.trim()) {
      errors.nombre = "El nombre es requerido";
    }

    if (!formData.codigo?.trim()) {
      errors.codigo = "El código es requerido";
    }

    if (!formData.target_type) {
      errors.target_type = "El tipo de objeto es requerido";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Guardar tipo (crear o actualizar)
  const handleSave = async () => {
    if (!validateForm()) {
      toast.showWarning("Por favor completa todos los campos requeridos");
      return;
    }

    setSaving(true);
    try {
      if (editingType) {
        // Actualizar
        await updateAuditType(editingType.id, formData);
        toast.showSuccess("Tipo de auditoría actualizado exitosamente");
      } else {
        // Crear
        await createAuditType(formData);
        toast.showSuccess("Tipo de auditoría creado exitosamente");
      }

      // Cerrar formulario
      setShowForm(false);
      
      // Recargar tipos
      await loadTypes();

      // Notificar al padre para que refresque su lista
      if (onTypesUpdated) {
        onTypesUpdated();
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || err.message || "Error al guardar el tipo de auditoría";
      toast.showError(errorMessage);
      console.error("Error al guardar tipo:", err);
    } finally {
      setSaving(false);
    }
  };

  // Eliminar tipo
  const handleDelete = async (type) => {
    if (
      !window.confirm(
        `¿Estás seguro de que deseas eliminar el tipo "${type.nombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      await deleteAuditType(type.id);
      toast.showSuccess("Tipo de auditoría eliminado exitosamente");

      // Recargar tipos
      await loadTypes();

      // Notificar al padre para que refresque su lista
      if (onTypesUpdated) {
        onTypesUpdated();
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || err.message || "Error al eliminar el tipo de auditoría";
      toast.showError(errorMessage);
      console.error("Error al eliminar tipo:", err);
    }
  };

  // Manejar cambio en formulario
  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpiar error del campo cuando se modifica
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <Modal show={show} onHide={onClose} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          Gestionar Tipos de Auditoría - {targetType === "coberturas" ? "Coberturas" : "Clientes"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {showForm ? (
          // Formulario de crear/editar
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5>{editingType ? "Editar Tipo de Auditoría" : "Crear Nuevo Tipo de Auditoría"}</h5>
              <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>

            <Form>
              <Form.Group className="mb-3">
                <Form.Label>
                  Nombre <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => handleFormChange("nombre", e.target.value)}
                  isInvalid={!!formErrors.nombre}
                  placeholder="Ej: Verificación de Datos"
                />
                <Form.Control.Feedback type="invalid">{formErrors.nombre}</Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>
                  Código <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => handleFormChange("codigo", e.target.value)}
                  isInvalid={!!formErrors.codigo}
                  placeholder="Ej: VERIF_DATOS"
                />
                <Form.Control.Feedback type="invalid">{formErrors.codigo}</Form.Control.Feedback>
                <Form.Text className="text-muted">
                  Código único para identificar el tipo de auditoría
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Descripción</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={formData.descripcion}
                  onChange={(e) => handleFormChange("descripcion", e.target.value)}
                  placeholder="Descripción del tipo de auditoría"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Tipo de Objeto</Form.Label>
                <Form.Select
                  value={formData.target_type}
                  onChange={(e) => handleFormChange("target_type", e.target.value)}
                  disabled={!!editingType} // No permitir cambiar target_type al editar
                >
                  <option value="coberturas">Coberturas</option>
                  <option value="clientes">Clientes</option>
                </Form.Select>
                {editingType && (
                  <Form.Text className="text-muted">
                    No se puede cambiar el tipo de objeto al editar
                  </Form.Text>
                )}
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  label="Activo"
                  checked={formData.is_active}
                  onChange={(e) => handleFormChange("is_active", e.target.checked)}
                />
                <Form.Text className="text-muted">
                  Solo los tipos activos aparecerán en el selector al crear auditorías
                </Form.Text>
              </Form.Group>
            </Form>
          </div>
        ) : (
          // Lista de tipos
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5>Tipos Disponibles</h5>
              <Button variant="primary" size="sm" onClick={handleCreate}>
                <FaPlus className="me-1" />
                Crear Tipo
              </Button>
            </div>

            {error && (
              <Alert variant="danger" dismissible onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </Spinner>
                <p className="mt-2 text-muted">Cargando tipos...</p>
              </div>
            ) : types.length === 0 ? (
              <Alert variant="info">
                No hay tipos de auditoría configurados para {targetType === "coberturas" ? "coberturas" : "clientes"}.
                Crea uno nuevo para comenzar.
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.map((type) => (
                      <tr key={type.id}>
                        <td>{type.nombre}</td>
                        <td>{type.codigo || "-"}</td>
                        <td>{type.descripcion || "-"}</td>
                        <td>
                          {type.is_active ? (
                            <Badge bg="success">Activo</Badge>
                          ) : (
                            <Badge bg="secondary">Inactivo</Badge>
                          )}
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEdit(type)}
                              title="Editar"
                            >
                              <FaEdit />
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDelete(type)}
                              title="Eliminar"
                            >
                              <FaTrash />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {showForm ? (
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Guardando...
                </>
              ) : editingType ? (
                "Actualizar"
              ) : (
                "Crear"
              )}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default TiposAuditoriaModal;

