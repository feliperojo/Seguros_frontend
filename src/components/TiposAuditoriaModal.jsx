// components/TiposAuditoriaModal.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Modal, Button, Form, Alert, Spinner, Table, Badge } from "react-bootstrap";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import {
  listAuditTypes,
  getAuditType,
  createAuditType,
  updateAuditType,
  deleteAuditType,
} from "../services/auditoriasService";
import useToast from "../hooks/useToast";

/** Valores permitidos para filtros_cobertura.estado_cobertura (coinciden con BD). */
const ESTADO_COBERTURA_OPTIONS = [
  { uiKey: "estado_si", apiValue: "si", label: "Si" },
  { uiKey: "estado_no", apiValue: "no", label: "No" },
  { uiKey: "estado_medicare", apiValue: "medicare", label: "Medicare" },
  { uiKey: "estado_medicai", apiValue: "medicai", label: "Medicai" },
];

const emptyFiltrosCoberturaUi = () => ({
  precio_gt_zero: false,
  use_precio_min: false,
  precio_min: "",
  activo: false,
  vigente: false,
  sin_cancelacion: false,
  estado_si: false,
  estado_no: false,
  estado_medicare: false,
  estado_medicai: false,
});

const filtrosCoberturaFromApi = (raw) => {
  const u = emptyFiltrosCoberturaUi();
  if (!raw || typeof raw !== "object") return u;
  u.precio_gt_zero = !!raw.precio_gt_zero;
  u.use_precio_min = raw.precio_min != null && raw.precio_min !== "";
  u.precio_min = raw.precio_min != null && raw.precio_min !== "" ? String(raw.precio_min) : "";
  u.activo = !!raw.activo;
  u.vigente = !!raw.vigente;
  u.sin_cancelacion = !!raw.sin_cancelacion;
  const allowedEstado = new Set(ESTADO_COBERTURA_OPTIONS.map((o) => o.apiValue));
  const estadoArr = Array.isArray(raw.estado_cobertura)
    ? raw.estado_cobertura
        .map((x) => String(x).toLowerCase().trim())
        .filter((x) => allowedEstado.has(x))
    : [];
  ESTADO_COBERTURA_OPTIONS.forEach((o) => {
    u[o.uiKey] = estadoArr.includes(o.apiValue);
  });
  return u;
};

/**
 * Solo claves activadas por el usuario. null = sin filtros extra (servidor).
 */
const buildFiltrosCoberturaPayload = (ui, targetType) => {
  if (targetType !== "coberturas") return null;
  const o = {};
  if (ui.precio_gt_zero) o.precio_gt_zero = true;
  if (ui.use_precio_min) {
    const n = parseFloat(String(ui.precio_min).replace(",", "."));
    if (!Number.isNaN(n)) o.precio_min = n;
  }
  if (ui.activo) o.activo = true;
  if (ui.vigente) o.vigente = true;
  if (ui.sin_cancelacion) o.sin_cancelacion = true;
  const ec = ESTADO_COBERTURA_OPTIONS.filter((x) => ui[x.uiKey]).map((x) => x.apiValue);
  if (ec.length) o.estado_cobertura = ec;
  return Object.keys(o).length ? o : null;
};

const hasFiltrosCobertura = (t) => {
  const f = t?.filtros_cobertura;
  return f && typeof f === "object" && Object.keys(f).length > 0;
};

const mapLaravel422Errors = (errors) => {
  const flat = {};
  if (!errors || typeof errors !== "object") return flat;
  Object.entries(errors).forEach(([key, val]) => {
    flat[key] = Array.isArray(val) ? val[0] : String(val);
  });
  return flat;
};

/**
 * Modal para gestionar tipos de auditoría (crear, editar, eliminar)
 */
const TiposAuditoriaModal = ({ show, onClose, targetType, onTypesUpdated }) => {
  const toast = useToast();

  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [formData, setFormData] = useState({
    nombre: "",
    codigo: "",
    descripcion: "",
    target_type: targetType || "coberturas",
    is_active: true,
  });
  const [filtrosCoberturaUi, setFiltrosCoberturaUi] = useState(emptyFiltrosCoberturaUi());
  const [formErrors, setFormErrors] = useState({});

  const updateFiltrosUi = useCallback((patch) => {
    setFiltrosCoberturaUi((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    if (show && targetType) {
      setShowForm(false);
      setEditingType(null);
      loadTypes();
    } else if (!show) {
      setTypes([]);
      setError(null);
      setShowForm(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, targetType]);

  useEffect(() => {
    if (!showForm) {
      setFormData({
        nombre: "",
        codigo: "",
        descripcion: "",
        target_type: targetType || "coberturas",
        is_active: true,
      });
      setFiltrosCoberturaUi(emptyFiltrosCoberturaUi());
      setEditingType(null);
      setFormErrors({});
      setLoadingDetail(false);
    }
  }, [showForm, targetType]);

  const loadTypes = async () => {
    if (!targetType) return;

    setLoading(true);
    setError(null);
    try {
      const data = await listAuditTypes({
        target_type: targetType,
      });
      const typesArray = Array.isArray(data) ? data : data?.data || [];
      setTypes(typesArray);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || err.message || "Error al cargar tipos de auditoría";
      setError(errorMessage);
      setTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      nombre: "",
      codigo: "",
      descripcion: "",
      target_type: targetType || "coberturas",
      is_active: true,
    });
    setFiltrosCoberturaUi(emptyFiltrosCoberturaUi());
    setEditingType(null);
    setFormErrors({});
    setLoadingDetail(false);
    setShowForm(true);
  };

  const handleEdit = async (type) => {
    setEditingType(type);
    setFormErrors({});
    setShowForm(true);
    setLoadingDetail(true);
    try {
      const row = await getAuditType(type.id);
      setFormData({
        nombre: row.nombre || "",
        codigo: row.codigo || "",
        descripcion: row.descripcion || "",
        target_type: row.target_type || targetType,
        is_active: row.is_active !== undefined ? row.is_active : true,
      });
      setFiltrosCoberturaUi(filtrosCoberturaFromApi(row.filtros_cobertura));
    } catch (err) {
      console.error("Detalle tipo auditoría:", err);
      setFormData({
        nombre: type.nombre || "",
        codigo: type.codigo || "",
        descripcion: type.descripcion || "",
        target_type: type.target_type || targetType,
        is_active: type.is_active !== undefined ? type.is_active : true,
      });
      setFiltrosCoberturaUi(filtrosCoberturaFromApi(type.filtros_cobertura));
      toast.showWarning(
        err.response?.data?.message ||
          "No se pudo cargar el detalle del tipo; se usan los datos de la lista."
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.nombre?.trim()) errors.nombre = "El nombre es requerido";
    if (!formData.codigo?.trim()) errors.codigo = "El código es requerido";
    if (!formData.target_type) errors.target_type = "El tipo de objeto es requerido";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.showWarning("Por favor completa todos los campos requeridos");
      return;
    }

    const filtrosPayload = buildFiltrosCoberturaPayload(filtrosCoberturaUi, formData.target_type);
    const payload = {
      nombre: formData.nombre.trim(),
      codigo: formData.codigo.trim(),
      descripcion: formData.descripcion?.trim() || "",
      target_type: formData.target_type,
      is_active: !!formData.is_active,
      filtros_cobertura: filtrosPayload,
    };

    setSaving(true);
    setFormErrors({});
    try {
      if (editingType) {
        await updateAuditType(editingType.id, payload);
        toast.showSuccess("Tipo de auditoría actualizado exitosamente");
      } else {
        await createAuditType(payload);
        toast.showSuccess("Tipo de auditoría creado exitosamente");
      }

      setShowForm(false);
      await loadTypes();
      if (onTypesUpdated) onTypesUpdated();
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (status === 422 && data?.errors) {
        setFormErrors(mapLaravel422Errors(data.errors));
        toast.showWarning(data.message || "Revisa los datos del formulario.");
      } else {
        const errorMessage =
          data?.message || err.message || "Error al guardar el tipo de auditoría";
        toast.showError(errorMessage);
      }
      console.error("Error al guardar tipo:", err);
    } finally {
      setSaving(false);
    }
  };

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
      await loadTypes();
      if (onTypesUpdated) onTypesUpdated();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || err.message || "Error al eliminar el tipo de auditoría";
      toast.showError(errorMessage);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "target_type" && value === "clientes") {
        setFiltrosCoberturaUi(emptyFiltrosCoberturaUi());
      }
      return next;
    });
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const filtrosSectionVisible = formData.target_type === "coberturas";

  return (
    <Modal show={show} onHide={onClose} size="xl" backdrop="static" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          Gestionar Tipos de Auditoría — {targetType === "coberturas" ? "Coberturas" : "Clientes"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {showForm ? (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">{editingType ? "Editar tipo de auditoría" : "Nuevo tipo de auditoría"}</h5>
              <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>

            {loadingDetail ? (
              <div className="text-center py-5">
                <Spinner animation="border" size="sm" className="me-2" />
                <span className="text-muted">Cargando definición del tipo…</span>
              </div>
            ) : (
              <Form noValidate>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Nombre <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => handleFormChange("nombre", e.target.value)}
                    isInvalid={!!formErrors.nombre}
                    placeholder="Ej: Verificación de datos"
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
                  <Form.Text className="text-muted">Código único para identificar el tipo</Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Descripción</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={formData.descripcion}
                    onChange={(e) => handleFormChange("descripcion", e.target.value)}
                    placeholder="Descripción del tipo de auditoría"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Tipo de objeto</Form.Label>
                  <Form.Select
                    value={formData.target_type}
                    onChange={(e) => handleFormChange("target_type", e.target.value)}
                    disabled={!!editingType}
                  >
                    <option value="coberturas">Coberturas</option>
                    <option value="clientes">Clientes</option>
                  </Form.Select>
                  {editingType && (
                    <Form.Text className="text-muted">No se puede cambiar el tipo de objeto al editar.</Form.Text>
                  )}
                  {formErrors.target_type && (
                    <div className="text-danger small mt-1">{formErrors.target_type}</div>
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
                    Solo los tipos activos aparecen al crear auditorías.
                  </Form.Text>
                </Form.Group>

                {filtrosSectionVisible ? (
                  <>
                    <hr className="my-4" />
                    <h6 className="fw-semibold mb-3">Filtros del universo auditado (opcional)</h6>
                    <p className="text-muted small mb-3">
                      Se aplican al generar el run: solo entran coberturas que cumplan estas reglas, además del
                      listado base. Deja todo sin marcar para no añadir filtros extra (
                      <code className="small">filtros_cobertura: null</code>).
                    </p>

                    {formErrors.filtros_cobertura && (
                      <Alert variant="danger" className="py-2 small">
                        {formErrors.filtros_cobertura}
                      </Alert>
                    )}

                    <div className="border rounded-3 p-3 bg-light bg-opacity-50">
                      <Form.Check
                        className="mb-2"
                        type="checkbox"
                        id="fc-precio-gt-zero"
                        label="Solo coberturas con precio &gt; 0"
                        checked={filtrosCoberturaUi.precio_gt_zero}
                        onChange={(e) => updateFiltrosUi({ precio_gt_zero: e.target.checked })}
                      />
                      <div className="ms-4 mb-3">
                        <Form.Check
                          type="checkbox"
                          id="fc-use-precio-min"
                          label="Precio mínimo (≥)"
                          checked={filtrosCoberturaUi.use_precio_min}
                          onChange={(e) => updateFiltrosUi({ use_precio_min: e.target.checked })}
                        />
                        <Form.Control
                          type="number"
                          step="any"
                          min={0}
                          size="sm"
                          className="mt-1"
                          style={{ maxWidth: 200 }}
                          disabled={!filtrosCoberturaUi.use_precio_min}
                          value={filtrosCoberturaUi.precio_min}
                          onChange={(e) => updateFiltrosUi({ precio_min: e.target.value })}
                          isInvalid={!!formErrors["filtros_cobertura.precio_min"]}
                        />
                        <Form.Control.Feedback type="invalid">
                          {formErrors["filtros_cobertura.precio_min"]}
                        </Form.Control.Feedback>
                      </div>

                      <Form.Check
                        className="mb-2"
                        type="checkbox"
                        id="fc-activo"
                        label="Solo activas (activo)"
                        checked={filtrosCoberturaUi.activo}
                        onChange={(e) => updateFiltrosUi({ activo: e.target.checked })}
                      />
                      <Form.Check
                        className="mb-2"
                        type="checkbox"
                        id="fc-vigente"
                        label="Solo vigentes"
                        checked={filtrosCoberturaUi.vigente}
                        onChange={(e) => updateFiltrosUi({ vigente: e.target.checked })}
                      />
                      <Form.Check
                        className="mb-3"
                        type="checkbox"
                        id="fc-sin-cancel"
                        label="Sin fecha de cancelación"
                        checked={filtrosCoberturaUi.sin_cancelacion}
                        onChange={(e) => updateFiltrosUi({ sin_cancelacion: e.target.checked })}
                      />

                      <Form.Group className="mb-0">
                        <Form.Label className="small fw-semibold mb-1">Estado de cobertura</Form.Label>
                        <Form.Text className="text-muted d-block mb-2 small">
                          Uno o más valores enviados como lista (<code>estado_cobertura</code>):{" "}
                          <strong>si</strong>, <strong>no</strong>, <strong>medicare</strong>,{" "}
                          <strong>medicai</strong>.
                        </Form.Text>
                        <div className="d-flex flex-wrap gap-3 column-gap-4">
                          {ESTADO_COBERTURA_OPTIONS.map((opt) => (
                            <Form.Check
                              key={opt.apiValue}
                              id={`fc-estado-${opt.apiValue}`}
                              type="checkbox"
                              label={opt.label}
                              checked={!!filtrosCoberturaUi[opt.uiKey]}
                              onChange={(e) => updateFiltrosUi({ [opt.uiKey]: e.target.checked })}
                            />
                          ))}
                        </div>
                        {formErrors["filtros_cobertura.estado_cobertura"] && (
                          <div className="text-danger small mt-2">
                            {formErrors["filtros_cobertura.estado_cobertura"]}
                          </div>
                        )}
                      </Form.Group>
                    </div>
                  </>
                ) : (
                  <Alert variant="light" border="secondary" className="small mb-0 py-2">
                    Los filtros de cobertura no aplican cuando el objetivo es <strong>clientes</strong>.
                  </Alert>
                )}
              </Form>
            )}
          </div>
        ) : (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Tipos disponibles</h5>
              <Button variant="primary" size="sm" onClick={handleCreate}>
                <FaPlus className="me-1" />
                Crear tipo
              </Button>
            </div>

            {error && (
              <Alert variant="danger" dismissible onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" role="status" />
                <p className="mt-2 text-muted mb-0">Cargando tipos…</p>
              </div>
            ) : types.length === 0 ? (
              <Alert variant="info">
                No hay tipos configurados para {targetType === "coberturas" ? "coberturas" : "clientes"}.
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Código</th>
                      <th>Universo</th>
                      <th>Descripción</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.map((type) => (
                      <tr key={type.id}>
                        <td>{type.nombre}</td>
                        <td>{type.codigo || "—"}</td>
                        <td>
                          {hasFiltrosCobertura(type) ? (
                            <Badge bg="info" className="text-wrap">
                              Filtros cobertura
                            </Badge>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>
                        <td className="small">{type.descripcion || "—"}</td>
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
            <Button variant="primary" onClick={handleSave} disabled={saving || loadingDetail}>
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Guardando…
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
