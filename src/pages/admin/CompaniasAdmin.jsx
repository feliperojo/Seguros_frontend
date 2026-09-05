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
  COMPANIA_PRODUCTOS,
} from "../../services/companies";
import "../../styles/HistorialCoberturasCanceladas.css";
import "../../styles/CompaniasAdmin.css";

const emptyForm = () => {
  const form = {
    nombre: "",
    nota: "",
    status: true,
  };
  COMPANIA_PRODUCTOS.forEach((p) => {
    form[p.flag] = p.defaultOn;
  });
  return form;
};

const isTruthyFlag = (value) => value !== false && value !== 0 && value !== "0";

const ProductosBadges = ({ item }) => (
  <div className="cmp-admin__product-badges">
    {COMPANIA_PRODUCTOS.map((p) => {
      const on =
        p.key === "dental_ms"
          ? Boolean(item[p.flag])
          : isTruthyFlag(item[p.flag]);
      if (!on) return null;
      return (
        <span
          key={p.key}
          className={`cmp-admin__prod-chip ${
            p.key === "dental_ms" ? "cmp-admin__prod-chip--dental" : ""
          }`}
        >
          {p.short}
        </span>
      );
    })}
  </div>
);

const CompaniasAdmin = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProducto, setFilterProducto] = useState("todos");
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
    const next = {
      nombre: item.nombre || "",
      nota: item.nota || "",
      status: isTruthyFlag(item.status),
    };
    COMPANIA_PRODUCTOS.forEach((p) => {
      if (p.key === "dental_ms") {
        next[p.flag] = Boolean(item[p.flag]);
      } else if (item[p.flag] === undefined || item[p.flag] === null) {
        next[p.flag] = p.defaultOn;
      } else {
        next[p.flag] = isTruthyFlag(item[p.flag]);
      }
    });
    setFormData(next);
    setFormErrors({});
    setShowForm(true);
  };

  const handleInactivate = async (item) => {
    try {
      setActionLoading(item.id);
      await updateCompany(item.id, { status: false });
      toast.success(`Compañía "${item.nombre}" inactivada correctamente`);
      await loadItems();
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Error al inactivar"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (item) => {
    if (
      !window.confirm(
        `¿Eliminar la compañía "${item.nombre}"?\n\nSi está asociada a una cobertura no se podrá eliminar; en ese caso solo podrá inactivarla.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(item.id);
      await deleteCompany(item.id);
      toast.success("Compañía eliminada correctamente");
      await loadItems();
    } catch (err) {
      const payload = err.response?.data || {};
      const msg =
        payload.message || err.message || "Error al eliminar la compañía";
      const canInactivate =
        payload.code === "COMPANIA_ASOCIADA_COBERTURA" ||
        payload.can_inactivate === true ||
        /cobertura|inactivar/i.test(String(msg));

      toast.error(msg);

      if (canInactivate && isTruthyFlag(item.status)) {
        const inactivar = window.confirm(
          `${msg}\n\n¿Desea inactivar la compañía "${item.nombre}" ahora?`
        );
        if (inactivar) {
          await handleInactivate(item);
          return;
        }
      }
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
    };
    COMPANIA_PRODUCTOS.forEach((p) => {
      payload[p.flag] = Boolean(formData[p.flag]);
    });

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

      let matchesProducto = true;
      if (filterProducto !== "todos") {
        const meta = COMPANIA_PRODUCTOS.find((p) => p.key === filterProducto);
        if (meta) {
          matchesProducto =
            meta.key === "dental_ms"
              ? Boolean(item[meta.flag])
              : isTruthyFlag(item[meta.flag]);
        }
      }

      let matchesEstado = true;
      if (filterEstado === "activas") matchesEstado = isTruthyFlag(item.status);
      if (filterEstado === "inactivas") matchesEstado = !isTruthyFlag(item.status);

      return matchesSearch && matchesProducto && matchesEstado;
    });
  }, [items, searchTerm, filterProducto, filterEstado]);

  const totalDental = useMemo(
    () => items.filter((i) => Boolean(i.aplica_dental_ms)).length,
    [items]
  );

  const limpiarFiltros = () => {
    setSearchTerm("");
    setFilterProducto("todos");
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
                Administre aseguradoras y defina a qué productos aplican (Salud,
                Dental MS, Plan Dental, Vision, Vida, Descuentos). Sin listas
                quemadas en código.
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
                <div className="cmp-admin__label">Producto</div>
                <Form.Select
                  value={filterProducto}
                  onChange={(e) => setFilterProducto(e.target.value)}
                  aria-label="Filtrar por producto"
                >
                  <option value="todos">Todos</option>
                  {COMPANIA_PRODUCTOS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
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
                      <th style={{ width: 72 }}>ID</th>
                      <th>Nombre</th>
                      <th>Nota</th>
                      <th>Estado</th>
                      <th>Productos</th>
                      <th style={{ width: 110 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const activa = isTruthyFlag(item.status);
                      return (
                        <tr key={item.id}>
                          <td className="text-muted font-monospace">{item.id}</td>
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
                            <ProductosBadges item={item} />
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
              <div className="cmp-admin-modal__label">Estado</div>
              <div className="cmp-admin-modal__switches mb-3">
                <Form.Check
                  type="switch"
                  id="compania-status"
                  label="Activa"
                  checked={formData.status}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, status: e.target.checked }))
                  }
                />
              </div>
              <div className="cmp-admin-modal__label">Productos a los que aplica</div>
              <div className="cmp-admin-modal__switches cmp-admin-modal__switches--grid">
                {COMPANIA_PRODUCTOS.map((prod) => (
                  <Form.Check
                    key={prod.key}
                    type="switch"
                    id={`compania-${prod.key}`}
                    label={prod.label}
                    checked={Boolean(formData[prod.flag])}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        [prod.flag]: e.target.checked,
                      }))
                    }
                  />
                ))}
              </div>
              <p className="cmp-admin-modal__hint">
                En cada producto solo se listarán las compañías con el switch
                correspondiente activo. Dental MS sigue siendo opt-in; el resto
                inicia activo para no romper coberturas existentes.
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
