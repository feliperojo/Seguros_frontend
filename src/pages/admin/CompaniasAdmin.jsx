import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  Form,
  InputGroup,
  Button,
  Spinner,
  Modal,
  Alert,
  Row,
  Col,
} from "react-bootstrap";
import {
  FaSearch,
  FaEdit,
  FaTrashAlt,
  FaPlus,
  FaBuilding,
  FaFilter,
  FaSync,
  FaTable,
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  fetchCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} from "../../services/companies";
import "../../styles/HistorialCoberturasCanceladas.css";
import "../../styles/CompaniasAdmin.css";

const emptyForm = () => ({
  nombre: "",
  nota: "",
  status: true,
  aplica_salud: true,
  aplica_dental_ms: false,
});

const isTruthyFlag = (value) => value !== false && value !== 0 && value !== "0";

const StatusBadge = ({ ok, okLabel = "Sí", offLabel = "No", variant = "ok" }) => (
  <span
    className={`cmp-admin__badge ${
      ok
        ? variant === "dental"
          ? "cmp-admin__badge--dental"
          : "cmp-admin__badge--ok"
        : "cmp-admin__badge--off"
    }`}
  >
    {ok ? okLabel : offLabel}
  </span>
);

const CompaniasAdmin = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDental, setFilterDental] = useState("todos");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});

  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCompanies();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err.message || "Error al cargar compañías";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleCreate = () => {
    setSelected(null);
    setFormData(emptyForm());
    setFormErrors({});
    setShowForm(true);
  };

  const handleEdit = (item) => {
    setSelected(item);
    setFormData({
      nombre: item.nombre || "",
      nota: item.nota || "",
      status: isTruthyFlag(item.status),
      aplica_salud: isTruthyFlag(item.aplica_salud),
      aplica_dental_ms: Boolean(item.aplica_dental_ms),
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleDelete = async (item) => {
    if (
      !window.confirm(
        `¿Eliminar la compañía "${item.nombre}"? Si tiene coberturas asociadas no se podrá eliminar.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(item.id);
      await deleteCompany(item.id);
      toast.success("Compañía eliminada correctamente");
      loadItems();
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Error al eliminar"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    const nombre = formData.nombre.trim();
    if (!nombre) {
      setFormErrors({ nombre: ["El nombre es obligatorio."] });
      toast.error("El nombre es obligatorio.");
      return;
    }

    const payload = {
      nombre,
      nota: formData.nota.trim(),
      status: Boolean(formData.status),
      aplica_salud: Boolean(formData.aplica_salud),
      aplica_dental_ms: Boolean(formData.aplica_dental_ms),
    };

    try {
      setSaving(true);
      if (selected) {
        await updateCompany(selected.id, payload);
        toast.success("Compañía actualizada correctamente");
      } else {
        await createCompany(payload);
        toast.success("Compañía creada correctamente");
      }
      setShowForm(false);
      loadItems();
    } catch (err) {
      if (err.response?.status === 422) {
        const backendErrors = err.response?.data?.errors || err.response?.errors;
        if (backendErrors) {
          setFormErrors(backendErrors);
          const first = Object.values(backendErrors).flat()[0];
          if (first) toast.error(first);
        } else {
          toast.error(err.response?.data?.message || "Error de validación");
        }
      } else {
        toast.error(
          err.response?.data?.message || err.message || "Error al guardar"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !q ||
        String(item.nombre || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nota || "")
          .toLowerCase()
          .includes(q);

      let matchesDental = true;
      if (filterDental === "si") matchesDental = Boolean(item.aplica_dental_ms);
      if (filterDental === "no") matchesDental = !item.aplica_dental_ms;

      let matchesEstado = true;
      if (filterEstado === "activas") matchesEstado = isTruthyFlag(item.status);
      if (filterEstado === "inactivas") matchesEstado = !isTruthyFlag(item.status);

      return matchesSearch && matchesDental && matchesEstado;
    });
  }, [items, searchTerm, filterDental, filterEstado]);

  const totalDental = useMemo(
    () => items.filter((i) => Boolean(i.aplica_dental_ms)).length,
    [items]
  );

  const limpiarFiltros = () => {
    setSearchTerm("");
    setFilterDental("todos");
    setFilterEstado("todos");
  };

  return (
    <div className="cmp-admin-container">
      <div className="cmp-admin">
        <div className="cmp-admin__header">
          <div className="cmp-admin__header-main">
            <div className="cmp-admin__header-icon" aria-hidden="true">
              <FaBuilding />
            </div>
            <div>
              <h1 className="cmp-admin__title">Compañías</h1>
              <p className="cmp-admin__subtitle">
                Administre aseguradoras y defina a qué productos aplican (Salud /
                Dental MS). Sin listas quemadas en código.
              </p>
            </div>
          </div>
          <div className="cmp-admin__header-actions">
            <span className="cmp-admin__chip">Total: {items.length}</span>
            <span className="cmp-admin__chip cmp-admin__chip--dental">
              Dental MS: {totalDental}
            </span>
            <Button
              size="sm"
              className="cmp-admin__btn-ghost"
              onClick={loadItems}
              disabled={loading}
            >
              <FaSync className={loading ? "fa-spin me-1" : "me-1"} />
              Actualizar
            </Button>
            <Button size="sm" className="cmp-admin__btn-header" onClick={handleCreate}>
              <FaPlus className="me-1" />
              Nueva compañía
            </Button>
          </div>
        </div>

        <div className="cmp-admin__body">
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          <div className="cmp-admin__section">
            <div className="cmp-admin__section-title">
              <FaFilter aria-hidden="true" />
              Filtros
            </div>
            <Row className="g-3 align-items-end">
              <Col xs={12} lg={5}>
                <div className="cmp-admin__label">Buscar</div>
                <InputGroup>
                  <Form.Control
                    placeholder="Nombre o nota…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Button variant="primary">
                    <FaSearch />
                  </Button>
                </InputGroup>
              </Col>
              <Col xs={12} sm={6} lg={3}>
                <div className="cmp-admin__label">Dental MS</div>
                <Form.Select
                  value={filterDental}
                  onChange={(e) => setFilterDental(e.target.value)}
                  aria-label="Filtrar Dental MS"
                >
                  <option value="todos">Todas</option>
                  <option value="si">Solo con Dental MS</option>
                  <option value="no">Sin Dental MS</option>
                </Form.Select>
              </Col>
              <Col xs={12} sm={6} lg={2}>
                <div className="cmp-admin__label">Estado</div>
                <Form.Select
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  aria-label="Filtrar estado"
                >
                  <option value="todos">Todos</option>
                  <option value="activas">Activas</option>
                  <option value="inactivas">Inactivas</option>
                </Form.Select>
              </Col>
              <Col xs={12} sm={6} lg={2}>
                <Button
                  type="button"
                  variant="outline-secondary"
                  className="w-100"
                  onClick={limpiarFiltros}
                >
                  Limpiar
                </Button>
              </Col>
            </Row>
          </div>

          <div className="cmp-admin__summary">
            Mostrando <strong>{filtered.length}</strong> de{" "}
            <strong>{items.length}</strong> compañías
          </div>

          <div className="cmp-admin__section cmp-admin__section--table">
            <div className="cmp-admin__section-title px-3 pt-3 mb-0 border-0 pb-2">
              <FaTable aria-hidden="true" />
              Catálogo
            </div>

            {loading ? (
              <div className="cmp-admin__loading">
                <Spinner animation="border" size="sm" className="me-2" />
                Cargando compañías…
              </div>
            ) : filtered.length === 0 ? (
              <div className="cmp-admin__empty">
                No hay compañías con los filtros actuales.
              </div>
            ) : (
              <div className="cmp-admin__table-wrap hcc-table-wrap border-0 rounded-0">
                <Table hover className="hcc-table mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Nota</th>
                      <th>Estado</th>
                      <th>Salud</th>
                      <th>Dental MS</th>
                      <th style={{ width: 110 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const activa = isTruthyFlag(item.status);
                      const salud = isTruthyFlag(item.aplica_salud);
                      return (
                        <tr key={item.id}>
                          <td className="fw-semibold">{item.nombre}</td>
                          <td className="text-muted">{item.nota || "—"}</td>
                          <td>
                            <span
                              className={`cmp-admin__badge ${
                                activa
                                  ? "cmp-admin__badge--ok"
                                  : "cmp-admin__badge--inactive"
                              }`}
                            >
                              {activa ? "Activa" : "Inactiva"}
                            </span>
                          </td>
                          <td>
                            <StatusBadge ok={salud} />
                          </td>
                          <td>
                            <StatusBadge
                              ok={Boolean(item.aplica_dental_ms)}
                              variant="dental"
                            />
                          </td>
                          <td>
                            <div className="cmp-admin__actions">
                              <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={() => handleEdit(item)}
                                title="Editar"
                              >
                                <FaEdit />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                disabled={actionLoading === item.id}
                                onClick={() => handleDelete(item)}
                                title="Eliminar"
                              >
                                {actionLoading === item.id ? (
                                  <Spinner animation="border" size="sm" />
                                ) : (
                                  <FaTrashAlt />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        show={showForm}
        onHide={() => setShowForm(false)}
        centered
        dialogClassName="cmp-admin-modal"
      >
        <Form onSubmit={handleFormSubmit}>
          <Modal.Header closeButton className="cmp-admin-modal__header">
            <div className="cmp-admin-modal__header-main">
              <div className="cmp-admin-modal__header-icon" aria-hidden="true">
                <FaBuilding />
              </div>
              <div>
                <h2 className="cmp-admin-modal__title">
                  {selected ? "Editar compañía" : "Nueva compañía"}
                </h2>
                <p className="cmp-admin-modal__subtitle">
                  Defina nombre, estado y productos a los que aplica
                </p>
              </div>
            </div>
          </Modal.Header>
          <Modal.Body className="cmp-admin-modal__body">
            <div className="cmp-admin-modal__panel">
              {formErrors.general && (
                <Alert variant="danger">{formErrors.general}</Alert>
              )}
              <Form.Group className="mb-3">
                <div className="cmp-admin-modal__label">Nombre</div>
                <Form.Control
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, nombre: e.target.value }))
                  }
                  isInvalid={Boolean(formErrors.nombre)}
                  placeholder="Nombre de la aseguradora"
                  required
                />
                {formErrors.nombre && (
                  <Form.Control.Feedback type="invalid">
                    {formErrors.nombre[0]}
                  </Form.Control.Feedback>
                )}
              </Form.Group>
              <Form.Group className="mb-3">
                <div className="cmp-admin-modal__label">Nota</div>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formData.nota}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, nota: e.target.value }))
                  }
                  placeholder="Observación opcional"
                />
              </Form.Group>
              <div className="cmp-admin-modal__label">Configuración</div>
              <div className="cmp-admin-modal__switches">
                <Form.Check
                  type="switch"
                  id="compania-status"
                  label="Activa"
                  checked={formData.status}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, status: e.target.checked }))
                  }
                />
                <Form.Check
                  type="switch"
                  id="compania-salud"
                  label="Aplica a Salud"
                  checked={formData.aplica_salud}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      aplica_salud: e.target.checked,
                    }))
                  }
                />
                <Form.Check
                  type="switch"
                  id="compania-dental"
                  label="Aplica a Dental MS"
                  checked={formData.aplica_dental_ms}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      aplica_dental_ms: e.target.checked,
                    }))
                  }
                />
              </div>
              <p className="cmp-admin-modal__hint">
                En coberturas Dental MS solo se listarán las compañías con “Aplica
                a Dental MS” activo.
              </p>
            </div>
          </Modal.Body>
          <Modal.Footer className="cmp-admin-modal__footer">
            <Button
              variant="outline-secondary"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default CompaniasAdmin;
